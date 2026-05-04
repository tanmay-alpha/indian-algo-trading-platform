# backend/core/broadcaster.py

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class WebSocketBroadcaster:
    def __init__(self, heartbeat_interval_seconds: int = 25):
        self.active_connections: Set[WebSocket] = set()
        self._connection_paths: dict[WebSocket, str] = {}
        self.queue = asyncio.Queue()
        self._is_running = False
        self._heartbeat_enabled = True
        self._heartbeat_interval_seconds = heartbeat_interval_seconds
        self._broadcast_task: asyncio.Task | None = None
        self._heartbeat_task: asyncio.Task | None = None
        self.last_broadcast_at: str | None = None
        self.last_client_connect_at: str | None = None
        self.last_client_disconnect_at: str | None = None
        self.last_error: str | None = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        path = websocket.url.path
        self._connection_paths[websocket] = path
        self.last_client_connect_at = _utc_timestamp()
        self.last_error = None
        logger.info(
            "WS: Client connected path=%s total=%s",
            path,
            len(self.active_connections),
        )

    def disconnect(self, websocket: WebSocket, close_code: int | None = None):
        path = self._connection_paths.pop(websocket, websocket.url.path)
        self.active_connections.discard(websocket)
        self.last_client_disconnect_at = _utc_timestamp()
        logger.info(
            "WS: Client disconnected path=%s close_code=%s total=%s",
            path,
            close_code,
            len(self.active_connections),
        )

    async def broadcast(self, message: dict):
        """Adds a message to the broadcast queue."""
        await self.queue.put(message)

    def broadcast_sync(self, message: dict, loop: asyncio.AbstractEventLoop):
        """Thread-safe way to add message to queue from synchronous code."""
        loop.call_soon_threadsafe(self.queue.put_nowait, message)

    async def _broadcast_loop(self):
        """Background task to broadcast messages to all clients."""
        self._is_running = True
        while self._is_running:
            try:
                message = await self.queue.get()
                if not self.active_connections:
                    self.queue.task_done()
                    continue

                payload = json.dumps(message)
                
                # Create broadcast tasks for all clients
                disconnect_list = []
                for connection in self.active_connections:
                    try:
                        await connection.send_text(payload)
                    except Exception:
                        disconnect_list.append(connection)

                # Clean up stale connections
                for stale in disconnect_list:
                    self.last_error = "send_failure"
                    self.disconnect(stale)

                self.last_broadcast_at = _utc_timestamp()
                self.queue.task_done()
            except Exception as e:
                self.last_error = e.__class__.__name__
                logger.warning("BROADCASTER: Broadcast loop error: %s", e.__class__.__name__)
                await asyncio.sleep(0.1)

    async def _heartbeat_loop(self):
        while self._heartbeat_enabled:
            await asyncio.sleep(self._heartbeat_interval_seconds)
            await self.broadcast({
                "type": "ping",
                "payload": {"source": "server"},
                "ts": _utc_timestamp(),
            })

    def start(self, loop: asyncio.AbstractEventLoop):
        """Starts the background broadcast task."""
        if not self._broadcast_task or self._broadcast_task.done():
            self._broadcast_task = loop.create_task(self._broadcast_loop())
        if self._heartbeat_enabled and (
            not self._heartbeat_task or self._heartbeat_task.done()
        ):
            self._heartbeat_task = loop.create_task(self._heartbeat_loop())
        logger.info("BROADCASTER: Service started")

    def status(self, route_paths: list[str] | None = None) -> dict:
        return {
            "connected_clients": len(self.active_connections),
            "route_paths": route_paths or [],
            "heartbeat_enabled": self._heartbeat_enabled,
            "last_broadcast_at": self.last_broadcast_at,
            "last_client_connect_at": self.last_client_connect_at,
            "last_client_disconnect_at": self.last_client_disconnect_at,
            "last_error": self.last_error,
        }
