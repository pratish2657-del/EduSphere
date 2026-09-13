import json
import os
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request as URLRequest
from urllib.request import urlopen

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.database import get_connection

RESOURCE_TYPES = {"BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"}
RESOURCE_STATUSES = {"DRAFT", "PUBLISHED", "ARCHIVED"}
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_RESOURCE_EXTENSIONS = {".pdf", ".epub", ".doc", ".docx", ".txt", ".ppt", ".pptx", ".xls", ".xlsx", ".zip"}
ALLOWED_COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIEW_ROLES = {"STUDENT", "PROFESSOR", "ADMIN"}

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_LIBRARY_BUCKET = os.getenv("SUPABASE_LIBRARY_BUCKET", "library").strip() or "library"


def _storage_configured():
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _require_storage():
    if not _storage_configured():
        raise BadRequestError(
            "Library storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend."
        )


def _storage_url(path):
    return f"{SUPABASE_URL}/storage/v1{path}"


def _storage_request(method, path, body=None, content_type=None):
    _require_storage()
    data = None
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    if body is not None:
        if isinstance(body, (bytes, bytearray)):
            data = bytes(body)
        else:
            data = json.dumps(body).encode("utf-8")
            content_type = content_type or "application/json"
    if content_type:
        headers["Content-Type"] = content_type

    request = URLRequest(_storage_url(path), data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read()
            if not raw:
                return None
            try:
                return json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return raw
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise BadRequestError(f"Library storage request failed ({error.code}): {detail[:500]}") from error
    except URLError as error:
        raise BadRequestError(f"Unable to reach library storage: {error.reason}") from error


def _ensure_bucket():
    try:
        _storage_request("GET", f"/bucket/{quote(SUPABASE_LIBRARY_BUCKET, safe='')}")
        return
    except BadRequestError:
        pass

    try:
        _storage_request(
            "POST",
            "/bucket",
            {
                "id": SUPABASE_LIBRARY_BUCKET,
                "name": SUPABASE_LIBRARY_BUCKET,
                "public": False,
                "file_size_limit": MAX_FILE_SIZE,
            },
        )
    except BadRequestError as error:
        # Another request may have created it between GET and POST.
        try:
            _storage_request("GET", f"/bucket/{quote(SUPABASE_LIBRARY_BUCKET, safe='')}")
        except BadRequestError:
            raise error


def _storage_object_path(institution_id, upload, kind):
    ext = os.path.splitext(upload.filename)[1].lower()
    return f"{institution_id}/{kind}/{uuid.uuid4().hex}{ext}"


def _upload_to_storage(upload, allowed_extensions, label, institution_id, kind):
    if not upload or not upload.filename:
        return None

    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in allowed_extensions:
        raise BadRequestError(f"Unsupported {label} file type")

    data = upload.file.read()
    if len(data) > MAX_FILE_SIZE:
        raise BadRequestError("File exceeds the 50 MB limit")

    _ensure_bucket()
    object_path = _storage_object_path(institution_id, upload, kind)
    _storage_request(
        "POST",
        f"/object/{quote(SUPABASE_LIBRARY_BUCKET, safe='')}/{quote(object_path, safe='/')}",
        data,
        upload.content_type or "application/octet-stream",
    )
    return {
        "path": object_path,
        "original_file_name": upload.filename,
        "mime_type": upload.content_type or "application/octet-stream",
        "file_size": len(data),
    }


def _delete_storage_object(path):
    if not path or path.startswith("private_uploads/") or not _storage_configured():
        return
    try:
        _storage_request(
            "DELETE",
            f"/object/{quote(SUPABASE_LIBRARY_BUCKET, safe='')}/{quote(path, safe='/')}",
        )
    except BadRequestError:
        # DB deletion/update should not be blocked by cleanup of an already-missing object.
        pass


def _signed_storage_url(path, expires_in=300, download_name=None):
    if not path or path.startswith("private_uploads/"):
        raise NotFoundError("Library file is not available in persistent storage")
    result = _storage_request(
        "POST",
        f"/object/sign/{quote(SUPABASE_LIBRARY_BUCKET, safe='')}/{quote(path, safe='/')}",
        {"expiresIn": expires_in},
    )
    signed_path = result.get("signedURL") if isinstance(result, dict) else None
    if not signed_path:
        raise NotFoundError("Library file is not available in persistent storage")
    if signed_path.startswith("http://") or signed_path.startswith("https://"):
        url = signed_path
    elif signed_path.startswith("/storage/v1/"):
        url = f"{SUPABASE_URL}{signed_path}"
    elif signed_path.startswith("/object/"):
        # Supabase REST returns signedURL as a relative /object/... path.
        # The public endpoint is rooted under /storage/v1.
        url = f"{SUPABASE_URL}/storage/v1{signed_path}"
    else:
        url = f"{SUPABASE_URL}/storage/v1/{signed_path.lstrip('/')}"
    if download_name:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}download={quote(download_name)}"
    return url


def _user_institution(cursor, user):
    role = user.get("role")
    if role == "STUDENT":
        table = "student_profiles"
    elif role == "PROFESSOR":
        table = "professor_profiles"
    elif role == "ADMIN":
        table = "admin_profiles"
    else:
        raise ForbiddenError("Library viewing is available to Student, Professor and Admin accounts")

    cursor.execute(f"SELECT institution_id FROM {table} WHERE user_id=%s LIMIT 1", (user["id"],))
    row = cursor.fetchone()
    if not row or row["institution_id"] is None:
        raise ForbiddenError("Complete your institution profile before accessing the Library")
    return int(row["institution_id"])


def _require_viewer(cursor, user):
    if user.get("role") not in VIEW_ROLES:
        raise ForbiddenError("Library viewing is available to Student, Professor and Admin accounts")
    return _user_institution(cursor, user)


def _require_super_admin(user):
    if user.get("role") != "SUPER_ADMIN" or not bool(user.get("is_super_admin")):
        raise ForbiddenError("SUPER_ADMIN access required")


def _validate_type_status(resource_type, status=None):
    typ = resource_type.upper().strip() if resource_type else None
    stat = status.upper().strip() if status else None
    if typ and typ not in RESOURCE_TYPES:
        raise BadRequestError("Invalid resource type")
    if stat and stat not in RESOURCE_STATUSES:
        raise BadRequestError("Invalid resource status")
    return typ, stat


def _institution_exists(cursor, institution_id):
    cursor.execute("SELECT id,name,university_code FROM institutions WHERE id=%s LIMIT 1", (institution_id,))
    row = cursor.fetchone()
    if not row:
        raise NotFoundError("Institution not found")
    return row


def _resource(cursor, resource_id, institution_id=None, published_only=False):
    clauses = ["r.id=%s"]
    params = [resource_id]
    if institution_id is not None:
        clauses.append("r.institution_id=%s")
        params.append(institution_id)
    if published_only:
        clauses.append("r.status='PUBLISHED'")
    cursor.execute(
        f"""
        SELECT r.*, i.name AS institution_name, i.university_code AS institution_code,
               u.full_name AS creator_name
        FROM developer_library_resources r
        INNER JOIN institutions i ON i.id=r.institution_id
        INNER JOIN users u ON u.id=r.created_by
        WHERE {' AND '.join(clauses)}
        LIMIT 1
        """,
        tuple(params),
    )
    row = cursor.fetchone()
    if not row:
        raise NotFoundError("Library resource not found")
    return dict(row)


def list_library(user, search=None, resource_type=None, category=None, featured=None):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _require_viewer(cursor, user)
        typ, _ = _validate_type_status(resource_type)
        query = """
            SELECT r.*, i.name AS institution_name, i.university_code AS institution_code,
                   u.full_name AS creator_name
            FROM developer_library_resources r
            INNER JOIN institutions i ON i.id=r.institution_id
            INNER JOIN users u ON u.id=r.created_by
            WHERE r.institution_id=%s AND r.status='PUBLISHED'
        """
        params = [institution_id]
        if search and search.strip():
            value = f"%{search.strip().lower()}%"
            query += " AND (LOWER(r.title) LIKE %s OR LOWER(COALESCE(r.author,'')) LIKE %s OR LOWER(COALESCE(r.subject,'')) LIKE %s OR LOWER(COALESCE(r.tags,'')) LIKE %s)"
            params.extend([value] * 4)
        if typ:
            query += " AND r.resource_type=%s"
            params.append(typ)
        if category and category.strip():
            value = category.strip().lower()
            query += " AND LOWER(COALESCE(r.category,''))=%s"
            params.append(value)
        if featured is not None:
            query += " AND r.featured=%s"
            params.append(bool(featured))
        query += " ORDER BY r.featured DESC, r.updated_at DESC, r.id DESC"
        cursor.execute(query, tuple(params))
        rows = [dict(row) for row in cursor.fetchall()]
        return {"institution_id": institution_id, "count": len(rows), "resources": rows}
    finally:
        connection.close()


def get_library_resource(user, resource_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _require_viewer(cursor, user)
        return _resource(cursor, resource_id, institution_id, published_only=True)
    finally:
        connection.close()


def get_library_download(user, resource_id):
    resource = get_library_resource(user, resource_id)
    path = resource.get("resource_file_path")
    if not path:
        raise NotFoundError("Library file is not available")
    return {**resource, "signed_url": _signed_storage_url(path, download_name=resource.get("original_file_name"))}


def library_summary(user):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        institution_id = _require_viewer(cursor, user)
        cursor.execute("""
            SELECT COUNT(*) AS total,
                   SUM(resource_type='BOOK') AS books,
                   SUM(resource_type='MATERIAL') AS materials,
                   SUM(resource_type='EBOOK') AS ebooks,
                   SUM(resource_type='NOTE') AS notes,
                   SUM(resource_type='PDF') AS pdfs,
                   SUM(resource_type='OTHER') AS other_resources,
                   SUM(featured=TRUE) AS featured
            FROM developer_library_resources
            WHERE institution_id=%s AND status='PUBLISHED'
        """, (institution_id,))
        summary = dict(cursor.fetchone() or {})
        summary["institution_id"] = institution_id
        return summary
    finally:
        connection.close()


def list_super_admin_library(super_admin, institution_id=None, search=None, resource_type=None, status=None, featured=None):
    _require_super_admin(super_admin)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        typ, stat = _validate_type_status(resource_type, status)
        query = """
            SELECT r.*, i.name AS institution_name, i.university_code AS institution_code,
                   u.full_name AS creator_name
            FROM developer_library_resources r
            INNER JOIN institutions i ON i.id=r.institution_id
            INNER JOIN users u ON u.id=r.created_by
            WHERE 1=1
        """
        params = []
        if institution_id is not None:
            _institution_exists(cursor, institution_id)
            query += " AND r.institution_id=%s"
            params.append(institution_id)
        if search and search.strip():
            value = f"%{search.strip().lower()}%"
            query += " AND (LOWER(r.title) LIKE %s OR LOWER(COALESCE(r.author,'')) LIKE %s OR LOWER(COALESCE(r.subject,'')) LIKE %s OR LOWER(COALESCE(r.tags,'')) LIKE %s)"
            params.extend([value] * 4)
        if typ:
            query += " AND r.resource_type=%s"
            params.append(typ)
        if stat:
            query += " AND r.status=%s"
            params.append(stat)
        if featured is not None:
            query += " AND r.featured=%s"
            params.append(bool(featured))
        query += " ORDER BY r.updated_at DESC, r.id DESC"
        cursor.execute(query, tuple(params))
        rows = [dict(row) for row in cursor.fetchall()]
        return {"count": len(rows), "resources": rows}
    finally:
        connection.close()


def get_super_admin_resource(super_admin, resource_id):
    _require_super_admin(super_admin)
    connection = get_connection()
    try:
        return _resource(connection.cursor(), resource_id)
    finally:
        connection.close()


def get_super_admin_download(super_admin, resource_id):
    resource = get_super_admin_resource(super_admin, resource_id)
    path = resource.get("resource_file_path")
    if not path:
        raise NotFoundError("Library file is not available")
    return {**resource, "signed_url": _signed_storage_url(path, download_name=resource.get("original_file_name"))}


def create_super_admin_resource(super_admin, data, resource_file=None, cover_file=None):
    _require_super_admin(super_admin)
    typ, stat = _validate_type_status(data.resource_type, data.status)
    connection = get_connection()
    created_paths = []
    try:
        cursor = connection.cursor()
        _institution_exists(cursor, data.institution_id)
        file_info = _upload_to_storage(resource_file, ALLOWED_RESOURCE_EXTENSIONS, "resource", data.institution_id, "resources")
        cover_info = _upload_to_storage(cover_file, ALLOWED_COVER_EXTENSIONS, "cover", data.institution_id, "covers")
        created_paths = [x["path"] for x in (file_info, cover_info) if x]
        cursor.execute("""
            INSERT INTO developer_library_resources
            (institution_id,title,resource_type,author,isbn,category,subject,description,language,
             publication_year,tags,resource_file_path,cover_file_path,original_file_name,mime_type,
             file_size,status,featured,created_by,updated_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            data.institution_id, data.title.strip(), typ, data.author, data.isbn, data.category,
            data.subject, data.description, data.language, data.publication_year, data.tags,
            file_info["path"] if file_info else None, cover_info["path"] if cover_info else None,
            file_info["original_file_name"] if file_info else None,
            file_info["mime_type"] if file_info else None,
            file_info["file_size"] if file_info else None, stat, bool(data.featured),
            super_admin["id"], super_admin["id"],
        ))
        resource_id = cursor.lastrowid
        connection.commit()
        return _resource(cursor, resource_id)
    except Exception:
        connection.rollback()
        for path in created_paths:
            _delete_storage_object(path)
        raise
    finally:
        connection.close()


def update_super_admin_resource(super_admin, resource_id, data, resource_file=None, cover_file=None):
    _require_super_admin(super_admin)
    payload = data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
    connection = get_connection()
    created_paths = []
    try:
        cursor = connection.cursor()
        old = _resource(cursor, resource_id)
        if not payload and not resource_file and not cover_file:
            raise BadRequestError("No changes supplied")
        if "institution_id" in payload:
            _institution_exists(cursor, int(payload["institution_id"]))
        target_institution_id = int(payload.get("institution_id", old["institution_id"]))
        if "resource_type" in payload or "status" in payload:
            _validate_type_status(payload.get("resource_type", old["resource_type"]), payload.get("status", old["status"]))
        file_info = _upload_to_storage(resource_file, ALLOWED_RESOURCE_EXTENSIONS, "resource", target_institution_id, "resources")
        cover_info = _upload_to_storage(cover_file, ALLOWED_COVER_EXTENSIONS, "cover", target_institution_id, "covers")
        created_paths = [x["path"] for x in (file_info, cover_info) if x]
        fields = []
        values = []
        allowed = {"title","resource_type","institution_id","author","isbn","category","subject","description","language","publication_year","tags","status","featured"}
        for key, value in payload.items():
            if key not in allowed:
                continue
            if key == "title" and value is not None:
                value = value.strip()
            if key in {"resource_type", "status"} and value is not None:
                value = value.upper().strip()
            fields.append(f"{key}=%s")
            values.append(value)
        if file_info:
            fields += ["resource_file_path=%s","original_file_name=%s","mime_type=%s","file_size=%s"]
            values += [file_info["path"], file_info["original_file_name"], file_info["mime_type"], file_info["file_size"]]
        if cover_info:
            fields.append("cover_file_path=%s")
            values.append(cover_info["path"])
        fields.append("updated_by=%s")
        values.append(super_admin["id"])
        values.append(resource_id)
        cursor.execute(f"UPDATE developer_library_resources SET {', '.join(fields)} WHERE id=%s", tuple(values))
        connection.commit()
        if file_info:
            _delete_storage_object(old.get("resource_file_path"))
        if cover_info:
            _delete_storage_object(old.get("cover_file_path"))
        return _resource(cursor, resource_id)
    except Exception:
        connection.rollback()
        for path in created_paths:
            _delete_storage_object(path)
        raise
    finally:
        connection.close()


def delete_super_admin_resource(super_admin, resource_id):
    _require_super_admin(super_admin)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        old = _resource(cursor, resource_id)
        cursor.execute("DELETE FROM developer_library_resources WHERE id=%s", (resource_id,))
        connection.commit()
        _delete_storage_object(old.get("resource_file_path"))
        _delete_storage_object(old.get("cover_file_path"))
        return {"message": "Library resource deleted", "resource_id": resource_id}
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def super_admin_summary(super_admin, institution_id=None):
    _require_super_admin(super_admin)
    connection = get_connection()
    try:
        cursor = connection.cursor()
        params = []
        where = ""
        if institution_id is not None:
            _institution_exists(cursor, institution_id)
            where = " WHERE institution_id=%s"
            params.append(institution_id)
        cursor.execute(f"""
            SELECT COUNT(*) AS total,
                   SUM(status='DRAFT') AS drafts,
                   SUM(status='PUBLISHED') AS published,
                   SUM(status='ARCHIVED') AS archived,
                   SUM(featured=TRUE) AS featured
            FROM developer_library_resources{where}
        """, tuple(params))
        return dict(cursor.fetchone() or {})
    finally:
        connection.close()
