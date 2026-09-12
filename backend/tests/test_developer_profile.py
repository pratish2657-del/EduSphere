"""Developer profile and Super Admin verification service tests."""

import pytest

from app.core.exceptions import ForbiddenError
from app.services import developer_profile_service


def test_require_verified_developer_blocks_pending(monkeypatch):
    class Cursor:
        def execute(self, *_args):
            pass

        def fetchone(self):
            return {
                "id": 10,
                "email": "dev@example.com",
                "full_name": "Developer",
                "role_id": 3,
                "profile_completed": True,
                "verification_status": "PENDING",
                "is_active": 1,
                "is_super_admin": 0,
                "role": "DEVELOPER",
            }

    class Connection:
        def cursor(self):
            return Cursor()

        def close(self):
            pass

    monkeypatch.setattr(
        developer_profile_service,
        "get_connection",
        lambda: Connection(),
    )

    with pytest.raises(ForbiddenError, match="requires Super Admin verification"):
        developer_profile_service.require_verified_developer(10)
