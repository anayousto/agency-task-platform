import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import TaskPriority, TaskStatus, UserRole


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AgencyBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    logo_url: str | None = Field(default=None, max_length=600)
    contact_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=80)


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    logo_url: str | None = Field(default=None, max_length=600)
    contact_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=80)


class AgencyRead(AgencyBase, ORMModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    role: UserRole
    agency_id: uuid.UUID | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    email: EmailStr | None = None
    role: UserRole | None = None
    agency_id: uuid.UUID | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserRead(UserBase, ORMModel):
    id: uuid.UUID
    agency: AgencyRead | None = None
    created_at: datetime
    updated_at: datetime


class Me(UserRead):
    pass


class TaskBase(BaseModel):
    title: str = Field(min_length=2, max_length=220)
    description: str = Field(min_length=1)
    status: TaskStatus = TaskStatus.pending
    priority: TaskPriority = TaskPriority.normal
    agency_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    due_date: datetime | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=220)
    description: str | None = Field(default=None, min_length=1)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    agency_id: uuid.UUID | None = None
    assigned_user_id: uuid.UUID | None = None
    due_date: datetime | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskRead(TaskBase, ORMModel):
    id: uuid.UUID
    created_by: uuid.UUID
    agency: AgencyRead | None = None
    assigned_user: UserRead | None = None
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class MessageRead(ORMModel):
    id: uuid.UUID
    task_id: uuid.UUID
    sender_id: uuid.UUID
    sender: UserRead | None = None
    message: str
    created_at: datetime


class AttachmentRead(ORMModel):
    id: uuid.UUID
    task_id: uuid.UUID
    uploaded_by: uuid.UUID
    uploader: UserRead | None = None
    file_name: str
    file_url: str
    content_type: str | None = None
    size_bytes: int
    created_at: datetime


class ActivityLogRead(ORMModel):
    id: uuid.UUID
    task_id: uuid.UUID
    user_id: uuid.UUID | None
    user: UserRead | None = None
    action: str
    created_at: datetime


class TaskDetail(TaskRead):
    messages: list[MessageRead] = []
    attachments: list[AttachmentRead] = []
    activity_logs: list[ActivityLogRead] = []


class NotificationRead(ORMModel):
    id: uuid.UUID
    user_id: uuid.UUID
    task_id: uuid.UUID | None
    type: str
    title: str
    body: str
    read_at: datetime | None
    created_at: datetime


class DashboardStats(BaseModel):
    total_tasks: int
    pending_tasks: int
    working_tasks: int
    completed_tasks: int
    total_agencies: int
    recent_activity: list[ActivityLogRead]
