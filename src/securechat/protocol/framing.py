from __future__ import annotations

import asyncio
import json
import struct
from typing import Any

MAX_FRAME_SIZE = 1024 * 1024
_LENGTH_PREFIX = struct.Struct(">I")


class FrameError(ValueError):
    """Raised when a frame cannot be decoded."""


def encode_frame(message: dict[str, Any]) -> bytes:
    payload = json.dumps(message, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if len(payload) > MAX_FRAME_SIZE:
        raise FrameError(f"Frame too large: {len(payload)} bytes")
    return _LENGTH_PREFIX.pack(len(payload)) + payload


def decode_frame(frame: bytes) -> dict[str, Any]:
    if len(frame) < _LENGTH_PREFIX.size:
        raise FrameError("Frame too short to contain a length prefix")

    payload_length = _LENGTH_PREFIX.unpack(frame[:4])[0]
    payload = frame[4:]
    if payload_length != len(payload):
        raise FrameError("Payload length does not match length prefix")

    try:
        return json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise FrameError("Invalid JSON frame payload") from exc


async def read_frame(reader: asyncio.StreamReader) -> dict[str, Any]:
    length_prefix = await reader.readexactly(_LENGTH_PREFIX.size)
    payload_length = _LENGTH_PREFIX.unpack(length_prefix)[0]
    if payload_length > MAX_FRAME_SIZE:
        raise FrameError(f"Frame too large: {payload_length} bytes")
    payload = await reader.readexactly(payload_length)
    return decode_frame(length_prefix + payload)


async def write_frame(writer: asyncio.StreamWriter, message: dict[str, Any]) -> None:
    writer.write(encode_frame(message))
    await writer.drain()
