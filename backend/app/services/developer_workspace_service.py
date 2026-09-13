import os
import re
import uuid

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

ALLOWED_EXTENSIONS = {'.py','.c','.cpp','.h','.hpp','.java','.js','.jsx','.ts','.tsx','.css','.html','.json','.sql','.md','.xml','.yml','.yaml','.sh','.txt','.go','.rs','.php','.kt','.swift'}
MAX_CODE_SIZE = 2 * 1024 * 1024
_SAFE_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')
UPLOAD_DIR = os.path.join("private_uploads", "developer_workspace")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# The IDE runs as a separate Render service, so its filesystem is not shared
# with the EduSphere backend. The backend talks to the IDE's authenticated
# file bridge over HTTPS.
IDE_BASE_URL = os.getenv("DEVELOPER_IDE_INTERNAL_URL", "").rstrip("/")
IDE_SHARED_SECRET = os.getenv("DEVELOPER_IDE_SHARED_SECRET", "").strip()


def _ide_request(method, path, payload=None):
    if not IDE_BASE_URL:
        raise BadRequestError(
            "Developer IDE is not configured. Set DEVELOPER_IDE_INTERNAL_URL."
        )
    if not IDE_SHARED_SECRET:
        raise BadRequestError(
            "Developer IDE shared secret is not configured."
        )

    import json
    import urllib.error
    import urllib.request

    url = f"{IDE_BASE_URL}/{path.lstrip('/')}"
    data = None

    headers = {
        "Authorization": f"Bearer {IDE_SHARED_SECRET}",
        "Accept": "application/json",
    }

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method.upper(),
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            if not raw:
                return {}
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = ""
        if exc.code in {401, 403}:
            raise ForbiddenError("Developer IDE authentication failed") from exc
        raise BadRequestError(
            f"Developer IDE request failed ({exc.code}): {detail[:300]}"
        ) from exc
    except urllib.error.URLError as exc:
        raise BadRequestError(
            f"Developer IDE is unreachable: {exc.reason}"
        ) from exc


def _write_ide_file(user_id, filename, content):
    filename = _validate_filename(filename)
    return _ide_request(
        "PUT",
        f"/api/files/{int(user_id)}/{filename}",
        {"filename": filename, "content": content or ""},
    )


def _remove_ide_file(user_id, filename):
    filename = _validate_filename(filename)
    return _ide_request(
        "DELETE",
        f"/api/files/{int(user_id)}/{filename}",
    )


def _list_ide_files(user_id):
    result = _ide_request("GET", f"/api/files/{int(user_id)}")
    return result.get("files", [])


def _developer(cursor, user_id, verified=True):
    cursor.execute('''SELECT u.id,u.email,u.full_name,u.is_active,u.verification_status,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=%s LIMIT 1''',(user_id,))
    user=cursor.fetchone()
    if not user: raise NotFoundError('Developer account not found')
    if not bool(user['is_active']) or user['role']!='DEVELOPER': raise ForbiddenError('Developer access required')
    if verified and user['verification_status']!='VERIFIED': raise ForbiddenError('Developer account requires Super Admin verification')
    return user

def _super_admin(cursor,user_id):
    cursor.execute('''SELECT u.id,u.is_active,u.is_super_admin,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=%s LIMIT 1''',(user_id,))
    user=cursor.fetchone()
    if not user or not bool(user['is_active']) or user['role']!='SUPER_ADMIN' or not bool(user['is_super_admin']): raise ForbiddenError('Only Super Admin can access developer submissions')
    return user

def _validate_filename(filename):
    filename=(filename or '').strip()
    if not filename or not _SAFE_NAME.fullmatch(filename): raise BadRequestError('Enter a valid filename such as helloworld.py')
    ext=os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS: raise BadRequestError(f'Unsupported file type: {ext or "missing extension"}')
    return filename

def get_file(user_id,file_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id)
        cursor.execute('SELECT id,filename,language,content,updated_at,created_at FROM developer_code_files WHERE id=%s AND user_id=%s LIMIT 1',(file_id,user_id))
        row=cursor.fetchone()
        if not row: raise NotFoundError('Code file not found')
        return dict(row)
    finally: connection.close()

def list_files(user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id)
        cursor.execute('SELECT id,filename,language,content,updated_at,created_at FROM developer_code_files WHERE user_id=%s ORDER BY updated_at DESC,id DESC',(user_id,))
        return {'developer_id': int(user_id), 'files':[dict(row) for row in cursor.fetchall()]}
    finally: connection.close()

def save_file(user_id,filename,content):
    filename=_validate_filename(filename); content=content or ''
    if len(content.encode('utf-8'))>MAX_CODE_SIZE: raise BadRequestError('Code file exceeds the 2 MB limit')
    language=os.path.splitext(filename)[1].lower().lstrip('.') or 'text'
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id)
        cursor.execute('SELECT id FROM developer_code_files WHERE user_id=%s AND filename=%s LIMIT 1',(user_id,filename)); existing=cursor.fetchone()
        if existing:
            file_id=existing['id']; cursor.execute('UPDATE developer_code_files SET content=%s,language=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s',(content,language,file_id))
        else:
            cursor.execute('INSERT INTO developer_code_files(user_id,filename,language,content) VALUES(%s,%s,%s,%s)',(user_id,filename,language,content)); file_id=cursor.lastrowid
        connection.commit()
        _write_ide_file(user_id, filename, content)
        return {'message':'File saved','file':get_file(user_id,file_id)}
    except Exception: connection.rollback(); raise
    finally: connection.close()

def delete_file(user_id,file_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id)
        cursor.execute('SELECT filename FROM developer_code_files WHERE id=%s AND user_id=%s LIMIT 1',(file_id,user_id))
        existing=cursor.fetchone()
        if not existing: raise NotFoundError('Code file not found')
        cursor.execute('DELETE FROM developer_code_files WHERE id=%s AND user_id=%s',(file_id,user_id))
        connection.commit(); _remove_ide_file(user_id, existing['filename'])
        return {'message':'File deleted'}
    except Exception: connection.rollback(); raise
    finally: connection.close()

def sync_ide_to_db(user_id):
    connection = get_connection()
    synced = []
    skipped = []

    try:
        cursor = connection.cursor()
        _developer(cursor, user_id)

        # Read the actual files from the separate Render IDE service.
        ide_files = _list_ide_files(user_id)

        for item in ide_files:
            try:
                filename = _validate_filename(item.get("filename"))
                content = item.get("content", "")
                if len(content.encode("utf-8")) > MAX_CODE_SIZE:
                    skipped.append(
                        {
                            "filename": filename,
                            "reason": "File exceeds 2 MB",
                        }
                    )
                    continue

                language = (
                    os.path.splitext(filename)[1]
                    .lower()
                    .lstrip(".")
                    or "text"
                )

                cursor.execute(
                    """
                    SELECT id
                    FROM developer_code_files
                    WHERE user_id=%s AND filename=%s
                    LIMIT 1
                    """,
                    (user_id, filename),
                )
                existing = cursor.fetchone()

                if existing:
                    cursor.execute(
                        """
                        UPDATE developer_code_files
                        SET content=%s, language=%s,
                            updated_at=CURRENT_TIMESTAMP
                        WHERE id=%s
                        """,
                        (content, language, existing["id"]),
                    )
                    file_id = existing["id"]
                else:
                    cursor.execute(
                        """
                        INSERT INTO developer_code_files
                            (user_id,filename,language,content)
                        VALUES (%s,%s,%s,%s)
                        """,
                        (user_id, filename, language, content),
                    )
                    file_id = cursor.lastrowid

                synced.append(
                    {
                        "id": file_id,
                        "filename": filename,
                        "language": language,
                    }
                )
            except (UnicodeDecodeError, BadRequestError) as exc:
                skipped.append(
                    {
                        "filename": item.get("filename", ""),
                        "reason": str(exc),
                    }
                )

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
            SELECT id,filename,language,content
            FROM developer_code_files
            WHERE user_id=%s
            ORDER BY filename
            """,
            (user_id,),
        )
        rows = cursor.fetchall()

        exported = 0
        for row in rows:
            _write_ide_file(
                user_id,
                row["filename"],
                row["content"] or "",
            )
            exported += 1

        return {
            "message": "Saved EduSphere files exported to IDE",
            "exported": exported,
            "developer_id": int(user_id),
        }
    finally:
        connection.close()


def submit_file(user_id,file_id,description):
    # Always pull the latest browser-IDE contents into EduSphere before submission.\n    sync_ide_to_db(user_id)\n    description=(description or '').strip()
    if not description: raise BadRequestError('Description is required for submission')
    if len(description)>2000: raise BadRequestError('Description must be 2000 characters or fewer')
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id)
        cursor.execute('SELECT id,filename,language,content FROM developer_code_files WHERE id=%s AND user_id=%s LIMIT 1',(file_id,user_id)); file=cursor.fetchone()
        if not file: raise NotFoundError('Code file not found')
        cursor.execute("SELECT id FROM developer_code_submissions WHERE file_id=%s AND status='PENDING' LIMIT 1",(file_id,))
        if cursor.fetchone(): raise ConflictError('This file already has a pending submission')
        storage_path=os.path.join(UPLOAD_DIR,f'{uuid.uuid4().hex}_{file["filename"]}')
        with open(storage_path,'w',encoding='utf-8') as handle: handle.write(file['content'] or '')
        cursor.execute('''INSERT INTO developer_code_submissions(file_id,developer_id,filename,language,description,content,storage_path,status) VALUES(%s,%s,%s,%s,%s,%s,%s,'PENDING')''',(file['id'],user_id,file['filename'],file['language'],description,file['content'],storage_path))
        submission_id=cursor.lastrowid; connection.commit(); return {'message':'File submitted to Super Admin','submission_id':submission_id}
    except Exception: connection.rollback(); raise
    finally: connection.close()

def list_submissions(user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer(cursor,user_id,verified=False)
        cursor.execute('SELECT id,file_id,filename,language,description,status,remarks,submitted_at,reviewed_at FROM developer_code_submissions WHERE developer_id=%s ORDER BY submitted_at DESC,id DESC',(user_id,))
        return {'submissions':[dict(row) for row in cursor.fetchall()]}
    finally: connection.close()

def super_admin_submissions(super_admin_id,status=None):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _super_admin(cursor,super_admin_id)
        query='''SELECT s.id,s.file_id,s.developer_id,s.filename,s.language,s.description,s.content,s.status,s.remarks,s.submitted_at,s.reviewed_at,u.full_name AS developer_name,u.email AS developer_email FROM developer_code_submissions s JOIN users u ON u.id=s.developer_id WHERE 1=1'''; params=[]
        if status: query+=' AND s.status=%s'; params.append(status.upper())
        query+=' ORDER BY s.submitted_at DESC,s.id DESC'; cursor.execute(query,tuple(params)); return {'submissions':[dict(row) for row in cursor.fetchall()]}
    finally: connection.close()

def review_submission(super_admin_id,submission_id,status,remarks=None):
    status=(status or '').upper().strip()
    if status not in {'ACCEPTED','REJECTED','REVIEWED'}: raise BadRequestError('Status must be ACCEPTED, REJECTED or REVIEWED')
    connection=get_connection()
    try:
        cursor=connection.cursor(); _super_admin(cursor,super_admin_id)
        cursor.execute('SELECT id FROM developer_code_submissions WHERE id=%s LIMIT 1',(submission_id,))
        if not cursor.fetchone(): raise NotFoundError('Developer submission not found')
        cursor.execute('UPDATE developer_code_submissions SET status=%s,remarks=%s,reviewed_by=%s,reviewed_at=CURRENT_TIMESTAMP WHERE id=%s',(status,(remarks or '').strip() or None,super_admin_id,submission_id))
        connection.commit(); return {'message':'Submission updated','submission_id':submission_id,'status':status}
    except Exception: connection.rollback(); raise
    finally: connection.close()
