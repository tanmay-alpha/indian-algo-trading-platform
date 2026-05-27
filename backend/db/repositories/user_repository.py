# backend/db/repositories/user_repository.py
import logging
from datetime import datetime, timezone
from typing import Optional
from backend.db.models import User, AuditLog

logger = logging.getLogger(__name__)

def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

class UserRepository:
    def create_user(self, session, username: str, password_hash: str, role: str = "VIEWER") -> User:
        now = _utc_now()
        user = User(
            username=username.strip(),
            password_hash=password_hash,
            role=role.strip().upper(),
            is_active=True,
            created_at=now,
            updated_at=now
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    def get_user_by_username(self, session, username: str) -> Optional[User]:
        return session.query(User).filter(User.username == username.strip()).first()

    def get_user_by_id(self, session, user_id: int) -> Optional[User]:
        return session.query(User).filter(User.id == user_id).first()

    def log_audit(self, session, user_id: Optional[str], action: str, details: Optional[str] = None, ip_address: Optional[str] = None) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address,
            created_at=_utc_now()
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        return log
