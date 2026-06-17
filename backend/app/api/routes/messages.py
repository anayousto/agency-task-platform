import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import ensure_task_access, get_current_user
from app.core.security import decode_token
from app.db.session import SessionLocal, get_db
from app.models import ActivityLog, Message, Task, User
from app.realtime.manager import connection_manager
from app.schemas import MessageCreate, MessageRead
from app.services.notifications import notify_task_participants

router = APIRouter(prefix="/tasks/{task_id}/messages", tags=["messages"])
ws_router = APIRouter(prefix="/tasks", tags=["realtime"])


async def create_message_record(db: Session, task: Task, user: User, text: str) -> Message:
    message = Message(task_id=task.id, sender_id=user.id, message=text)
    db.add(message)
    db.flush()
    db.add(ActivityLog(task_id=task.id, user_id=user.id, action="Message sent"))
    notify_task_participants(
        db,
        task=task,
        actor_id=user.id,
        type="message_received",
        title="New message received",
        body=task.title,
    )
    db.commit()
    db.refresh(message)
    await connection_manager.broadcast(
        task.id,
        {
            "event": "message.created",
            "message": MessageRead.model_validate(message).model_dump(mode="json"),
        },
    )
    return message


@router.get("", response_model=list[MessageRead])
def list_messages(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Message]:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    query = select(Message).where(Message.task_id == task.id).order_by(Message.created_at.asc())
    return list(db.scalars(query).all())


@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    task_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Message:
    task = ensure_task_access(current_user, db.get(Task, task_id))
    return await create_message_record(db, task, current_user, payload.message)


def websocket_user(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
        user_id = uuid.UUID(str(payload.get("sub")))
    except ValueError:
        return None
    return db.get(User, user_id)


@ws_router.websocket("/{task_id}/ws")
async def task_websocket(websocket: WebSocket, task_id: uuid.UUID, token: str | None = None) -> None:
    db = SessionLocal()
    user = websocket_user(db, token)
    task = db.get(Task, task_id)
    try:
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        try:
            ensure_task_access(user, task)
        except HTTPException:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await connection_manager.connect(task_id, websocket)
        while True:
            payload = await websocket.receive_json()
            text = str(payload.get("message", "")).strip()
            if text:
                await create_message_record(db, task, user, text)
    except WebSocketDisconnect:
        connection_manager.disconnect(task_id, websocket)
    finally:
        db.close()
