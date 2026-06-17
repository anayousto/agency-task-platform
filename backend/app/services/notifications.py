from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, Task, User, UserRole


def create_notification(
    db: Session,
    *,
    user_id,
    task_id,
    type: str,
    title: str,
    body: str,
) -> Notification:
    notification = Notification(user_id=user_id, task_id=task_id, type=type, title=title, body=body)
    db.add(notification)
    return notification


def participant_ids(db: Session, task: Task) -> set:
    ids = {task.created_by}
    if task.assigned_user_id:
        ids.add(task.assigned_user_id)
    if task.agency_id:
        agency_user_ids = db.scalars(select(User.id).where(User.agency_id == task.agency_id)).all()
        ids.update(agency_user_ids)
    admin_ids = db.scalars(select(User.id).where(User.role == UserRole.admin)).all()
    ids.update(admin_ids)
    return ids


def notify_task_participants(
    db: Session,
    *,
    task: Task,
    actor_id,
    type: str,
    title: str,
    body: str,
) -> None:
    for user_id in participant_ids(db, task):
        if user_id != actor_id:
            create_notification(db, user_id=user_id, task_id=task.id, type=type, title=title, body=body)
