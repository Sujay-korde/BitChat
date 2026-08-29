import pytest

from securechat.protocol.schema import SchemaError, validate_message_envelope


def test_validate_message_envelope() -> None:
    envelope = validate_message_envelope(
        {
            "type": "MSG",
            "msg_id": "123",
            "sender": "alice",
            "target": "general",
            "target_type": "room",
            "timestamp": 1,
            "payload": "abc",
        }
    )
    assert envelope.sender == "alice"


def test_validate_message_envelope_missing_fields() -> None:
    with pytest.raises(SchemaError):
        validate_message_envelope({"type": "MSG"})
