# SecureChat

SecureChat is a Python 3.11+ client-server chat application built around a custom length-prefixed TCP protocol, client-side moderation, and end-to-end encryption.

## Current structure

- `src/securechat/protocol` — framing and message validation
- `src/securechat/server` — asyncio server, router, rooms, presence, session state
- `src/securechat/client` — connection manager, crypto, CLI entrypoint
- `src/securechat/moderation` — local moderation classifier
- `tests` — protocol and moderation tests

## Install

```bash
pip install -e .
```

For developer tooling and tests:

```bash
pip install -e .[dev]
```

Optional ML baseline dependencies:

```bash
pip install -e .[ml]
```

## Run

Start the server:

```bash
python -m securechat.server.main
```

Start the client:

```bash
python -m securechat.client.main
```
