"""安全工具：argon2id 密码哈希、JWT 签发/校验（access 2h + refresh 8h，ADR-005/006）。

说明：文档规定 sha256+salt 属旧版兼容，新库直接使用 argon2id；
  staff.salt 字段保留为 ''（新账号），旧账号 lazily 迁移为 argon2。
"""

import base64
import hashlib
import hmac
import os
import time
import uuid
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from .config import settings

_ph = PasswordHasher()
ACCESS_TOKEN_TTL = 2 * 60 * 60          # 2 小时
REFRESH_TOKEN_TTL = 8 * 60 * 60         # 8 小时


# ---------- 敏感信息 AES-256-GCM（ADR-009，§5 身份证加密） ----------
def _id_card_key_bytes() -> bytes:
    """取 32 字节 AES 密钥：优先 ID_CARD_KEY_B64；未配置从 JWT_SECRET 派生（开发兜底）。"""
    b64 = settings.ID_CARD_KEY_B64
    if b64:
        key = base64.b64decode(b64)
        if len(key) == 32:
            return key
    # 派生：sha256(JWT_SECRET) → 32 字节（仅开发环境使用；生产须显式配置 ID_CARD_KEY_B64）
    return hashlib.sha256(settings.JWT_SECRET.encode()).digest()


def encrypt_id_card(plain: str) -> tuple[str, str]:
    """AES-256-GCM 加密身份证 → (enc_b64, nonce_b64)。nonce 12 字节随机。"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = _id_card_key_bytes()
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plain.encode("utf-8"), None)
    return base64.b64encode(ct).decode(), base64.b64encode(nonce).decode()


def decrypt_id_card(enc_b64: str, nonce_b64: str) -> str:
    """解密身份证明文。密钥错误/篡改抛 InvalidTag。"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = _id_card_key_bytes()
    ct = base64.b64decode(enc_b64)
    nonce = base64.b64decode(nonce_b64)
    return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")


def mask_id_card(plain: str | None) -> str | None:
    """脱敏：保留前 3 后 4，中间打星（110***********1234）。空值返回 None。"""
    if not plain:
        return None
    if len(plain) <= 7:
        return plain[0] + "****"
    return plain[:3] + "*" * (len(plain) - 7) + plain[-4:]


# ---------- 密码 ----------
def hash_password(plain: str) -> str:
    """新账号统一 argon2id（自含盐）。"""
    return _ph.hash(plain)


def verify_password(plain: str, password_hash: str, salt: str = "") -> bool:
    """先按 argon2id 校验；若为旧 sha256+salt 格式则做兼容校验并标记需迁移。"""
    try:
        return _ph.verify(password_hash, plain)
    except (VerifyMismatchError, Exception) as _e:
        # 旧格式 sha256(salt + plain)
        if salt and password_hash == hashlib.sha256((salt + plain).encode()).hexdigest():
            return True
        return False


def needs_rehash(password_hash: str) -> bool:
    """旧 sha256 哈希需要懒迁移为新 argon2。"""
    return not password_hash.startswith("$argon2")


# ---------- JWT ----------
def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    return _create_token(subject, ACCESS_TOKEN_TTL, "access", extra)


def create_refresh_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    return _create_token(subject, REFRESH_TOKEN_TTL, "refresh", extra)


def _create_token(subject: str, ttl: int, token_type: str, extra: dict[str, Any] | None = None) -> str:
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        # jti 保证每次签发唯一，避免同秒并发刷新时 token 完全相同
        # → refresh_tokens.token_hash 唯一约束冲突（UniqueViolation）
        "jti": uuid.uuid4().hex,
        "iat": int(time.time()),
        "exp": int(time.time()) + ttl,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    """校验 JWT；可选限定 token 类型（access/refresh）。非法或过期抛 jwt.PyJWTError。"""
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected token type '{expected_type}'")
    return payload


def token_hash(token: str) -> str:
    """refresh_tokens.token_hash 存储用：SHA-256 十六进制（64 字符）。"""
    return hashlib.sha256(token.encode()).hexdigest()


def hmac_sign(message: str, secret: str) -> str:
    """通用 HMAC-SHA256 签名（用于简单防篡改场景）。"""
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()