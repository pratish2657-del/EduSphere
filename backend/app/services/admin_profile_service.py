from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.database import get_connection


def _user(cursor, user_id):
    cursor.execute("""
        SELECT u.id,u.email,u.full_name,u.is_active,u.profile_completed,
               u.is_super_admin,u.role_id,r.name AS role
        FROM users u LEFT JOIN roles r ON u.role_id=r.id
        WHERE u.id=%s LIMIT 1
    """, (user_id,))
    row = cursor.fetchone()
    if not row: raise NotFoundError('User account not found')
    if not bool(row['is_active']): raise ForbiddenError('User account is inactive')
    return row


def _institution(cursor, code):
    code = code.strip()
    cursor.execute("SELECT id,name,university_code FROM institutions WHERE university_code=%s LIMIT 1", (code,))
    row = cursor.fetchone()
    if not row: raise NotFoundError(f"Institution with code '{code}' was not found")
    return row


def _verification(cursor, user_id):
    cursor.execute("""
        SELECT id,status,remarks,submitted_at,verified_by,verified_at
        FROM admin_verifications WHERE user_id=%s LIMIT 1
    """, (user_id,))
    return cursor.fetchone()


def _result(user, profile, verification):
    return {
        'id': profile['id'] if profile else None,
        'user_id': user['id'], 'email': user['email'], 'full_name': user['full_name'],
        'phone': profile['phone'] if profile else '',
        'upi_id': profile['upi_id'] if profile else '',
        'admin_id': profile['admin_id'] if profile else '',
        'department': profile['department'] if profile else '',
        'designation': profile['designation'] if profile else '',
        'office_information': (profile['office_information'] if profile else '') or '',
        'responsibilities': (profile['responsibilities'] if profile else '') or '',
        'profile_photo_url': (profile['profile_photo_url'] if profile else None),
        'institution_id': profile['institution_id'] if profile else None,
        'institution_name': profile['institution_name'] if profile else None,
        'institution_code': profile['institution_code'] if profile else '',
        'profile_completed': bool(user['profile_completed']),
        'role': user['role'],
        'verification_status': verification['status'] if verification else (user.get('verification_status') or 'NOT_SUBMITTED'),
        'verification_remarks': verification['remarks'] if verification else None,
        'submitted_at': verification['submitted_at'] if verification else None,
        'verified_at': verification['verified_at'] if verification else None,
        'is_active': bool(user['is_active']),
    }


def get_admin_profile(user_id):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        user = _user(cursor, user_id)
        cursor.execute("""
            SELECT ap.id,ap.user_id,ap.phone,ap.upi_id,ap.admin_id,ap.department,ap.designation,
                   ap.office_information,ap.responsibilities,ap.profile_photo_url,
                   ap.institution_id,i.name AS institution_name,i.university_code AS institution_code
            FROM admin_profiles ap INNER JOIN institutions i ON ap.institution_id=i.id
            WHERE ap.user_id=%s LIMIT 1
        """, (user_id,))
        profile = cursor.fetchone()
        return _result(user, profile, _verification(cursor, user_id))
    finally:
        connection.close()


def create_admin_profile(user_id, data):
    connection = get_connection()
    try:
        cursor = connection.cursor()
        user = _user(cursor, user_id)
        if bool(user['is_super_admin']): raise ForbiddenError('Super Admin accounts do not use the Admin Application flow')
        if user['role'] in ('STUDENT','PROFESSOR'): raise ForbiddenError('This account already has another platform role')
        institution = _institution(cursor, data.institution_code)

        cursor.execute("SELECT id FROM admin_profiles WHERE user_id=%s LIMIT 1", (user_id,))
        if cursor.fetchone(): raise ConflictError('Admin application already exists. Use update to resubmit.')
        cursor.execute("SELECT id FROM admin_profiles WHERE admin_id=%s LIMIT 1", (data.admin_id.strip(),))
        if cursor.fetchone(): raise ConflictError('This Admin ID is already in use')

        cursor.execute("""
            INSERT INTO admin_profiles
            (user_id,institution_id,admin_id,phone,department,designation,office_information,responsibilities,profile_photo_url)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (user_id,institution['id'],data.admin_id.strip(),data.phone.strip(),data.department.strip(),
              data.designation.strip(),data.office_information.strip(),data.responsibilities.strip(),data.profile_photo_url))
        profile_id = cursor.lastrowid
        cursor.execute("""
            INSERT INTO admin_verifications (user_id,admin_profile_id,status,submitted_at)
            VALUES (%s,%s,'PENDING',CURRENT_TIMESTAMP)
        """, (user_id,profile_id))
        # Do not assign ADMIN here. Super Admin approval does that.
        cursor.execute("UPDATE users SET profile_completed=TRUE,verification_status='PENDING' WHERE id=%s", (user_id,))
        connection.commit()
        return get_admin_profile(user_id)
    except Exception:
        connection.rollback(); raise
    finally: connection.close()


def update_admin_profile(user_id, data):
    connection = get_connection()
    try:
        cursor = connection.cursor(); user = _user(cursor, user_id)
        if bool(user['is_super_admin']): raise ForbiddenError('Super Admin accounts do not use the Admin Application flow')
        if user['role'] in ('STUDENT','PROFESSOR'): raise ForbiddenError('This account already has another platform role')
        institution = _institution(cursor, data.institution_code)
        cursor.execute("SELECT id FROM admin_profiles WHERE user_id=%s LIMIT 1", (user_id,))
        profile = cursor.fetchone()
        if not profile: return create_admin_profile(user_id, data)
        verification = _verification(cursor, user_id)
        if verification and verification['status']=='PENDING': raise ConflictError('Your Admin application is already pending review.')
        cursor.execute("SELECT id FROM admin_profiles WHERE admin_id=%s AND user_id<>%s LIMIT 1", (data.admin_id.strip(),user_id))
        if cursor.fetchone(): raise ConflictError('This Admin ID is already in use')
        cursor.execute("""
            UPDATE admin_profiles SET institution_id=%s,admin_id=%s,phone=%s,department=%s,
            designation=%s,office_information=%s,responsibilities=%s,profile_photo_url=%s
            WHERE user_id=%s
        """, (institution['id'],data.admin_id.strip(),data.phone.strip(),data.department.strip(),
              data.designation.strip(),data.office_information.strip(),data.responsibilities.strip(),data.profile_photo_url,user_id))
        if verification:
            cursor.execute("""
                UPDATE admin_verifications SET status='PENDING',remarks=NULL,verified_by=NULL,
                verified_at=NULL,submitted_at=CURRENT_TIMESTAMP WHERE user_id=%s
            """, (user_id,))
        else:
            cursor.execute("""
                INSERT INTO admin_verifications (user_id,admin_profile_id,status,submitted_at)
                VALUES (%s,%s,'PENDING',CURRENT_TIMESTAMP)
            """, (user_id,profile['id']))
        cursor.execute("UPDATE users SET profile_completed=TRUE,verification_status='PENDING' WHERE id=%s", (user_id,))
        connection.commit(); return get_admin_profile(user_id)
    except Exception:
        connection.rollback(); raise
    finally: connection.close()
