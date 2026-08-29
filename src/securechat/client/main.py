from __future__ import annotations

import asyncio
import sys

from .app import SecureChatApp
from .transport import TCPTransport
from .cli import SecureChatCLI

async def main() -> None:
    username = sys.argv[1] if len(sys.argv) > 1 else "alice"
    transport = TCPTransport(host="127.0.0.1", port=8765)
    app = SecureChatApp(username=username, transport=transport)
    cli = SecureChatCLI(app)
    await cli.start()

if __name__ == "__main__":
    asyncio.run(main())
