import json
import os

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.database import get_connection

RESOURCE_TYPES = {"BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"}
RESOURCE_STATUSES = {"DRAFT", "PUBLISHED", "ARCHIVED"}
UPLOAD_DIR = os.path.join("private_uploads", "developer_library")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _developer_user(cursor, user_id, verified=False):
    cursor.execute("""
        SELECT u.id,u.email,u.full_name,u.role_id,u.profile_completed,u.verification_status,
               u.is_active,u.is_super_admin,r.name AS role
        FROM users u LEFT JOIN roles r ON r.id=u.role_id
        WHERE u.id=%s LIMIT 1
    """, (user_id,))
    user = cursor.fetchone()
    if not user:
        raise NotFoundError("Developer account not found")
    if not bool(user["is_active"]):
        raise ForbiddenError("Developer account is inactive")
    if user["role"] != "DEVELOPER":
        raise ForbiddenError("Developer role required")
    if bool(user["is_super_admin"]):
        raise ForbiddenError("Super Admin accounts do not use the Developer flow")
    if verified and user["verification_status"] != "VERIFIED":
        raise ForbiddenError("Developer account requires Super Admin verification")
    return user


def require_verified_developer(user_id):
    connection=get_connection()
    try:
        return _developer_user(connection.cursor(), user_id, verified=True)
    finally:
        connection.close()


def _log(cursor, actor, action, entity_type, entity_id=None, details=None):
    cursor.execute("""
        INSERT INTO developer_activity_logs(actor_user_id,action,entity_type,entity_id,details)
        VALUES(%s,%s,%s,%s,%s)
    """, (actor, action, entity_type, entity_id, json.dumps(details or {})))


def get_developer_profile(user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor()
        _developer_user(cursor,user_id)
        cursor.execute("""
            SELECT dp.*,u.email,u.full_name,u.profile_completed,u.verification_status AS user_verification_status,
                   dv.status AS verification_status,dv.remarks,dv.submitted_at,dv.verified_by,dv.verified_at
            FROM developer_profiles dp
            INNER JOIN users u ON u.id=dp.user_id
            LEFT JOIN developer_verifications dv ON dv.user_id=dp.user_id
            WHERE dp.user_id=%s LIMIT 1
        """,(user_id,))
        row=cursor.fetchone()
        if not row: raise NotFoundError("Developer profile not found")
        return dict(row)
    finally: connection.close()


def save_developer_profile(user_id,data):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,user_id)
        developer_id=data.developer_id.strip()
        cursor.execute("SELECT id FROM developer_profiles WHERE developer_id=%s AND user_id<>%s LIMIT 1",(developer_id,user_id))
        if cursor.fetchone(): raise ConflictError("This Developer ID is already in use")
        values=(developer_id,data.phone.strip(),data.designation.strip(),data.department.strip(),data.experience.strip() if data.experience else None,data.primary_role.strip(),data.skills.strip(),data.github.strip() if data.github else None,data.linkedin.strip() if data.linkedin else None,data.portfolio.strip() if data.portfolio else None,data.bio.strip() if data.bio else None)
        cursor.execute("SELECT id FROM developer_profiles WHERE user_id=%s LIMIT 1",(user_id,)); existing=cursor.fetchone()
        if existing:
            cursor.execute("""UPDATE developer_profiles SET developer_id=%s,phone=%s,designation=%s,department=%s,experience=%s,primary_role=%s,skills=%s,github=%s,linkedin=%s,portfolio=%s,bio=%s WHERE user_id=%s""",values+(user_id,)); profile_id=existing["id"]
        else:
            cursor.execute("""INSERT INTO developer_profiles(user_id,developer_id,phone,designation,department,experience,primary_role,skills,github,linkedin,portfolio,bio) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",(user_id,)+values); profile_id=cursor.lastrowid
        cursor.execute("SELECT id FROM developer_verifications WHERE user_id=%s LIMIT 1",(user_id,)); v=cursor.fetchone()
        if v:
            cursor.execute("UPDATE developer_verifications SET status='PENDING',remarks=NULL,verified_by=NULL,verified_at=NULL,submitted_at=CURRENT_TIMESTAMP WHERE user_id=%s",(user_id,))
        else:
            cursor.execute("INSERT INTO developer_verifications(developer_profile_id,user_id,status) VALUES(%s,%s,'PENDING')",(profile_id,user_id))
        cursor.execute("UPDATE users SET profile_completed=TRUE,verification_status='PENDING' WHERE id=%s",(user_id,))
        _log(
            cursor,
            user_id,
            "PROFILE_SUBMITTED",
            "DEVELOPER_PROFILE",
            profile_id,
            {
                "message": "Developer profile submitted",
                "verification_status": "PENDING",
                "profile_id": profile_id,
            },
        )
        connection.commit()
        return {"message":"Developer profile submitted for Super Admin verification","profile":get_developer_profile(user_id)}
    except Exception: connection.rollback(); raise
    finally: connection.close()


def pending_developers(super_admin_id):
    connection=get_connection()
    try:
        cursor=connection.cursor()
        cursor.execute("""SELECT u.id AS user_id,u.email,u.full_name,u.is_active,dp.*,dv.id AS verification_id,dv.status AS verification_status,dv.remarks,dv.submitted_at,dv.verified_by,dv.verified_at FROM developer_verifications dv JOIN developer_profiles dp ON dp.id=dv.developer_profile_id JOIN users u ON u.id=dv.user_id WHERE dv.status='PENDING' ORDER BY dv.submitted_at ASC""")
        return {"developers":[dict(x) for x in cursor.fetchall()]}
    finally: connection.close()


def verify_developer(super_admin_id,user_id,status,remarks=None):
    status=status.upper().strip()
    if status not in {"VERIFIED","REJECTED"}: raise BadRequestError("Status must be VERIFIED or REJECTED")
    if status=="REJECTED" and not (remarks and remarks.strip()): raise BadRequestError("Rejection reason is required")
    connection=get_connection()
    try:
        cursor=connection.cursor()
        cursor.execute("SELECT u.id,u.is_active,u.is_super_admin,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=%s LIMIT 1",(super_admin_id,)); admin=cursor.fetchone()
        if not admin: raise NotFoundError("Super Admin account not found")
        if not bool(admin["is_active"]) or admin["role"]!="SUPER_ADMIN" or not bool(admin["is_super_admin"]): raise ForbiddenError("Only SUPER_ADMIN can verify Developer applications")
        cursor.execute("SELECT dv.id,dv.status,dp.id AS profile_id,u.is_active,r.name AS role FROM developer_verifications dv JOIN developer_profiles dp ON dp.id=dv.developer_profile_id JOIN users u ON u.id=dv.user_id LEFT JOIN roles r ON r.id=u.role_id WHERE dv.user_id=%s LIMIT 1",(user_id,)); app=cursor.fetchone()
        if not app: raise NotFoundError("Developer application not found")
        if app["role"]!="DEVELOPER": raise ConflictError("Selected account is no longer a Developer")
        if not bool(app["is_active"]): raise ForbiddenError("Developer account is inactive")
        if app["status"]!="PENDING": raise ConflictError("Developer application is no longer pending")
        remarks=remarks.strip() if remarks else None
        cursor.execute("UPDATE developer_verifications SET status=%s,remarks=%s,verified_by=%s,verified_at=CURRENT_TIMESTAMP WHERE user_id=%s",(status,remarks,super_admin_id,user_id))
        cursor.execute("UPDATE users SET verification_status=%s,is_active=TRUE WHERE id=%s",(status,user_id))
        _log(cursor,super_admin_id,"DEVELOPER_VERIFIED" if status=="VERIFIED" else "DEVELOPER_REJECTED","DEVELOPER_VERIFICATION",app["id"],{"developer_user_id":user_id,"remarks":remarks})
        connection.commit()
        return {"message":"Developer verified successfully" if status=="VERIFIED" else "Developer application rejected","user_id":user_id,"status":status,"remarks":remarks}
    except Exception: connection.rollback(); raise
    finally: connection.close()


def _resource(cursor, resource_id):
    cursor.execute("""SELECT r.*,u.full_name AS creator_name,i.name AS institution_name FROM developer_library_resources r JOIN users u ON u.id=r.created_by JOIN institutions i ON i.id=r.institution_id WHERE r.id=%s LIMIT 1""",(resource_id,)); row=cursor.fetchone()
    if not row: raise NotFoundError("Library resource not found")
    return dict(row)


def list_resources(developer_user_id, search=None, resource_type=None, status=None, featured=None, institution_id=None):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True)
        q="SELECT r.*,u.full_name AS creator_name,i.name AS institution_name FROM developer_library_resources r JOIN users u ON u.id=r.created_by JOIN institutions i ON i.id=r.institution_id WHERE 1=1"; p=[]
        if search: q+=" AND (LOWER(r.title) LIKE %s OR LOWER(COALESCE(r.author,'')) LIKE %s OR LOWER(COALESCE(r.subject,'')) LIKE %s OR LOWER(COALESCE(r.tags,'')) LIKE %s)"; s=f"%{search.strip().lower()}%"; p += [s,s,s,s]
        if resource_type: q+=" AND r.resource_type=%s"; p.append(resource_type.upper())
        if status: q+=" AND r.status=%s"; p.append(status.upper())
        if featured is not None: q+=" AND r.featured=%s"; p.append(bool(featured))
        if institution_id is not None: q+=" AND r.institution_id=%s"; p.append(int(institution_id))
        q+=" ORDER BY r.updated_at DESC,r.id DESC"; cursor.execute(q,tuple(p)); return {"count":cursor.rowcount,"resources":[dict(x) for x in cursor.fetchall()]}
    finally: connection.close()


def create_resource(developer_user_id,data,file_info=None,cover_info=None, institution_id=None):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True)
        typ=data.resource_type.upper(); stat=data.status.upper()
        if institution_id is None: raise BadRequestError("Institution is required")
        cursor.execute("SELECT id FROM institutions WHERE id=%s LIMIT 1", (int(institution_id),))
        if not cursor.fetchone(): raise NotFoundError("Institution not found")
        if typ not in RESOURCE_TYPES: raise BadRequestError("Invalid resource type")
        if stat not in RESOURCE_STATUSES: raise BadRequestError("Invalid resource status")
        path=None
        cover_path=None
        if file_info: path=file_info["path"]
        if cover_info: cover_path=cover_info["path"]
        cursor.execute("""INSERT INTO developer_library_resources(institution_id,title,resource_type,author,isbn,category,subject,description,language,publication_year,tags,resource_file_path,cover_file_path,original_file_name,mime_type,file_size,status,featured,created_by,updated_by) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",(int(institution_id),data.title.strip(),typ,data.author,data.isbn,data.category,data.subject,data.description,data.language,data.publication_year,data.tags,path,cover_path,file_info.get("original_file_name") if file_info else None,file_info.get("mime_type") if file_info else None,file_info.get("file_size") if file_info else None,stat,bool(data.featured),developer_user_id,developer_user_id))
        rid=cursor.lastrowid; _log(cursor,developer_user_id,"LIBRARY_CREATE","LIBRARY_RESOURCE",rid,{"resource_type":typ}); connection.commit(); return _resource(cursor,rid)
    except Exception: connection.rollback(); raise
    finally: connection.close()


def update_resource(developer_user_id,resource_id,data,file_info=None,cover_info=None, institution_id=None):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True); old=_resource(cursor,resource_id)
        payload=data.model_dump(exclude_unset=True) if hasattr(data,"model_dump") else data.dict(exclude_unset=True)
        if "resource_type" in payload:
            payload["resource_type"]=payload["resource_type"].upper()
            if payload["resource_type"] not in RESOURCE_TYPES: raise BadRequestError("Invalid resource type")
        if "status" in payload:
            payload["status"]=payload["status"].upper()
            if payload["status"] not in RESOURCE_STATUSES: raise BadRequestError("Invalid resource status")
        if institution_id is not None:
            cursor.execute("SELECT id FROM institutions WHERE id=%s LIMIT 1", (int(institution_id),))
            if not cursor.fetchone(): raise NotFoundError("Institution not found")
            payload["institution_id"] = int(institution_id)
        if not payload and not file_info: raise BadRequestError("No changes supplied")
        allowed=["institution_id","title","resource_type","author","isbn","category","subject","description","language","publication_year","tags","status","featured"]
        sets=[]; params=[]
        for k in allowed:
            if k in payload: sets.append(f"{k}=%s"); params.append(payload[k])
        if file_info:
            sets += ["resource_file_path=%s","original_file_name=%s","mime_type=%s","file_size=%s"]; params += [file_info["path"],file_info["original_file_name"],file_info["mime_type"],file_info["file_size"]]
        if cover_info:
            sets.append("cover_file_path=%s"); params.append(cover_info["path"])
        sets.append("updated_by=%s"); params.append(developer_user_id); params.append(resource_id)
        cursor.execute(f"UPDATE developer_library_resources SET {','.join(sets)} WHERE id=%s",tuple(params))
        if file_info and old.get("resource_file_path") and old["resource_file_path"] != file_info["path"]:
            try: os.remove(old["resource_file_path"])
            except OSError: pass
        if cover_info and old.get("cover_file_path") and old["cover_file_path"] != cover_info["path"]:
            try: os.remove(old["cover_file_path"])
            except OSError: pass
        _log(cursor,developer_user_id,"LIBRARY_UPDATE","LIBRARY_RESOURCE",resource_id,{"fields":list(payload.keys()),"file_replaced":bool(file_info),"cover_replaced":bool(cover_info)}); connection.commit(); return _resource(cursor,resource_id)
    except Exception: connection.rollback(); raise
    finally: connection.close()


def delete_resource(developer_user_id,resource_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True); row=_resource(cursor,resource_id)
        cursor.execute("DELETE FROM developer_library_resources WHERE id=%s",(resource_id,)); _log(cursor,developer_user_id,"LIBRARY_DELETE","LIBRARY_RESOURCE",resource_id,{"title":row["title"]}); connection.commit()
        if row.get("resource_file_path"):
            try: os.remove(row["resource_file_path"])
            except OSError: pass
        return {"message":"Library resource deleted successfully","resource_id":resource_id}
    except Exception: connection.rollback(); raise
    finally: connection.close()


def get_resource_for_download(resource_id, developer_user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True); row=_resource(cursor,resource_id)
        if not row.get("resource_file_path") or not os.path.isfile(row["resource_file_path"]): raise NotFoundError("Resource file not found")
        return row
    finally: connection.close()


def activity_logs(developer_user_id,limit=100):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True); limit=max(1,min(int(limit),500))
        cursor.execute(f"SELECT * FROM developer_activity_logs WHERE actor_user_id=%s ORDER BY created_at DESC LIMIT {limit}",(developer_user_id,)); return {"logs":[dict(x) for x in cursor.fetchall()]}
    finally: connection.close()



def list_institutions(developer_user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True)
        cursor.execute("SELECT id,name,university_code FROM institutions ORDER BY name ASC,id ASC")
        rows=[dict(x) for x in cursor.fetchall()]
        return {"count":len(rows),"institutions":rows}
    finally: connection.close()


def library_summary(developer_user_id):
    connection=get_connection()
    try:
        cursor=connection.cursor(); _developer_user(cursor,developer_user_id,verified=True)
        cursor.execute("""SELECT COUNT(*) AS total, SUM(status='DRAFT') AS drafts, SUM(status='PUBLISHED') AS published, SUM(status='ARCHIVED') AS archived, SUM(featured=TRUE) AS featured FROM developer_library_resources""")
        summary=dict(cursor.fetchone() or {})
        cursor.execute("SELECT resource_type,COUNT(*) AS count FROM developer_library_resources GROUP BY resource_type ORDER BY resource_type")
        summary["by_type"]=[dict(x) for x in cursor.fetchall()]
        return summary
    finally: connection.close()


def all_verification_requests(super_admin_id, status=None):
    connection=get_connection()
    try:
        cursor=connection.cursor()
        cursor.execute("SELECT u.id,u.is_active,u.is_super_admin,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=%s LIMIT 1",(super_admin_id,)); admin=cursor.fetchone()
        if not admin or not bool(admin["is_active"]) or admin["role"]!="SUPER_ADMIN" or not bool(admin["is_super_admin"]):
            raise ForbiddenError("Only SUPER_ADMIN can view Developer verification requests")
        q="""SELECT dv.id AS verification_id,dv.user_id,dv.status,dv.remarks,dv.submitted_at,dv.verified_by,dv.verified_at,u.email,u.full_name,u.is_active,dp.developer_id,dp.designation,dp.department,dp.primary_role FROM developer_verifications dv JOIN users u ON u.id=dv.user_id JOIN developer_profiles dp ON dp.id=dv.developer_profile_id"""
        params=[]
        if status:
            status=status.upper()
            if status not in {"PENDING","VERIFIED","REJECTED"}: raise BadRequestError("Invalid verification status")
            q += " WHERE dv.status=%s"; params.append(status)
        q += " ORDER BY dv.submitted_at DESC"
        cursor.execute(q,tuple(params)); return {"developers":[dict(x) for x in cursor.fetchall()]}
    finally: connection.close()


def super_admin_activity_logs(super_admin_id, limit=200):
    connection=get_connection()
    try:
        cursor=connection.cursor(); cursor.execute("SELECT u.id,u.is_active,u.is_super_admin,r.name AS role FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=%s LIMIT 1",(super_admin_id,)); admin=cursor.fetchone()
        if not admin or not bool(admin["is_active"]) or admin["role"]!="SUPER_ADMIN" or not bool(admin["is_super_admin"]): raise ForbiddenError("Only SUPER_ADMIN can view Developer activity logs")
        limit=max(1,min(int(limit),1000)); cursor.execute(f"SELECT dal.*,u.full_name AS actor_name,u.email AS actor_email FROM developer_activity_logs dal JOIN users u ON u.id=dal.actor_user_id ORDER BY dal.created_at DESC LIMIT {limit}",( ))
        return {"logs":[dict(x) for x in cursor.fetchall()]}
    finally: connection.close()
