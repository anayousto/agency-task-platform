from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ActivityLog, Agency, Task, TaskStatus, User, UserRole
from app.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def task_scope_filters(user: User) -> list:
    if user.role == UserRole.employee:
        return [Task.assigned_user_id == user.id]
    if user.role == UserRole.partner:
        return [Task.agency_id == user.agency_id]
    return []


def task_count(db: Session, user: User, status: TaskStatus | None = None) -> int:
    filters = task_scope_filters(user)
    if status:
        filters.append(Task.status == status)
    return int(db.scalar(select(func.count()).select_from(Task).where(*filters)) or 0)


@router.get("", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> DashboardStats:
    filters = task_scope_filters(current_user)
    activity_query = select(ActivityLog).join(Task).where(*filters).order_by(ActivityLog.created_at.desc()).limit(10)
    total_agencies = int(db.scalar(select(func.count()).select_from(Agency)) or 0) if current_user.role == UserRole.admin else 0
    return DashboardStats(
        total_tasks=task_count(db, current_user),
        pending_tasks=task_count(db, current_user, TaskStatus.pending),
        working_tasks=task_count(db, current_user, TaskStatus.working),
        completed_tasks=task_count(db, current_user, TaskStatus.completed),
        total_agencies=total_agencies,
        recent_activity=list(db.scalars(activity_query).all()),
    )
