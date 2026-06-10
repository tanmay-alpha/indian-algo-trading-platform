# tests/test_auth_endpoints.py

import os
import tempfile
import pytest
import pyotp
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.config import settings
from backend.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_db,
    get_current_user,
    require_admin_token,
    RoleChecker,
)
from backend.db.models import Base, User, AuditLog
from backend.db.repositories.user_repository import UserRepository
from backend.routers import auth as auth_module

# Setup a clean file-backed sqlite database per test run for thread safety
@pytest.fixture(name="db_engine")
def db_engine_fixture():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    
    engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    try:
        os.unlink(path)
    except Exception:
        pass


@pytest.fixture(name="db_session")
def db_session_fixture(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(name="app_client")
def app_client_fixture(db_engine):
    app = FastAPI()
    app.include_router(auth_module.router)

    # Protected routes to test RoleChecker and require_admin_token
    @app.get("/admin-only")
    def admin_only(current_user: User = Depends(RoleChecker(["ADMIN"]))):
        return {"status": "ok", "user": current_user.username}

    @app.get("/viewer-or-admin")
    def viewer_or_admin(current_user: User = Depends(RoleChecker(["VIEWER", "ADMIN"]))):
        return {"status": "ok", "user": current_user.username}

    @app.get("/legacy-admin-only")
    def legacy_admin_route(admin=Depends(require_admin_token)):
        return {"status": "ok"}

    # Override get_db to return a session from our engine
    def override_get_db():
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    return client


# 1. Hashing Tests
def test_password_hashing_and_verification():
    raw_pass = "SecurePass123!"
    hashed = hash_password(raw_pass)
    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPass123!", hashed) is False


# 2. Login Tests
def test_login_success(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("correct-pass")
    user = repo.create_user(db_session, username="bob", password_hash=hashed, role="ADMIN")
    
    response = app_client.post("/auth/login", json={"username": "bob", "password": "correct-pass"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Verify audit log in db_session
    db_session.expire_all()
    audit_record = db_session.query(AuditLog).filter_by(action="LOGIN_SUCCESS").first()
    assert audit_record is not None
    assert audit_record.user_id == str(user.id)
    assert "bob" in audit_record.details


def test_login_bad_password(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("correct-pass")
    repo.create_user(db_session, username="alice", password_hash=hashed, role="VIEWER")
    
    response = app_client.post("/auth/login", json={"username": "alice", "password": "wrong-pass"})
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]

    # Verify audit log
    db_session.expire_all()
    audit_record = db_session.query(AuditLog).filter_by(action="LOGIN_FAILURE").first()
    assert audit_record is not None
    assert audit_record.user_id is None
    assert "alice" in audit_record.details


def test_login_inactive_user(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("correct-pass")
    user = repo.create_user(db_session, username="inactive_user", password_hash=hashed, role="VIEWER")
    user.is_active = False
    db_session.commit()

    response = app_client.post("/auth/login", json={"username": "inactive_user", "password": "correct-pass"})
    assert response.status_code == 400
    assert "Inactive user account" in response.json()["detail"]

    # Verify audit log
    db_session.expire_all()
    audit_record = db_session.query(AuditLog).filter_by(action="LOGIN_FAILURE").first()
    assert audit_record is not None
    assert audit_record.user_id == str(user.id)
    assert "Inactive user" in audit_record.details


def test_login_requires_mfa_when_enabled(app_client, db_session):
    repo = UserRepository()
    secret = pyotp.random_base32()
    user = repo.create_user(db_session, username="mfa_user", password_hash=hash_password("correct-pass"), role="ADMIN")
    user.mfa_enabled = True
    user.mfa_totp_secret = secret
    db_session.commit()

    response = app_client.post("/auth/login", json={"username": "mfa_user", "password": "correct-pass"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "MFA_REQUIRED"

    code = pyotp.TOTP(secret).now()
    response = app_client.post(
        "/auth/login",
        json={"username": "mfa_user", "password": "correct-pass", "mfa_code": code},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_mfa_setup_enable_disable_flow(app_client, db_session):
    repo = UserRepository()
    repo.create_user(db_session, username="secure_user", password_hash=hash_password("correct-pass"), role="ADMIN")
    login_resp = app_client.post("/auth/login", json={"username": "secure_user", "password": "correct-pass"})
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    setup_resp = app_client.post("/auth/mfa/setup", headers=headers)
    assert setup_resp.status_code == 200
    secret = setup_resp.json()["secret"]
    assert setup_resp.json()["enabled"] is False

    code = pyotp.TOTP(secret).now()
    enable_resp = app_client.post("/auth/mfa/enable", json={"code": code}, headers=headers)
    assert enable_resp.status_code == 200
    assert enable_resp.json()["status"] == "enabled"

    login_mfa_resp = app_client.post(
        "/auth/login",
        json={"username": "secure_user", "password": "correct-pass", "mfa_code": pyotp.TOTP(secret).now()},
    )
    assert login_mfa_resp.status_code == 200

    disable_resp = app_client.post("/auth/mfa/disable", json={"code": pyotp.TOTP(secret).now()}, headers=headers)
    assert disable_resp.status_code == 200
    assert disable_resp.json()["status"] == "disabled"


# 3. GET /auth/me Tests
def test_get_me_success(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("my-pass")
    user = repo.create_user(db_session, username="carol", password_hash=hashed, role="VIEWER")

    # Log in to get token
    login_resp = app_client.post("/auth/login", json={"username": "carol", "password": "my-pass"})
    token = login_resp.json()["access_token"]

    # Call /me
    response = app_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "carol"
    assert data["role"] == "VIEWER"
    assert data["is_active"] is True
    assert "password_hash" not in data  # No secrets leak!
    assert "password" not in data


def test_get_me_invalid_token(app_client):
    response = app_client.get("/auth/me", headers={"Authorization": "Bearer invalid-jwt-sig"})
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]


def test_get_me_expired_token(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("my-pass")
    repo.create_user(db_session, username="carol", password_hash=hashed, role="VIEWER")

    # Generate token that is already expired
    token = create_access_token(data={"sub": "carol", "role": "VIEWER"}, expires_delta=timedelta(minutes=-5))

    response = app_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]


# 4. POST /auth/logout Tests
def test_logout_success(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("my-pass")
    user = repo.create_user(db_session, username="dave", password_hash=hashed, role="VIEWER")

    # Log in
    login_resp = app_client.post("/auth/login", json={"username": "dave", "password": "my-pass"})
    token = login_resp.json()["access_token"]

    # Call logout
    response = app_client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify audit log
    db_session.expire_all()
    audit_record = db_session.query(AuditLog).filter_by(action="LOGOUT").first()
    assert audit_record is not None
    assert audit_record.user_id == str(user.id)
    assert "dave" in audit_record.details


# 5. Role and Authorization Security Tests
def test_role_checker_admin_only_routes(app_client, db_session):
    repo = UserRepository()
    hashed = hash_password("pass")
    
    # 1. Create ADMIN user
    admin_user = repo.create_user(db_session, username="admin1", password_hash=hashed, role="ADMIN")
    admin_token = create_access_token(data={"sub": "admin1", "role": "ADMIN"})

    # 2. Create VIEWER user
    viewer_user = repo.create_user(db_session, username="viewer1", password_hash=hashed, role="VIEWER")
    viewer_token = create_access_token(data={"sub": "viewer1", "role": "VIEWER"})

    # Admin access to /admin-only
    resp = app_client.get("/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert resp.json()["user"] == "admin1"

    # Viewer access to /admin-only is FORBIDDEN
    resp = app_client.get("/admin-only", headers={"Authorization": f"Bearer {viewer_token}"})
    assert resp.status_code == 403
    assert "is not authorized for this resource" in resp.json()["detail"]

    # Viewer access to /viewer-or-admin is ALLOWED
    resp = app_client.get("/viewer-or-admin", headers={"Authorization": f"Bearer {viewer_token}"})
    assert resp.status_code == 200
    assert resp.json()["user"] == "viewer1"


# 6. Legacy X-Admin-Token Fallback Tests
def test_legacy_admin_token_authentication(app_client, monkeypatch):
    # Set standard admin token secret
    monkeypatch.setattr(settings, "admin_token", "super-secret-admin-token")

    # Test with correct admin token
    response = app_client.get("/legacy-admin-only", headers={"X-Admin-Token": "super-secret-admin-token"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    # Test with wrong admin token
    response = app_client.get("/legacy-admin-only", headers={"X-Admin-Token": "wrong-secret-token"})
    assert response.status_code == 403
