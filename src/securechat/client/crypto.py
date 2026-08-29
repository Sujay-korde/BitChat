from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass
from typing import Any, Mapping

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import x25519, ed25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


@dataclass(slots=True)
class KeyPair:
    private_key: x25519.X25519PrivateKey
    public_key_bytes: bytes


class ChatCrypto:
    def __init__(self) -> None:
        self._identity_key = ed25519.Ed25519PrivateKey.generate()
        self._private_key = x25519.X25519PrivateKey.generate()
        self._public_key = self._private_key.public_key()

    @property
    def public_key_bytes(self) -> bytes:
        return self._public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )

    def get_key_exchange_payload(self, sender: str, target: str) -> str:
        identity_pub = self._identity_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        x25519_pub = self.public_key_bytes
        
        msg = b"SecureChat-Identity-Binding-V1" + sender.encode("utf-8") + target.encode("utf-8") + x25519_pub
        sig = self._identity_key.sign(msg)
        
        payload = {
            "identity_key": base64.b64encode(identity_pub).decode("ascii"),
            "ephemeral_key": base64.b64encode(x25519_pub).decode("ascii"),
            "signature": base64.b64encode(sig).decode("ascii")
        }
        return json.dumps(payload)

    def verify_and_derive_shared_key(self, sender: str, target: str, payload_json: str) -> bytes:
        data = json.loads(payload_json)
        identity_pub = base64.b64decode(data["identity_key"].encode("ascii"))
        ephemeral_pub = base64.b64decode(data["ephemeral_key"].encode("ascii"))
        sig = base64.b64decode(data["signature"].encode("ascii"))
        
        identity_key = ed25519.Ed25519PublicKey.from_public_bytes(identity_pub)
        msg = b"SecureChat-Identity-Binding-V1" + sender.encode("utf-8") + target.encode("utf-8") + ephemeral_pub
        
        identity_key.verify(sig, msg)
        
        return self.derive_shared_key(ephemeral_pub)

    def derive_shared_key(self, peer_public_key_bytes: bytes) -> bytes:
        peer_public_key = x25519.X25519PublicKey.from_public_bytes(peer_public_key_bytes)
        shared_secret = self._private_key.exchange(peer_public_key)
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b"securechat-aes-256-gcm",
        ).derive(shared_secret)

    @staticmethod
    def encrypt(shared_key: bytes, payload: Mapping[str, Any]) -> str:
        nonce = os.urandom(12)
        aesgcm = AESGCM(shared_key)
        ciphertext = aesgcm.encrypt(nonce, json.dumps(payload).encode("utf-8"), None)
        return base64.b64encode(nonce + ciphertext).decode("ascii")

    @staticmethod
    def decrypt(shared_key: bytes, payload_b64: str) -> dict[str, Any]:
        raw = base64.b64decode(payload_b64.encode("ascii"))
        nonce, ciphertext = raw[:12], raw[12:]
        aesgcm = AESGCM(shared_key)
        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        except InvalidTag as exc:
            raise ValueError("Message authentication failed") from exc
        return json.loads(plaintext.decode("utf-8"))
