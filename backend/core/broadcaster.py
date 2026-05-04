# backend/core/broadcaster.py

import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketBroadcaster:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.queue = asyncio.Queue()
        self._is_running = False

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("BROADCASTER: Client connected. Total: %s", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info("BROADCASTER: Client disconnected. Total: %s", len(self.active_connections))

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
                    self.active_connections.remove(stale)

                self.queue.task_done()
            except Exception as e:
                logger.warning("BROADCASTER: Broadcast loop error: %s", e.__class__.__name__)
                await asyncio.sleep(0.1)

    def start(self, loop: asyncio.AbstractEventLoop):
        """Starts the background broadcast task."""
        loop.create_task(self._broadcast_loop())
        logger.info("BROADCASTER: Service started")
