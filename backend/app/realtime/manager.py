from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[UUID, list[WebSocket]] = defaultdict(list)

    async def connect(self, task_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[task_id].append(websocket)

    def disconnect(self, task_id: UUID, websocket: WebSocket) -> None:
        if websocket in self.active_connections[task_id]:
            self.active_connections[task_id].remove(websocket)

    async def broadcast(self, task_id: UUID, payload: dict) -> None:
        stale: list[WebSocket] = []
        for websocket in self.active_connections[task_id]:
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(task_id, websocket)


connection_manager = ConnectionManager()
