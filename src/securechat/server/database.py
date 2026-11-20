from __future__ import annotations

import logging
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("securechat.database")


class ChatDatabase:
    """SQLite relational database for BitChat backend.
    
    Provides persistent storage for users, zero-knowledge encrypted messages,
    room memberships, and media metadata with full foreign-key constraints
    and WAL journal mode for high concurrency.
    """

    def __init__(self, db_path: str = "bitchat.db") -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        if db_path != ":memory:":
            db_dir = Path(db_path).parent
            if db_dir and not db_dir.exists():
                db_dir.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(
            self.db_path,
            check_same_thread=False,
            timeout=10.0,
        )
        self._conn.row_factory = sqlite3.Row
        self._init_pragmas()
        self.init_db()

    def _init_pragmas(self) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("PRAGMA foreign_keys = ON;")
            if self.db_path != ":memory:":
                cur.execute("PRAGMA journal_mode = WAL;")
                cur.execute("PRAGMA synchronous = NORMAL;")
            cur.close()

    def init_db(self) -> None:
        """Create relational tables, indexes, and constraints if they do not exist."""
        with self._lock:
            cur = self._conn.cursor()
            cur.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    identity_key TEXT,
                    created_at INTEGER NOT NULL,
                    last_seen INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS rooms (
                    room_name TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS room_members (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    room_name TEXT NOT NULL,
                    username TEXT NOT NULL,
                    joined_at INTEGER NOT NULL,
                    UNIQUE(room_name, username),
                    FOREIGN KEY(room_name) REFERENCES rooms(room_name) ON DELETE CASCADE,
                    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS messages (
                    msg_id TEXT PRIMARY KEY,
                    sender TEXT NOT NULL,
                    target TEXT NOT NULL,
                    target_type TEXT NOT NULL CHECK(target_type IN ('user', 'room')),
                    ciphertext TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    is_delivered INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(sender) REFERENCES users(username) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_target ON messages(target, target_type);
                CREATE INDEX IF NOT EXISTS idx_messages_undelivered ON messages(target, is_delivered) WHERE target_type = 'user';
                CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

                CREATE TABLE IF NOT EXISTS media_blobs (
                    blob_id TEXT PRIMARY KEY,
                    file_size INTEGER NOT NULL,
                    uploaded_at INTEGER NOT NULL
                );
                """
            )
            self._conn.commit()
            cur.close()
            logger.info("Initialized SQLite database schema at %s", self.db_path)

    # ------------------------------------------------------------------ #
    # User Management
    # ------------------------------------------------------------------ #

    def upsert_user(self, username: str, identity_key: str | None = None) -> None:
        """Insert or update user record and refresh last_seen timestamp."""
        now = int(time.time())
        norm_user = username.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            if identity_key:
                cur.execute(
                    """
                    INSERT INTO users (username, identity_key, created_at, last_seen)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(username) DO UPDATE SET
                        identity_key = excluded.identity_key,
                        last_seen = excluded.last_seen;
                    """,
                    (norm_user, identity_key, now, now),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO users (username, identity_key, created_at, last_seen)
                    VALUES (?, NULL, ?, ?)
                    ON CONFLICT(username) DO UPDATE SET
                        last_seen = excluded.last_seen;
                    """,
                    (norm_user, now, now),
                )
            self._conn.commit()
            cur.close()

    def update_last_seen(self, username: str) -> None:
        """Update last_seen timestamp for a user."""
        norm_user = username.strip().lstrip("@").lower()
        now = int(time.time())
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("UPDATE users SET last_seen = ? WHERE username = ?;", (now, norm_user))
            self._conn.commit()
            cur.close()

    def get_user(self, username: str) -> dict[str, Any] | None:
        norm_user = username.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT * FROM users WHERE username = ?;", (norm_user,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None

    def list_users(self) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT username, identity_key, created_at, last_seen FROM users ORDER BY last_seen DESC;")
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            return rows

    # ------------------------------------------------------------------ #
    # Message Persistence (Zero-Knowledge Ciphertexts)
    # ------------------------------------------------------------------ #

    def store_message(
        self,
        msg_id: str,
        sender: str,
        target: str,
        target_type: str,
        ciphertext: str,
        timestamp: int | None = None,
        is_delivered: bool = False,
    ) -> None:
        """Store an end-to-end encrypted message ciphertext."""
        norm_sender = sender.strip().lstrip("@").lower()
        norm_target = target.strip().lstrip("#@").lower()
        norm_type = target_type.lower()
        ts = timestamp if timestamp is not None else int(time.time())
        delivered_int = 1 if is_delivered else 0

        # Ensure sender exists in users table to satisfy foreign key
        self.upsert_user(norm_sender)

        # If it's a room message, ensure room exists
        if norm_type == "room":
            self.ensure_room(norm_target)

        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                INSERT OR REPLACE INTO messages (msg_id, sender, target, target_type, ciphertext, timestamp, is_delivered)
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (msg_id, norm_sender, norm_target, norm_type, ciphertext, ts, delivered_int),
            )
            self._conn.commit()
            cur.close()

    def mark_message_delivered(self, msg_id: str) -> None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("UPDATE messages SET is_delivered = 1 WHERE msg_id = ?;", (msg_id,))
            self._conn.commit()
            cur.close()

    def get_undelivered_messages_for_user(self, username: str) -> list[dict[str, Any]]:
        """Fetch all queued offline messages for a recipient in chronological order."""
        norm_user = username.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                SELECT msg_id, sender, target, target_type, ciphertext, timestamp
                FROM messages
                WHERE target = ? AND target_type = 'user' AND is_delivered = 0
                ORDER BY timestamp ASC, rowid ASC;
                """,
                (norm_user,),
            )
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            return rows

    def get_room_message_history(self, room_name: str, limit: int = 50) -> list[dict[str, Any]]:
        """Fetch recent room message history ordered chronologically."""
        norm_room = room_name.strip().lstrip("#@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                SELECT msg_id, sender, target, target_type, ciphertext, timestamp
                FROM messages
                WHERE target = ? AND target_type = 'room'
                ORDER BY timestamp DESC, rowid DESC
                LIMIT ?;
                """,
                (norm_room, limit),
            )
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            rows.reverse()
            return rows

    def get_user_conversation_history(self, user_a: str, user_b: str, limit: int = 100) -> list[dict[str, Any]]:
        """Fetch past direct message history between two users."""
        u1 = user_a.strip().lstrip("@").lower()
        u2 = user_b.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                SELECT msg_id, sender, target, target_type, ciphertext, timestamp, is_delivered
                FROM messages
                WHERE target_type = 'user' AND ((sender = ? AND target = ?) OR (sender = ? AND target = ?))
                ORDER BY timestamp ASC
                LIMIT ?;
                """,
                (u1, u2, u2, u1, limit),
            )
            rows = [dict(r) for r in cur.fetchall()]
            cur.close()
            return rows

    # ------------------------------------------------------------------ #
    # Room Management & Memberships
    # ------------------------------------------------------------------ #

    def ensure_room(self, room_name: str) -> None:
        norm_room = room_name.strip().lstrip("#@").lower()
        now = int(time.time())
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("INSERT OR IGNORE INTO rooms (room_name, created_at) VALUES (?, ?);", (norm_room, now))
            self._conn.commit()
            cur.close()

    def join_room(self, room_name: str, username: str) -> None:
        norm_room = room_name.strip().lstrip("#@").lower()
        norm_user = username.strip().lstrip("@").lower()
        self.upsert_user(norm_user)
        self.ensure_room(norm_room)
        now = int(time.time())
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                INSERT INTO room_members (room_name, username, joined_at)
                VALUES (?, ?, ?)
                ON CONFLICT(room_name, username) DO UPDATE SET joined_at = excluded.joined_at;
                """,
                (norm_room, norm_user, now),
            )
            self._conn.commit()
            cur.close()

    def leave_room(self, room_name: str, username: str) -> None:
        norm_room = room_name.strip().lstrip("#@").lower()
        norm_user = username.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("DELETE FROM room_members WHERE room_name = ? AND username = ?;", (norm_room, norm_user))
            self._conn.commit()
            cur.close()

    def get_room_members(self, room_name: str) -> list[str]:
        norm_room = room_name.strip().lstrip("#@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT username FROM room_members WHERE room_name = ? ORDER BY joined_at ASC;", (norm_room,))
            members = [r["username"] for r in cur.fetchall()]
            cur.close()
            return members

    def get_user_rooms(self, username: str) -> list[str]:
        norm_user = username.strip().lstrip("@").lower()
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT room_name FROM room_members WHERE username = ? ORDER BY joined_at ASC;", (norm_user,))
            rooms = [r["room_name"] for r in cur.fetchall()]
            cur.close()
            return rooms

    # ------------------------------------------------------------------ #
    # Media Blob Tracking
    # ------------------------------------------------------------------ #

    def store_media_blob(self, blob_id: str, file_size: int) -> None:
        now = int(time.time())
        with self._lock:
            cur = self._conn.cursor()
            cur.execute(
                """
                INSERT OR REPLACE INTO media_blobs (blob_id, file_size, uploaded_at)
                VALUES (?, ?, ?);
                """,
                (blob_id, file_size, now),
            )
            self._conn.commit()
            cur.close()

    def get_media_blob(self, blob_id: str) -> dict[str, Any] | None:
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT * FROM media_blobs WHERE blob_id = ?;", (blob_id,))
            row = cur.fetchone()
            cur.close()
            return dict(row) if row else None

    # ------------------------------------------------------------------ #
    # Database Diagnostics / Professor Stats
    # ------------------------------------------------------------------ #

    def get_stats(self) -> dict[str, int]:
        """Return relational table metrics for demonstration and debugging."""
        with self._lock:
            cur = self._conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users;")
            users_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM messages;")
            messages_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM rooms;")
            rooms_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM media_blobs;")
            blobs_count = cur.fetchone()[0]
            cur.close()
            return {
                "users": users_count,
                "messages": messages_count,
                "rooms": rooms_count,
                "media_blobs": blobs_count,
            }

    def close(self) -> None:
        with self._lock:
            try:
                self._conn.close()
            except Exception:
                pass


def print_database_diagnostics(db_path: str = "bitchat.db") -> None:
    """CLI utility to inspect SQLite database metrics and records for professor demonstrations."""
    db = ChatDatabase(db_path)
    stats = db.get_stats()
    users = db.list_users()

    print("=" * 64)
    print("           BitChat SQLite Relational Database Overview")
    print("=" * 64)
    print(f"Database File: {Path(db_path).resolve()}")
    print("Relational Engine: SQLite 3 (WAL Journal Mode, Foreign Keys: ON)\n")

    print(f"--- Table Statistics ---")
    print(f"  • Users Table:        {stats['users']} records")
    print(f"  • Messages Table:     {stats['messages']} encrypted records (E2EE Zero-Knowledge)")
    print(f"  • Rooms Table:        {stats['rooms']} channels")
    print(f"  • Media Blobs Table:  {stats['media_blobs']} metadata records\n")

    if users:
        print("--- Registered Users & Last Seen ---")
        for u in users[:10]:
            seen_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(u['last_seen']))
            ident = (u['identity_key'][:16] + "...") if u['identity_key'] else "None"
            print(f"  • User: @{u['username']:<15} | Last Seen: {seen_str} | Identity Key: {ident}")
        print()

    # Query last 10 messages
    with db._lock:
        cur = db._conn.cursor()
        cur.execute(
            """
            SELECT msg_id, sender, target, target_type, length(ciphertext) as cipher_len, timestamp, is_delivered
            FROM messages
            ORDER BY timestamp DESC
            LIMIT 10;
            """
        )
        recent_msgs = cur.fetchall()
        cur.close()

    if recent_msgs:
        print("--- Recent Ciphertext Messages (Zero-Knowledge) ---")
        for m in recent_msgs:
            t_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(m['timestamp']))
            target_disp = f"#{m['target']}" if m['target_type'] == 'room' else f"@{m['target']}"
            deliv_str = "Delivered" if m['is_delivered'] else "Pending (Offline Queue)"
            print(f"  [{t_str}] {m['sender']} -> {target_disp:<12} ({m['cipher_len']} bytes ciphertext) [{deliv_str}]")
        print()

    print("=" * 64)
    db.close()


if __name__ == "__main__":
    import sys
    target_path = sys.argv[1] if len(sys.argv) > 1 else "bitchat.db"
    print_database_diagnostics(target_path)
