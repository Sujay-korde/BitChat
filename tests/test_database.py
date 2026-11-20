import os
import tempfile
import time
import pytest
from securechat.server.database import ChatDatabase


def test_database_init_and_tables():
    db = ChatDatabase(":memory:")
    stats = db.get_stats()
    assert stats["users"] == 0
    assert stats["messages"] == 0
    assert stats["rooms"] == 0
    assert stats["media_blobs"] == 0
    db.close()


def test_user_upsert_and_retrieval():
    db = ChatDatabase(":memory:")
    db.upsert_user("Alice", identity_key="b64_pub_key_alice")
    user = db.get_user("alice")
    assert user is not None
    assert user["username"] == "alice"
    assert user["identity_key"] == "b64_pub_key_alice"
    assert user["created_at"] > 0
    assert user["last_seen"] > 0

    # Upsert again without identity_key preserves existing key and updates last_seen
    time.sleep(0.01)
    db.upsert_user("alice")
    user2 = db.get_user("alice")
    assert user2["identity_key"] == "b64_pub_key_alice"
    assert user2["last_seen"] >= user["last_seen"]

    db.close()


def test_room_membership_and_persistence():
    db = ChatDatabase(":memory:")
    db.join_room("dev", "alice")
    db.join_room("dev", "bob")
    db.join_room("general", "alice")

    members_dev = db.get_room_members("dev")
    assert "alice" in members_dev
    assert "bob" in members_dev

    alice_rooms = db.get_user_rooms("alice")
    assert "dev" in alice_rooms
    assert "general" in alice_rooms

    db.leave_room("dev", "bob")
    assert "bob" not in db.get_room_members("dev")

    db.close()


def test_message_storage_and_offline_queue():
    db = ChatDatabase(":memory:")
    # Direct message from alice to offline bob
    db.store_message(
        msg_id="m1",
        sender="alice",
        target="bob",
        target_type="user",
        ciphertext="encrypted_payload_1",
        timestamp=1000,
        is_delivered=False,
    )

    undelivered = db.get_undelivered_messages_for_user("bob")
    assert len(undelivered) == 1
    assert undelivered[0]["msg_id"] == "m1"
    assert undelivered[0]["ciphertext"] == "encrypted_payload_1"

    # Mark delivered
    db.mark_message_delivered("m1")
    undelivered_after = db.get_undelivered_messages_for_user("bob")
    assert len(undelivered_after) == 0

    # But message still exists in full conversation history!
    history = db.get_user_conversation_history("alice", "bob")
    assert len(history) == 1
    assert history[0]["msg_id"] == "m1"

    db.close()


def test_room_history():
    db = ChatDatabase(":memory:")
    for i in range(10):
        db.store_message(
            msg_id=f"room_m_{i}",
            sender="alice" if i % 2 == 0 else "bob",
            target="dev",
            target_type="room",
            ciphertext=f"ciphertext_{i}",
            timestamp=2000 + i,
            is_delivered=True,
        )

    history = db.get_room_message_history("dev", limit=5)
    assert len(history) == 5
    # Oldest first order
    assert history[0]["msg_id"] == "room_m_5"
    assert history[-1]["msg_id"] == "room_m_9"

    db.close()


def test_media_blob_metadata():
    db = ChatDatabase(":memory:")
    blob_id = "test-uuid-blob-123"
    db.store_media_blob(blob_id, 1024 * 50)

    blob = db.get_media_blob(blob_id)
    assert blob is not None
    assert blob["blob_id"] == blob_id
    assert blob["file_size"] == 51200
    assert blob["uploaded_at"] > 0

    stats = db.get_stats()
    assert stats["media_blobs"] == 1

    db.close()
