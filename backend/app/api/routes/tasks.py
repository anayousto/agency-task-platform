import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import ensure_task_access, get_current_user, require_roles
from app.db.session import get_db
from app.models import ActivityLog, Agency, Attachment, Message, Task, TaskStatus, User, UserRole
from app.schemas import ActivityLogRead, TaskCreate, TaskDetail, TaskRead, TaskStatusUpdate, TaskUpdate
from app.services.notifications import notify_task_participants
from app.services.storage import storage_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


def add_activity(db: Session, task: Task, user: User, action: str) -> None:
    db.add(ActivityLog(task_id=task.id, user_id=user.id, action=action))


def task_options():
    return (
        selectinload(Task.agency),
        selectinload(Task.assigned_user).selectinload(User.agency),
        selectinload(Task.messages).selectinload(Message.sender),
        selectinload(Task.attachments).selectinload(Attachment.uploader),
        selectinload(Task.activity_logs).selectinload(ActivityLog.user),
    )


def scoped_task_query(user: User):
    query = select(Task)
    if user.role == UserRole.employee:
        query = query.where(Task.assigned_user_id == user.id)
    elif user.role == UserRole.partner:
        query = query.where(Task.agency_id == user.agency_id)
    return query


def validate_task_links(db: Session, agency_id: uuid.UUID | None, assigned_user_id: uuid.UUID | None) -> None:
    if agency_id and not db.get(Agency, agency_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Agency does not exist")
    if assigned_user_id and not db.get(User, assigned_user_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Assigned user does not exist")


@router.get("", response_model=list[TaskRead])
def list_tasks(
    search: str | None = Query(default=None),
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    agency_id: uuid.UUID | None = None,
    assigned_user_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Task]:
    query = scoped_task_query(current_user).options(selectinload(Task.agency), selectinload(Task.assigned_user))
    if search:
        query = query.where((Task.title.ilike(f"%{search}%")) | (Task.description.ilike(f"%{search}%")))
    if status_filter:
        query = query.where(Task.status == status_filter)
    if agency_id:
        query = query.where(Task.agency_id == agency_id)
    if assigned_user_id:
        query = query.where(Task.assigned_user_id == assigned_user_id)
    query = query.order_by(Task.updated_at.desc())
    return list(db.scalars(query).all())


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> Task:
    validate_task_links(db, payload.agency_id, payload.assigned_user_id)
    task = Task(**payload.model_dump(), created_by=current_user.id)
    db.add(task)
    db.flush()
    add_activity(db, task, current_user, "Task created")
    notify_task_participants(
        db,
        task=task,
        actor_id=current_user.id,
        type="task_assigned",
        title="New task assigned",
        body=task.title,
    )
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    task = db.scalar(select(Task).where(Task.id == task_id).options(*task_options()))
    ensure_task_access(current_user, task)
    for attachment in task.attachments:
        attachment.file_url = storage_service.presigned_url(attachment.object_key)
    task.messages.sort(key=lambda item: item.created_at)
    task.activity_logs.sort(key=lambda item: item.created_at, reverse=True)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.admin)),
) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)
    validate_task_links(db, data.get("agency_id", task.agency_id), data.get("assigned_user_id", task.assigned_user_id))
    old_status = task.status
    for field, value in data.items():
        setattr(task, field, value)
    if "status" in data and task.status != old_status:
        add_activity(db, task, current_user, f"Status changed from {old_status.value} to {task.status.value}")
        notify_task_participants(
            db,
            task=task,
            actor_id=current_user.id,
            type="status_changed",
            title="Task status changed",
            body=f"{task.title}: {task.status.value.replace('_', ' ')}",
        )
    else:
        add_activity(db, task, current_user, "Task updated")
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/status", response_model=TaskRead)
def update_task_status(
    task_id: uuid.UUID,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    if task.status != payload.status:
        old_status = task.status
        task.status = payload.status
        add_activity(db, task, current_user, f"Status changed from {old_status.value} to {task.status.value}")
        notify_task_participants(
            db,
            task=task,
            actor_id=current_user.id,
            type="status_changed",
            title="Task status changed",
            body=f"{task.title}: {task.status.value.replace('_', ' ')}",
        )
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}/activity", response_model=list[ActivityLogRead])
def task_activity(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ActivityLog]:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    query = select(ActivityLog).where(ActivityLog.task_id == task.id).order_by(ActivityLog.created_at.desc())
    return list(db.scalars(query).all())


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> None:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(task)
    db.commit()
