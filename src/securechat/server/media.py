from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger("securechat.media")

MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25MB max ciphertext blob size


class MediaBlobServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8767, storage_dir: str | None = None) -> None:
        self.host = host
        self.port = port
        self.storage_dir = Path(storage_dir or (Path(__file__).parent / "media_storage"))
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._server: asyncio.Server | None = None

    async def start(self) -> None:
        self._server = await asyncio.start_server(self._handle_client, self.host, self.port)
        logger.info("Media Blob Server listening on %s:%d (storage: %s)", self.host, self.port, self.storage_dir)

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            # Read HTTP request line
            request_line = await reader.readline()
            if not request_line:
                writer.close()
                return

            line_str = request_line.decode("iso-8859-1").strip()
            parts = line_str.split()
            if len(parts) < 2:
                writer.close()
                return

            method, path = parts[0].upper(), parts[1]

            # Read headers
            headers: dict[str, str] = {}
            while True:
                h_line = await reader.readline()
                if not h_line or h_line == b"\r\n" or h_line == b"\n":
                    break
                header_text = h_line.decode("iso-8859-1").strip()
                if ":" in header_text:
                    k, v = header_text.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

            # Handle CORS preflight
            if method == "OPTIONS":
                response = (
                    b"HTTP/1.1 204 No Content\r\n"
                    b"Access-Control-Allow-Origin: *\r\n"
                    b"Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                    b"Access-Control-Allow-Headers: Content-Type, Content-Length\r\n"
                    b"Content-Length: 0\r\n\r\n"
                )
                writer.write(response)
                await writer.drain()
                writer.close()
                return

            # Handle Upload: POST /api/media/upload
            if method == "POST" and path == "/api/media/upload":
                content_length = int(headers.get("content-length", "0"))
                if content_length <= 0 or content_length > MAX_UPLOAD_SIZE:
                    err_resp = b"HTTP/1.1 413 Payload Too Large\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n"
                    writer.write(err_resp)
                    await writer.drain()
                    writer.close()
                    return

                # Read body exactly
                body = await reader.readexactly(content_length)
                blob_id = str(uuid.uuid4())
                file_path = self.storage_dir / blob_id
                file_path.write_bytes(body)

                res_json = json.dumps({"blob_id": blob_id, "size": len(body)}).encode("utf-8")
                headers_out = (
                    b"HTTP/1.1 201 Created\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Access-Control-Allow-Origin: *\r\n"
                    b"Content-Length: " + str(len(res_json)).encode("ascii") + b"\r\n\r\n"
                )
                writer.write(headers_out + res_json)
                await writer.drain()
                writer.close()
                return

            # Handle Download: GET /api/media/<blob_id>
            if method == "GET" and path.startswith("/api/media/"):
                blob_id = path.split("/api/media/", 1)[1].strip()
                # Security: prevent path traversal
                if "/" in blob_id or "\\" in blob_id or ".." in blob_id:
                    writer.write(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                    await writer.drain()
                    writer.close()
                    return

                file_path = self.storage_dir / blob_id
                if not file_path.is_file():
                    writer.write(b"HTTP/1.1 404 Not Found\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: 0\r\n\r\n")
                    await writer.drain()
                    writer.close()
                    return

                data = file_path.read_bytes()
                headers_out = (
                    b"HTTP/1.1 200 OK\r\n"
                    b"Content-Type: application/octet-stream\r\n"
                    b"Access-Control-Allow-Origin: *\r\n"
                    b"Content-Length: " + str(len(data)).encode("ascii") + b"\r\n\r\n"
                )
                writer.write(headers_out + data)
                await writer.drain()
                writer.close()
                return

            # Default 404
            writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
            await writer.drain()
            writer.close()

        except Exception as e:
            logger.error("Error handling media HTTP request: %s", e)
            try:
                writer.close()
            except Exception:
                pass
