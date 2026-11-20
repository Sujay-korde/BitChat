import os
import pytest


@pytest.fixture(autouse=True)
def setup_test_sqlite_env(monkeypatch):
    """Ensure all automated tests run against isolated in-memory SQLite instances."""
    monkeypatch.setenv("BITCHAT_DB_PATH", ":memory:")
