import os
import uuid

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.database import get_connection

RESOURCE_TYPES = {"BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"}
RESOURCE_STATUSES = {"DRAFT", "PUBLISHED", "ARCHIVED"}
UPLOAD_DIR = os.path.join("private_uploads", "library")
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_RESOURCE_EXTENSIONS = {".pdf", ".epub", ".doc", ".docx", ".txt", ".ppt", ".pptx", ".xls", ".xlsx", ".zip"}
ALLOWED_COVER_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VIEW_ROLES = {"STUDENT", "PROFESSOR", "ADMIN"}


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
            query += " AND LOWER(COALESCE(r.category,''))=%s"
            params.append(category.strip().lower())
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
    if not path or not os.path.isfile(path):
        raise NotFoundError("Library file is not available")
    return resource


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


def _save_upload(upload, allowed_extensions, label):
    if not upload or not upload.filename:
        return None
    ext = os.path.splitext(upload.filename)[1].lower()
    if ext not in allowed_extensions:
        raise BadRequestError(f"Unsupported {label} file type")
    data = upload.file.read()
    if len(data) > MAX_FILE_SIZE:
        raise BadRequestError("File exceeds the 50 MB limit")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext}")
    with open(path, "wb") as handle:
        handle.write(data)
    return {
        "path": path,
        "original_file_name": upload.filename,
        "mime_type": upload.content_type or "application/octet-stream",
        "file_size": len(data),
    }


def create_super_admin_resource(super_admin, data, resource_file=None, cover_file=None):
    _require_super_admin(super_admin)
    typ, stat = _validate_type_status(data.resource_type, data.status)
    connection = get_connection()
    created_paths = []
    try:
        cursor = connection.cursor()
        _institution_exists(cursor, data.institution_id)
        file_info = _save_upload(resource_file, ALLOWED_RESOURCE_EXTENSIONS, "resource")
        cover_info = _save_upload(cover_file, ALLOWED_COVER_EXTENSIONS, "cover")
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
            try:
                if os.path.isfile(path): os.remove(path)
            except OSError:
                pass
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
        if "resource_type" in payload or "status" in payload:
            _validate_type_status(payload.get("resource_type", old["resource_type"]), payload.get("status", old["status"]))
        file_info = _save_upload(resource_file, ALLOWED_RESOURCE_EXTENSIONS, "resource")
        cover_info = _save_upload(cover_file, ALLOWED_COVER_EXTENSIONS, "cover")
        created_paths = [x["path"] for x in (file_info, cover_info) if x]
        fields = []
        values = []
        allowed = {"title","resource_type","institution_id","author","isbn","category","subject","description","language","publication_year","tags","status","featured"}
        for key, value in payload.items():
            if key not in allowed: continue
            if key == "title": value = value.strip()
            if key in {"resource_type", "status"} and value is not None: value = value.upper().strip()
            fields.append(f"{key}=%s"); values.append(value)
        if file_info:
            fields += ["resource_file_path=%s","original_file_name=%s","mime_type=%s","file_size=%s"]
            values += [file_info["path"], file_info["original_file_name"], file_info["mime_type"], file_info["file_size"]]
        if cover_info:
            fields.append("cover_file_path=%s"); values.append(cover_info["path"])
        fields.append("updated_by=%s"); values.append(super_admin["id"])
        values.append(resource_id)
        cursor.execute(f"UPDATE developer_library_resources SET {', '.join(fields)} WHERE id=%s", tuple(values))
        connection.commit()
        for old_path in ((old.get("resource_file_path") if file_info else None), (old.get("cover_file_path") if cover_info else None)):
            if old_path and old_path not in created_paths:
                try:
                    if os.path.isfile(old_path): os.remove(old_path)
                except OSError:
                    pass
        return _resource(cursor, resource_id)
    except Exception:
        connection.rollback()
        for path in created_paths:
            try:
                if os.path.isfile(path): os.remove(path)
            except OSError:
                pass
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
        for path in (old.get("resource_file_path"), old.get("cover_file_path")):
            if path:
                try:
                    if os.path.isfile(path): os.remove(path)
                except OSError:
                    pass
        return {"message": "Library resource deleted", "resource_id": resource_id}
    except Exception:
        connection.rollback(); raise
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
