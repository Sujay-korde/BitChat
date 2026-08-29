import asyncio
from prompt_toolkit import PromptSession
from prompt_toolkit.patch_stdout import patch_stdout

from .app import SecureChatApp
from .events import (
    ConnectionChanged, MessageReceived, MessageStatusChanged,
    PresenceChanged, KeyExchangeCompleted, ModerationRejected, ErrorOccurred
)

class SecureChatCLI:
    def __init__(self, app: SecureChatApp):
        self.app = app
        self.session = PromptSession(message=f"{app.username}> ")
        self._running = False
        self._listen_task: asyncio.Task | None = None

    async def start(self) -> None:
        self._running = True
        
        event_task = asyncio.create_task(self._consume_events())
        
        print(f"Connecting as {self.app.username}...")
        try:
            await self.app.connect()
            self._listen_task = asyncio.create_task(self.app.listen())
        except Exception as e:
            print(f"Failed to connect: {e}")

        try:
            with patch_stdout():
                while self._running:
                    command = await self.session.prompt_async()
                    await self._handle_command(command.strip())
        except (EOFError, KeyboardInterrupt):
            pass
        finally:
            self._running = False
            await self.app.disconnect()
            if self._listen_task:
                self._listen_task.cancel()
            event_task.cancel()

    async def _consume_events(self) -> None:
        async for event in self.app.events():
            if isinstance(event, ConnectionChanged):
                print(f"[*] Connection state: {event.state}")
            elif isinstance(event, MessageReceived):
                context = f"[{event.target}] " if event.target != self.app.username else ""
                print(f"<{event.sender}> {context}{event.text}")
            elif isinstance(event, PresenceChanged):
                print(f"[*] {event.user} is now {event.status} in {event.room}")
            elif isinstance(event, KeyExchangeCompleted):
                print(f"[*] Secure channel established with {event.peer}")
            elif isinstance(event, ModerationRejected):
                print(f"[!] Message to {event.target} rejected by moderation: {event.text}")
            elif isinstance(event, ErrorOccurred):
                print(f"[!] Error: {event.reason}")

    async def _handle_command(self, cmd: str) -> None:
        if not cmd:
            return
            
        if cmd.startswith("/quit"):
            self._running = False
        elif cmd.startswith("/connect"):
            try:
                await self.app.connect()
                if self._listen_task:
                    self._listen_task.cancel()
                self._listen_task = asyncio.create_task(self.app.listen())
            except Exception as e:
                print(f"Connect failed: {e}")
        elif cmd.startswith("/reconnect"):
            try:
                await self.app.reconnect_forever()
                if self._listen_task:
                    self._listen_task.cancel()
                self._listen_task = asyncio.create_task(self.app.listen())
            except Exception as e:
                print(f"Reconnect failed: {e}")
        elif cmd.startswith("/disconnect"):
            await self.app.disconnect()
        elif cmd.startswith("/join "):
            room = cmd.split(" ", 1)[1]
            await self.app.join_room(room)
        elif cmd.startswith("/leave "):
            room = cmd.split(" ", 1)[1]
            await self.app.leave_room(room)
        elif cmd.startswith("/msg "):
            parts = cmd.split(" ", 2)
            if len(parts) == 3:
                target, text = parts[1], parts[2]
                if target not in self.app.shared_keys:
                    print(f"[*] Initiating key exchange with {target}...")
                    await self.app.send_key_exchange(target)
                else:
                    await self.app.send_direct_message(target, text)
        elif cmd.startswith("/send "):
            parts = cmd.split(" ", 2)
            if len(parts) == 3:
                room, text = parts[1], parts[2]
                if room not in self.app.shared_keys:
                    print(f"[*] Initiating key exchange with room {room}...")
                    await self.app.send_key_exchange(room)
                else:
                    await self.app.send_room_message(room, text)
        else:
            print(f"Unknown command: {cmd}")
