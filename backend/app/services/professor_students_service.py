from app.database import get_connection


def get_professor_students(user_id, search=None, course_id=None, semester=None, page=1, limit=12):
    page = max(int(page or 1), 1)
    limit = min(max(int(limit or 12), 1), 100)
    offset = (page - 1) * limit
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT pp.id AS professor_id, pp.institution_id, u.id AS user_id,
                   u.full_name, u.email, pp.department, u.verification_status
            FROM professor_profiles pp
            INNER JOIN users u ON u.id=pp.user_id
            WHERE pp.user_id=%s
              AND u.is_active=TRUE
            LIMIT 1
        """, (user_id,))
        professor = cursor.fetchone()
        if not professor:
            raise ValueError("Professor profile not found")

        base = """
            FROM student_profiles sp
            INNER JOIN users su
                ON su.id=sp.user_id
            INNER JOIN institutions i
                ON i.id=sp.institution_id
            INNER JOIN programs p
                ON p.id=sp.program_id
            INNER JOIN sections s
                ON s.id=sp.section_id
               AND s.program_id=sp.program_id
            INNER JOIN course_enrollments ce
                ON ce.student_id=su.id
                OR ce.student_id=sp.id
            INNER JOIN courses c
                ON c.id=ce.course_id
            INNER JOIN timetables t
                ON t.course_id=c.id
               AND t.professor_id=%s
               AND t.institution_id=sp.institution_id
               AND t.program_id=sp.program_id
               AND t.section_id=sp.section_id
            WHERE sp.institution_id=%s
              AND su.is_active=TRUE
        """
        params = [professor["professor_id"], professor["institution_id"]]
        if search:
            v = f"%{search.strip()}%"
            base += " AND (su.full_name LIKE %s OR su.email LIKE %s OR sp.enrollment_number LIKE %s OR sp.student_id LIKE %s OR p.name LIKE %s OR p.code LIKE %s OR s.name LIKE %s OR s.code LIKE %s OR c.name LIKE %s OR c.code LIKE %s)"
            params.extend([v] * 10)
        if course_id is not None:
            base += " AND c.id=%s"; params.append(course_id)
        if semester is not None:
            base += " AND sp.semester=%s"; params.append(semester)

        cursor.execute(f"SELECT COUNT(DISTINCT sp.id) AS total {base}", tuple(params))
        total = int((cursor.fetchone() or {}).get("total") or 0)

        cursor.execute(f"""
            SELECT sp.id AS student_profile_id, su.id AS user_id, su.full_name, su.email,
                   su.is_active, sp.phone, sp.enrollment_number, sp.student_id,
                   sp.academic_year, sp.current_year, sp.semester,
                   i.name AS institution_name, i.university_code,
                   p.id AS program_id, p.name AS program_name, p.code AS program_code,
                   s.id AS section_id, s.name AS section_name, s.code AS section_code
            {base}
            GROUP BY sp.id,su.id,su.full_name,su.email,su.is_active,sp.phone,
                     sp.enrollment_number,sp.student_id,sp.academic_year,sp.current_year,
                     sp.semester,i.name,i.university_code,p.id,p.name,p.code,s.id,s.name,s.code
            ORDER BY su.full_name ASC, sp.enrollment_number ASC
            LIMIT %s OFFSET %s
        """, tuple(params + [limit, offset]))
        rows = cursor.fetchall()

        user_ids = [r["user_id"] for r in rows]
        course_map = {}
        if user_ids:
            marks = ",".join(["%s"] * len(user_ids))
            cursor.execute(f"""
                SELECT DISTINCT
                       su.id AS user_id,
                       c.id AS course_id,
                       c.name AS course_name,
                       c.code AS course_code
                FROM student_profiles sp
                INNER JOIN users su
                    ON su.id=sp.user_id
                INNER JOIN course_enrollments ce
                    ON ce.student_id=su.id
                    OR ce.student_id=sp.id
                INNER JOIN courses c
                    ON c.id=ce.course_id
                INNER JOIN timetables t
                    ON t.course_id=c.id
                   AND t.professor_id=%s
                   AND t.institution_id=sp.institution_id
                   AND t.program_id=sp.program_id
                   AND t.section_id=sp.section_id
                WHERE su.id IN ({marks})
                ORDER BY c.name ASC
            """, tuple([professor["professor_id"], *user_ids]))
            for r in cursor.fetchall():
                course_map.setdefault(r["user_id"], []).append({
                    "course_id": r["course_id"], "course_name": r["course_name"], "course_code": r["course_code"]
                })

        students = []
        for r in rows:
            students.append({
                "user_id": r["user_id"], "student_profile_id": r["student_profile_id"],
                "full_name": r["full_name"], "email": r["email"], "phone": r["phone"],
                "enrollment_number": r["enrollment_number"], "student_id": r["student_id"],
                "institution_name": r["institution_name"], "university_code": r["university_code"],
                "program_id": r["program_id"], "program_name": r["program_name"], "program_code": r["program_code"],
                "section_id": r["section_id"], "section_name": r["section_name"], "section_code": r["section_code"],
                "academic_year": r["academic_year"], "current_year": r["current_year"], "semester": r["semester"],
                "is_active": bool(r["is_active"]), "courses": course_map.get(r["user_id"], [])
            })
        return {
            "message": "Professor students retrieved successfully",
            "professor": {"professor_id": professor["professor_id"], "user_id": professor["user_id"],
                          "full_name": professor["full_name"], "email": professor["email"],
                          "department": professor["department"], "verification_status": professor["verification_status"]},
            "count": len(students), "total": total, "page": page, "limit": limit, "students": students
        }
    finally:
        connection.close()