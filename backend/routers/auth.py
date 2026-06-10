# backend/routers/auth.py

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
import pyotp

from backend.core.security import (
    verify_password,
    create_access_token,
    get_current_user,
    get_db,
    sanitize_response,
)
from backend.core.encryption import encrypt_secret, decrypt_secret
from backend.core.rate_limit import limiter
from backend.db.models import User
from backend.db.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
_repo = UserRepository()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)
    mfa_code: str | None = Field(default=None, min_length=6, max_length=8)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    mfa_enabled: bool = False
    created_at: str
    updated_at: str


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    enabled: bool


class MfaVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")  # Tight rate limit to prevent brute force attacks
def login(payload: LoginRequest, request: Request, db=Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = _repo.get_user_by_username(db, payload.username)
    ip = request.client.host if request.client else None

    # Constant-time guard: if no user, still run pwhash against a dummy hash so
    # response time is similar for both branches. Prevents username enumeration.
    if not user:
        verify_password(payload.password, _get_dummy_pwhash())
        _repo.log_audit(
            db,
            user_id=None,
            action="LOGIN_FAILURE",
            details=f"Failed login attempt for username: {payload.username}",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user.password_hash):
        _repo.log_audit(
            db,
            user_id=None,
            action="LOGIN_FAILURE",
            details=f"Failed login attempt for username: {payload.username}",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        _repo.log_audit(
            db,
            user_id=str(user.id),
            action="LOGIN_FAILURE",
            details=f"Inactive user attempt: {user.username}",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )

    if user.mfa_enabled:
        if not user.mfa_totp_secret:
            _repo.log_audit(
                db,
                user_id=str(user.id),
                action="LOGIN_FAILURE",
                details=f"MFA enabled without secret for user: {user.username}",
                ip_address=ip,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="MFA is misconfigured")
        if not payload.mfa_code:
            _repo.log_audit(
                db,
                user_id=str(user.id),
                action="MFA_REQUIRED",
                details=f"MFA required for user: {user.username}",
                ip_address=ip,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "MFA_REQUIRED", "message": "MFA code required"},
            )
        # Decrypt TOTP secret before verification.
        decrypted_totp = decrypt_secret(user.mfa_totp_secret)
        if not _verify_totp(decrypted_totp, payload.mfa_code):
            _repo.log_audit(
                db,
                user_id=str(user.id),
                action="MFA_FAILURE",
                details=f"Invalid MFA code for user: {user.username}",
                ip_address=ip,
            )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    # Enforce MFA for ADMIN role (defense in depth).
    if user.role and user.role.upper() == "ADMIN" and not user.mfa_enabled:
        _repo.log_audit(
            db,
            user_id=str(user.id),
            action="LOGIN_FAILURE",
            details=f"ADMIN user without MFA attempted login: {user.username}",
            ip_address=ip,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ADMIN users must enable MFA before logging in. Contact support.",
        )

    # Success: log audit
    _repo.log_audit(
        db,
        user_id=str(user.id),
        action="LOGIN_SUCCESS",
        details=f"Successful login for user: {user.username}",
        ip_address=ip
    )

    # Token payload: sub is username, include role
    token_data = {
        "sub": user.username,
        "role": user.role,
    }
    token = create_access_token(data=token_data)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/logout")
def logout(request: Request, db=Depends(get_db)):
    """Logout endpoint. Session-less token logout is handled client-side by deleting the token."""
    ip = request.client.host if request.client else None
    try:
        # Best effort attempt to audit logout if authorization is present
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # We don't raise exception on failure to keep logout endpoint safe
            from backend.core.security import decode_access_token
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                username = payload.get("sub")
                if username:
                    user = _repo.get_user_by_username(db, username)
                    if user:
                        _repo.log_audit(
                            db,
                            user_id=str(user.id),
                            action="LOGOUT",
                            details=f"User logout: {user.username}",
                            ip_address=ip
                        )
                        return {"status": "success", "message": "Successfully logged out"}
    except Exception as exc:
        logger.debug("Silent failure in audit log during logout: %s", exc)
        
    return {"status": "success", "message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user details."""
    # We return the user model converted to the schema response, but without password hash
    return sanitize_response({
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "mfa_enabled": bool(getattr(current_user, "mfa_enabled", False)),
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    })


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(current_user: User = Depends(get_current_user), db=Depends(get_db)):
    """Create or return a TOTP secret for the authenticated user."""
    user = _repo.get_user_by_username(db, current_user.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.mfa_totp_secret:
        raw_secret = pyotp.random_base32()
        user.mfa_totp_secret = encrypt_secret(raw_secret)
        user.updated_at = _utc_now()
        db.commit()
        db.refresh(user)

    # Always return the plaintext secret in the setup response (so the user
    # can scan it into their authenticator app) — but it's stored encrypted.
    decrypted_secret = decrypt_secret(user.mfa_totp_secret)

    return {
        "secret": decrypted_secret,
        "otpauth_url": pyotp.totp.TOTP(user.mfa_totp_secret).provisioning_uri(
            name=user.username,
            issuer_name="MAET Terminal",
        ),
        "enabled": bool(user.mfa_enabled),
    }


@router.post("/mfa/enable")
def enable_mfa(payload: MfaVerifyRequest, current_user: User = Depends(get_current_user), db=Depends(get_db)):
    """Enable MFA after the user proves they can generate a valid TOTP code."""
    user = _repo.get_user_by_username(db, current_user.username)
    if not user or not user.mfa_totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA setup required")
    if not _verify_totp(user.mfa_totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    user.mfa_enabled = True
    user.updated_at = _utc_now()
    db.commit()
    return {"status": "enabled"}


@router.post("/mfa/disable")
def disable_mfa(payload: MfaVerifyRequest, current_user: User = Depends(get_current_user), db=Depends(get_db)):
    """Disable MFA after the user confirms with a valid TOTP code."""
    user = _repo.get_user_by_username(db, current_user.username)
    if not user or not user.mfa_totp_secret or not user.mfa_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA is not enabled")
    if not _verify_totp(user.mfa_totp_secret, payload.code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    user.mfa_enabled = False
    user.mfa_totp_secret = None
    user.updated_at = _utc_now()
    db.commit()
    return {"status": "disabled"}


def _verify_totp(secret: str, code: str) -> bool:
    normalized = str(code or "").strip().replace(" ", "")
    return pyotp.TOTP(secret).verify(normalized, valid_window=1)


# Pre-computed dummy hash used to keep login response time constant when a
# username does not exist. Without this, an attacker can enumerate valid
# usernames by measuring response time (pwhash is ~50ms, dict miss is <1ms).
_DUMMY_PWHASH = None


def _get_dummy_pwhash():
    global _DUMMY_PWHASH
    if _DUMMY_PWHASH is None:
        from backend.core.security import hash_password
        _DUMMY_PWHASH = hash_password("dummy-do-not-use")
    return _DUMMY_PWHASH


def _utc_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
