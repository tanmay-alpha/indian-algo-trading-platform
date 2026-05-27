#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.core.config import settings
from backend.core.database import get_database_url, redact_db_url, sanitize_db_error
from alembic.config import Config
from alembic import command

def run_migration():
    # Load alembic configuration from alembic.ini
    ini_path = ROOT / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    
    # Overwrite the sqlalchemy.url dynamically using get_database_url()
    # This prevents storing credentials in alembic.ini or printing them.
    db_url = get_database_url()
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    
    # Check command-line arguments
    cmd = "upgrade"
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
    print(f"[DB MIGRATE] Running database command: '{cmd}' on '{redact_db_url(db_url)}'")
    
    try:
        if cmd == "upgrade":
            command.upgrade(alembic_cfg, "head")
            print("[DB MIGRATE] Successfully ran database upgrade to head.")
        elif cmd == "current":
            command.current(alembic_cfg)
        elif cmd == "history":
            command.history(alembic_cfg)
        else:
            print(f"[DB MIGRATE] Unknown command: '{cmd}'")
            print("[DB MIGRATE] Supported commands: upgrade, current, history")
            sys.exit(1)
    except Exception as e:
        sanitized_err = sanitize_db_error(str(e), db_url)
        print(f"[DB MIGRATE] ERROR: Database operation failed: {sanitized_err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
