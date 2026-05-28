# backend/routers/auth.py

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from backend.core.security import (
    verify_password,
    create_access_token,
    get_current_user,
    get_db,
    sanitize_response,
)
from backend.db.models import User
from backend.db.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
_repo = UserRepository()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: str
    updated_at: str


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db=Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = _repo.get_user_by_username(db, payload.username)
    ip = request.client.host if request.client else None
    
    if not user or not verify_password(payload.password, user.password_hash):
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
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    })
