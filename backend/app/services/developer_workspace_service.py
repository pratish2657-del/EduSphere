"""Developer workspace service.

The database remains the source of truth for saved developer files.
When a separate browser-IDE service is configured, IDE sync/export is performed
over a private service-to-service API instead of assuming that the FastAPI
container shares a filesystem with the IDE container.
"""
import json
import os
import re
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

ALLOWED_EXTENSIONS = {
    ".py", ".c", ".cpp", ".h", ".hpp", ".java", ".js", ".jsx", ".ts", ".tsx",
    ".css", ".html", ".json", ".sql", ".md", ".xml", ".yml", ".yaml", ".sh",
    ".txt", ".go", ".rs", ".php", ".kt", ".swift",
}
MAX_CODE_SIZE = 2 * 1024 * 1024
_SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
UPLOAD_DIR = os.path.join(
    os.getenv("EDUSPHERE_DEVELOPER_UPLOAD_DIR", "private_uploads"),
    "developer_workspace",
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# If the IDE is a separate Render service, set both variables.
IDE_INTERNAL_URL = os.getenv("DEVELOPER_IDE_INTERNAL_URL", "").rstrip("/")
IDE_SHARED_SECRET = os.getenv("DEVELOPER_IDE_SHARED_SECRET", "")

# Local filesystem is only a fallback for a single-container/local deployment.
# Never use it as the primary cross-service sync mechanism.
IDE_WORKSPACE_ROOT = os.path.abspath(
    os.getenv(
        "EDUSPHERE_DEVELOPER_WORKSPACE_ROOT",
        os.path.join(os.getenv("TMPDIR", "/tmp"), "edusphere-developer-workspaces"),
    )
)


def _ide_dir(user_id):
    path = os.path.join(IDE_WORKSPACE_ROOT, str(int(user_id)))
    os.makedirs(path, exist_ok=True)
    return path


def _validate_filename(filename):
    filename = (filename or "").strip()
    if not filename or not _SAFE_NAME.fullmatch(filename):
        raise BadRequestError("Enter a valid filename such as helloworld.py")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestError(
            f"Unsupported file type: {ext or 'missing extension'}"
        )
    return filename


def _write_ide_file(user_id, filename, content):
    filename = _validate_filename(filename)
    with open(
        os.path.join(_ide_dir(user_id), filename),
        "w",
        encoding="utf-8",
        newline="",
    ) as handle:
        handle.write(content or "")


def _remove_ide_file(user_id, filename):
    try:
        os.remove(os.path.join(_ide_dir(user_id), filename))
    except FileNotFoundError:
        pass


def _developer(cursor, user_id, verified=True):
    cursor.execute(
        """
        SELECT u.id, u.email, u.full_name, u.is_active,
               u.verification_status, r.name AS role
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    user = cursor.fetchone()
    if not user:
        raise NotFoundError("Developer account not found")
    if not bool(user["is_active"]) or user["role"] != "DEVELOPER":
        raise ForbiddenError("Developer access required")
    if verified and user["verification_status"] != "VERIFIED":
        raise ForbiddenError(
            "Developer account requires Super Admin verification"
        )
    return user


def _super_admin(cursor, user_id):
    cursor.execute(
        """
        SELECT u.id, u.is_active, u.is_super_admin, r.name AS role
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    user = cursor.fetchone()
    if (
        not user
        or not bool(user["is_active"])
        or user["role"] != "SUPER_ADMIN"
        or not bool(user["is_super_admin"])
    ):
        raise ForbiddenError(
            "Only Super Admin can access developer submissions"
        )
    return user


def _ide_request(method, path, payload=None):
    if not IDE_INTERNAL_URL or not IDE_SHARED_SECRET:
        raise RuntimeError("Remote Developer IDE is not configured")

    body = None
    headers = {
        "Accept": "application/json",
        "X-EduSphere-IDE-Key": IDE_SHARED_SECRET,
    }
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = UrlRequest(
        f"{IDE_INTERNAL_URL}{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urlopen(request, timeout=15) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8") or "{}")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise BadRequestError(
            f"Developer IDE service returned HTTP {exc.code}: {detail[:500]}"
        ) from exc
    except URLError as exc:
        raise BadRequestError(
            "Developer IDE service is unavailable"
        ) from exc
    except TimeoutError as exc:
        raise BadRequestError(
            "Developer IDE service timed out"
        ) from exc


def _remote_ide_enabled():
    return bool(IDE_INTERNAL_URL and IDE_SHARED_SECRET)


def _sync_ide_remote_to_db(cursor, user_id):
    result = _ide_request(
        "GET",
        f"/api/edusphere/workspace/{int(user_id)}/files",
    )
    remote_files = result.get("files", [])
    synced = []
    skipped = []

    for item in remote_files:
        filename = item.get("filename")
        content = item.get("content", "")
        try:
            filename = _validate_filename(filename)
            if len(str(content).encode("utf-8")) > MAX_CODE_SIZE:
                skipped.append(
                    {"filename": str(filename), "reason": "File exceeds 2 MB"}
                )
                continue

            language = (
                os.path.splitext(filename)[1].lower().lstrip(".") or "text"
            )
            cursor.execute(
                """
                SELECT id
                FROM developer_code_files
                WHERE user_id = %s AND filename = %s
                LIMIT 1
                """,
                (user_id, filename),
            )
            existing = cursor.fetchone()

            if existing:
                cursor.execute(
                    """
                    UPDATE developer_code_files
                    SET content = %s, language = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (content, language, existing["id"]),
                )
                file_id = existing["id"]
            else:
                cursor.execute(
                    """
                    INSERT INTO developer_code_files
                    (user_id, filename, language, content)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, filename, language, content),
                )
                file_id = cursor.lastrowid

            synced.append(
                {"id": file_id, "filename": filename, "language": language}
            )
        except (BadRequestError, TypeError) as exc:
            skipped.append(
                {"filename": str(filename or ""), "reason": str(exc)}
            )

    return synced, skipped


def _sync_ide_local_to_db(cursor, user_id):
    synced = []
    skipped = []
    directory = _ide_dir(user_id)

    for entry in sorted(
        os.scandir(directory), key=lambda item: item.name.lower()
    ):
        if not entry.is_file():
            continue
        try:
            filename = _validate_filename(entry.name)
            size = os.path.getsize(entry.path)
            if size > MAX_CODE_SIZE:
                skipped.append(
                    {"filename": entry.name, "reason": "File exceeds 2 MB"}
                )
                continue
            with open(entry.path, "r", encoding="utf-8") as handle:
                content = handle.read()

            language = (
                os.path.splitext(filename)[1].lower().lstrip(".") or "text"
            )
            cursor.execute(
                """
                SELECT id
                FROM developer_code_files
                WHERE user_id = %s AND filename = %s
                LIMIT 1
                """,
                (user_id, filename),
            )
            existing = cursor.fetchone()

            if existing:
                cursor.execute(
                    """
                    UPDATE developer_code_files
                    SET content = %s, language = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (content, language, existing["id"]),
                )
                file_id = existing["id"]
            else:
                cursor.execute(
                    """
                    INSERT INTO developer_code_files
                    (user_id, filename, language, content)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, filename, language, content),
                )
                file_id = cursor.lastrowid

            synced.append(
                {"id": file_id, "filename": filename, "language": language}
            )
        except (UnicodeDecodeError, BadRequestError) as exc:
            skipped.append({"filename": entry.name, "reason": str(exc)})

    return synced, skipped


def get_file(user_id, file_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT id, filename, language, content, updated_at, created_at
            FROM developer_code_files
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (file_id, user_id),
        )
        row = cursor.fetchone()
        if not row:
            raise NotFoundError("Code file not found")
        return dict(row)
    finally:
        connection.close()


def list_files(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT id, filename, language, content, updated_at, created_at
            FROM developer_code_files
            WHERE user_id = %s
            ORDER BY updated_at DESC, id DESC
            """,
            (user_id,),
        )
        return {
            "developer_id": int(user_id),
            "files": [dict(row) for row in cursor.fetchall()],
        }
    finally:
        connection.close()


def save_file(user_id, filename, content):
    filename = _validate_filename(filename)
    content = content or ""
    if len(content.encode("utf-8")) > MAX_CODE_SIZE:
        raise BadRequestError("Code file exceeds the 2 MB limit")

    language = os.path.splitext(filename)[1].lower().lstrip(".") or "text"
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT id
            FROM developer_code_files
            WHERE user_id = %s AND filename = %s
            LIMIT 1
            """,
            (user_id, filename),
        )
        existing = cursor.fetchone()

        if existing:
            file_id = existing["id"]
            cursor.execute(
                """
                UPDATE developer_code_files
                SET content = %s, language = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (content, language, file_id),
            )
        else:
            cursor.execute(
                """
                INSERT INTO developer_code_files
                (user_id, filename, language, content)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, filename, language, content),
            )
            file_id = cursor.lastrowid

        connection.commit()

        if _remote_ide_enabled():
            _ide_request(
                "POST",
                f"/api/edusphere/workspace/{int(user_id)}/files",
                {
                    "files": [
                        {
                            "filename": filename,
                            "content": content,
                        }
                    ]
                },
            )
        else:
            _write_ide_file(user_id, filename, content)

        return {"message": "File saved", "file": get_file(user_id, file_id)}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def delete_file(user_id, file_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT filename
            FROM developer_code_files
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (file_id, user_id),
        )
        existing = cursor.fetchone()
        if not existing:
            raise NotFoundError("Code file not found")

        cursor.execute(
            """
            DELETE FROM developer_code_files
            WHERE id = %s AND user_id = %s
            """,
            (file_id, user_id),
        )
        connection.commit()

        if _remote_ide_enabled():
            _ide_request(
                "DELETE",
                f"/api/edusphere/workspace/{int(user_id)}/files/"
                f"{_validate_filename(existing['filename'])}",
            )
        else:
            _remove_ide_file(user_id, existing["filename"])

        return {"message": "File deleted"}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def sync_ide_to_db(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)

        if _remote_ide_enabled():
            synced, skipped = _sync_ide_remote_to_db(cursor, user_id)
        else:
            synced, skipped = _sync_ide_local_to_db(cursor, user_id)

        connection.commit()
        return {
            "message": "IDE files synced to EduSphere",
            "synced": synced,
            "skipped": skipped,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def sync_db_to_ide(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT id, filename, language, content
            FROM developer_code_files
            WHERE user_id = %s
            ORDER BY filename
            """,
            (user_id,),
        )
        rows = [dict(row) for row in cursor.fetchall()]

        if _remote_ide_enabled():
            result = _ide_request(
                "POST",
                f"/api/edusphere/workspace/{int(user_id)}/files",
                {
                    "files": [
                        {
                            "filename": row["filename"],
                            "content": row["content"] or "",
                        }
                        for row in rows
                    ]
                },
            )
            return {
                "message": "Saved EduSphere files exported to IDE",
                "exported": int(result.get("written", len(rows))),
            }

        directory = _ide_dir(user_id)
        for row in rows:
            _write_ide_file(user_id, row["filename"], row["content"] or "")
        return {
            "message": "Saved EduSphere files exported to IDE",
            "exported": len(rows),
            "path": directory,
        }
    finally:
        connection.close()


def submit_file(user_id, file_id, description):
    description = (description or "").strip()
    if not description:
        raise BadRequestError("Description is required for submission")
    if len(description) > 2000:
        raise BadRequestError("Description must be 2000 characters or fewer")

    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)
        cursor.execute(
            """
            SELECT id, filename, language, content
            FROM developer_code_files
            WHERE id = %s AND user_id = %s
            LIMIT 1
            """,
            (file_id, user_id),
        )
        file = cursor.fetchone()
        if not file:
            raise NotFoundError("Code file not found")

        cursor.execute(
            """
            SELECT id
            FROM developer_code_submissions
            WHERE file_id = %s AND status = 'PENDING'
            LIMIT 1
            """,
            (file_id,),
        )
        if cursor.fetchone():
            raise ConflictError("This file already has a pending submission")

        storage_path = os.path.join(
            UPLOAD_DIR,
            f'{uuid.uuid4().hex}_{file["filename"]}',
        )
        with open(storage_path, "w", encoding="utf-8") as handle:
            handle.write(file["content"] or "")

        cursor.execute(
            """
            INSERT INTO developer_code_submissions
            (file_id, developer_id, filename, language, description,
             content, storage_path, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'PENDING')
            """,
            (
                file["id"],
                user_id,
                file["filename"],
                file["language"],
                description,
                file["content"],
                storage_path,
            ),
        )
        submission_id = cursor.lastrowid
        connection.commit()
        return {
            "message": "File submitted to Super Admin",
            "submission_id": submission_id,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def list_submissions(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _developer(cursor, user_id, verified=False)
        cursor.execute(
            """
            SELECT id, file_id, filename, language, description, status,
                   remarks, submitted_at, reviewed_at
            FROM developer_code_submissions
            WHERE developer_id = %s
            ORDER BY submitted_at DESC, id DESC
            """,
            (user_id,),
        )
        return {"submissions": [dict(row) for row in cursor.fetchall()]}
    finally:
        connection.close()


def super_admin_submissions(super_admin_id, status=None):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        _super_admin(cursor, super_admin_id)
        query = """
            SELECT s.id, s.file_id, s.developer_id, s.filename,
                   s.language, s.description, s.content, s.status,
                   s.remarks, s.submitted_at, s.reviewed_at,
                   u.full_name AS developer_name,
                   u.email AS developer_email
            FROM developer_code_submissions s
            JOIN users u ON u.id = s.developer_id
            WHERE 1 = 1
        """
        params = []
        if status:
            query += " AND s.status = %s"
            params.append(status.upper())
        query += " ORDER BY s.submitted_at DESC, s.id DESC"
        cursor.execute(query, tuple(params))
        return {"submissions": [dict(row) for row in cursor.fetchall()]}
    finally:
        connection.close()


def review_submission(super_admin_id, submission_id, status, remarks=None):
    status = (status or "").upper().strip()
    if status not in {"ACCEPTED", "REJECTED", "REVIEWED"}:
        raise BadRequestError(
            "Status must be ACCEPTED, REJECTED or REVIEWED"
        )

    connection = get_connection()
    try:
        cursor = connection.cursor()
        _super_admin(cursor, super_admin_id)
        cursor.execute(
            """
            SELECT id
            FROM developer_code_submissions
            WHERE id = %s
            LIMIT 1
            """,
            (submission_id,),
        )
        if not cursor.fetchone():
            raise NotFoundError("Developer submission not found")

        cursor.execute(
            """
            UPDATE developer_code_submissions
            SET status = %s,
                remarks = %s,
                reviewed_by = %s,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                status,
                (remarks or "").strip() or None,
                super_admin_id,
                submission_id,
            ),
        )
        connection.commit()
        return {
            "message": "Submission updated",
            "submission_id": submission_id,
            "status": status,
        }
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
