import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import ensure_task_access, get_current_user
from app.db.session import get_db
from app.models import ActivityLog, Attachment, Task, User, UserRole
from app.realtime.manager import connection_manager
from app.schemas import AttachmentRead
from app.services.notifications import notify_task_participants
from app.services.storage import storage_service

router = APIRouter(prefix="/tasks/{task_id}/attachments", tags=["attachments"])


@router.get("", response_model=list[AttachmentRead])
def list_attachments(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Attachment]:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    attachments = db.scalars(
        select(Attachment).where(Attachment.task_id == task.id).order_by(Attachment.created_at.desc())
    ).all()
    for attachment in attachments:
        attachment.file_url = storage_service.presigned_url(attachment.object_key)
    return list(attachments)


@router.post("", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Attachment:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    object_key, file_url, size_bytes, content_type = await storage_service.upload(file, task.id)
    attachment = Attachment(
        task_id=task.id,
        uploaded_by=current_user.id,
        file_name=file.filename or "attachment",
        file_url=file_url,
        object_key=object_key,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    db.add(attachment)
    db.flush()
    db.add(ActivityLog(task_id=task.id, user_id=current_user.id, action=f"File uploaded: {attachment.file_name}"))
    notify_task_participants(
        db,
        task=task,
        actor_id=current_user.id,
        type="file_uploaded",
        title="File uploaded",
        body=attachment.file_name,
    )
    db.commit()
    db.refresh(attachment)
    await connection_manager.broadcast(
        task.id,
        {
            "event": "attachment.created",
            "attachment": AttachmentRead.model_validate(attachment).model_dump(mode="json"),
        },
    )
    return attachment


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    task_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    attachment = db.get(Attachment, attachment_id)
    if not attachment or attachment.task_id != task.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    if current_user.role != UserRole.admin and attachment.uploaded_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins or uploaders can delete files")
    storage_service.delete(attachment.object_key)
    db.delete(attachment)
    db.add(ActivityLog(task_id=task.id, user_id=current_user.id, action=f"File deleted: {attachment.file_name}"))
    db.commit()
