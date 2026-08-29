from __future__ import annotations


def render_message(sender: str, text: str) -> str:
    return f"[{sender}] {text}"
