from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..realtime import manager

router = APIRouter(tags=["Real-time"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """One-way push channel — see backend/README.md "Real-time" section."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
