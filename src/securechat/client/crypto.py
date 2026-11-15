from __future__ import annotations

import base64
import json
import os
import struct
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
        self.peer_identity_keys: dict[str, bytes] = {}

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
        
        # TOFU: Trust On First Use during session
        if sender in self.peer_identity_keys:
            if self.peer_identity_keys[sender] != identity_pub:
                raise ValueError("Identity key mismatch (potential MITM)")
        else:
            self.peer_identity_keys[sender] = identity_pub
            
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
    def encrypt(shared_key: bytes, payload: Mapping[str, Any], aad: bytes | None = None) -> str:
        nonce = os.urandom(12)
        aesgcm = AESGCM(shared_key)
        ciphertext = aesgcm.encrypt(nonce, json.dumps(payload).encode("utf-8"), aad)
        return base64.b64encode(nonce + ciphertext).decode("ascii")

    @staticmethod
    def decrypt(shared_key: bytes, payload_b64: str, aad: bytes | None = None) -> dict[str, Any]:
        raw = base64.b64decode(payload_b64.encode("ascii"))
        nonce, ciphertext = raw[:12], raw[12:]
        aesgcm = AESGCM(shared_key)
        try:
            plaintext = aesgcm.decrypt(nonce, ciphertext, aad)
        except InvalidTag as exc:
            raise ValueError("Message authentication failed") from exc
        return json.loads(plaintext.decode("utf-8"))

    @property
    def identity_public_key_bytes(self) -> bytes:
        return self._identity_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )

    def sign_auth_payload(self, username: str, timestamp: int) -> dict[str, str]:
        ident_pub_b64 = base64.b64encode(self.identity_public_key_bytes).decode("ascii")
        context = b"SecureChat-Auth-V1:" + username.encode("utf-8") + b":" + str(timestamp).encode("utf-8")
        sig = self._identity_key.sign(context)
        return {
            "username": username,
            "identity_key": ident_pub_b64,
            "signature": base64.b64encode(sig).decode("ascii"),
            "timestamp": str(timestamp)
        }

    @staticmethod
    def verify_auth_signature(username: str, timestamp: int, identity_key_b64: str, signature_b64: str) -> bool:
        try:
            pub_bytes = base64.b64decode(identity_key_b64.encode("ascii"))
            sig_bytes = base64.b64decode(signature_b64.encode("ascii"))
            pub_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
            context = b"SecureChat-Auth-V1:" + username.encode("utf-8") + b":" + str(timestamp).encode("utf-8")
            pub_key.verify(sig_bytes, context)
            return True
        except Exception:
            return False

    @staticmethod
    def get_fingerprint(identity_key_b64: str) -> str:
        """Derive an out-of-band visual verification fingerprint (groups of 4 hex chars)."""
        pub_bytes = base64.b64decode(identity_key_b64.encode("ascii"))
        digest = hashes.Hash(hashes.SHA256())
        digest.update(pub_bytes)
        hex_digest = digest.finalize().hex().upper()
        return " ".join(hex_digest[i:i+4] for i in range(0, 24, 4))

    @staticmethod
    def encrypt_attachment(file_bytes: bytes, file_name: str, mime_type: str) -> tuple[bytes, dict[str, Any]]:
        raw_key = os.urandom(32)
        iv = os.urandom(12)
        
        digest = hashes.Hash(hashes.SHA256())
        digest.update(file_bytes)
        sha256_hex = digest.finalize().hex()

        aesgcm = AESGCM(raw_key)
        ciphertext = aesgcm.encrypt(iv, file_bytes, None)

        descriptor = {
            "type": "attachment",
            "key": base64.b64encode(raw_key).decode("ascii"),
            "iv": base64.b64encode(iv).decode("ascii"),
            "sha256": sha256_hex,
            "file_name": file_name,
            "mime_type": mime_type,
            "size": len(file_bytes)
        }
        return ciphertext, descriptor

    @staticmethod
    def decrypt_attachment(ciphertext: bytes, key_b64: str, iv_b64: str, expected_sha256: str) -> bytes:
        raw_key = base64.b64decode(key_b64.encode("ascii"))
        iv = base64.b64decode(iv_b64.encode("ascii"))
        
        aesgcm = AESGCM(raw_key)
        try:
            plaintext = aesgcm.decrypt(iv, ciphertext, None)
        except InvalidTag as exc:
            raise ValueError("Attachment decryption failed: bad key or tampered ciphertext") from exc

        digest = hashes.Hash(hashes.SHA256())
        digest.update(plaintext)
        computed_sha256 = digest.finalize().hex()

        if computed_sha256 != expected_sha256:
            raise ValueError("Attachment integrity check failed: SHA-256 mismatch")

        return plaintext

    @staticmethod
    def build_aad(protocol_version: int, msg_type: str, target_type: str, target: str, key_version: int, sender: str, sequence: int) -> bytes:
        aad = bytearray([protocol_version])
        aad += msg_type.encode("utf-8")
        aad += target_type.encode("utf-8")
        aad += target.encode("utf-8")
        aad += struct.pack(">I", key_version)
        aad += sender.encode("utf-8")
        aad += struct.pack(">Q", sequence)
        return bytes(aad)
