from securechat.protocol.framing import decode_frame, encode_frame


def test_frame_round_trip() -> None:
    message = {"type": "PING", "payload": "hello"}
    frame = encode_frame(message)
    assert decode_frame(frame) == message
