from app.database import get_connection


def get_professor_students(user_id, search=None, course_id=None, semester=None, page=1, limit=12):
    page = max(int(page or 1), 1)
    limit = min(max(int(limit or 12), 1), 100)
    offset = (page - 1) * limit

    connection = get_connection()
    try:
        cursor = connection.cursor()

        # Resolve the logged-in user to the real professor_profiles.id.
        cursor.execute(
            """
            SELECT pp.id AS professor_id, pp.institution_id, u.id AS user_id,
                   u.full_name, u.email, pp.department,
                   u.verification_status
            FROM professor_profiles pp
            INNER JOIN users u ON u.id = pp.user_id
            WHERE pp.user_id = %s
              AND u.is_active = TRUE
            LIMIT 1
            """,
            (user_id,),
        )
        professor = cursor.fetchone()
        if not professor:
            raise ValueError("Professor profile not found")

        # IMPORTANT:
        # Students are registered to their program + section in student_profiles.
        # The professor relationship comes from timetables.professor_id.
        # Do not require course_enrollments here: a student can be registered
        # in the section even when course_enrollments has not been populated.
        base = """
            FROM student_profiles sp
            INNER JOIN users su
                ON su.id = sp.user_id
            INNER JOIN institutions i
                ON i.id = sp.institution_id
            INNER JOIN programs p
                ON p.id = sp.program_id
            INNER JOIN sections s
                ON s.id = sp.section_id
               AND s.program_id = sp.program_id
            INNER JOIN timetables t
                ON t.institution_id = sp.institution_id
               AND t.program_id = sp.program_id
               AND t.section_id = sp.section_id
               AND t.professor_id = %s
            INNER JOIN courses c
                ON c.id = t.course_id
               AND c.institution_id = sp.institution_id
               AND c.program_id = sp.program_id
               AND c.semester = sp.semester
            WHERE sp.institution_id = %s
              AND su.is_active = TRUE
        """
        params = [professor["professor_id"], professor["institution_id"]]

        if search and search.strip():
            value = f"%{search.strip()}%"
            base += """
              AND (su.full_name LIKE %s
                OR su.email LIKE %s
                OR sp.enrollment_number LIKE %s
                OR sp.student_id LIKE %s
                OR p.name LIKE %s
                OR p.code LIKE %s
                OR s.name LIKE %s
                OR s.code LIKE %s
                OR c.name LIKE %s
                OR c.code LIKE %s)
            """
            params.extend([value] * 10)

        if course_id is not None:
            base += " AND c.id = %s"
            params.append(course_id)

        if semester is not None:
            base += " AND sp.semester = %s"
            params.append(semester)

        cursor.execute(
            f"SELECT COUNT(DISTINCT sp.id) AS total {base}",
            tuple(params),
        )
        total = int((cursor.fetchone() or {}).get("total") or 0)

        cursor.execute(
            f"""
            SELECT DISTINCT
                   sp.id AS student_profile_id,
                   su.id AS user_id,
                   su.full_name,
                   su.email,
                   su.is_active,
                   sp.phone,
                   sp.enrollment_number,
                   sp.student_id,
                   sp.academic_year,
                   sp.current_year,
                   sp.semester,
                   i.name AS institution_name,
                   i.university_code,
                   p.id AS program_id,
                   p.name AS program_name,
                   p.code AS program_code,
                   s.id AS section_id,
                   s.name AS section_name,
                   s.code AS section_code
            {base}
            ORDER BY su.full_name ASC, sp.enrollment_number ASC
            LIMIT %s OFFSET %s
            """,
            tuple(params + [limit, offset]),
        )
        rows = cursor.fetchall()

        # Build the courses actually taught by this professor for each student.
        user_ids = [row["user_id"] for row in rows]
        course_map = {}
        if user_ids:
            marks = ",".join(["%s"] * len(user_ids))
            cursor.execute(
                f"""
                SELECT DISTINCT
                       sp.user_id,
                       c.id AS course_id,
                       c.name AS course_name,
                       c.code AS course_code
                FROM student_profiles sp
                INNER JOIN timetables t
                    ON t.institution_id = sp.institution_id
                   AND t.program_id = sp.program_id
                   AND t.section_id = sp.section_id
                   AND t.professor_id = %s
                INNER JOIN courses c
                    ON c.id = t.course_id
                   AND c.institution_id = sp.institution_id
                   AND c.program_id = sp.program_id
                   AND c.semester = sp.semester
                WHERE sp.user_id IN ({marks})
                ORDER BY c.name ASC
                """,
                tuple([professor["professor_id"], *user_ids]),
            )
            for row in cursor.fetchall():
                course_map.setdefault(row["user_id"], []).append(
                    {
                        "course_id": row["course_id"],
                        "course_name": row["course_name"],
                        "course_code": row["course_code"],
                    }
                )

        students = []
        for row in rows:
            students.append(
                {
                    "user_id": row["user_id"],
                    "student_profile_id": row["student_profile_id"],
                    "full_name": row["full_name"],
                    "email": row["email"],
                    "phone": row["phone"],
                    "enrollment_number": row["enrollment_number"],
                    "student_id": row["student_id"],
                    "institution_name": row["institution_name"],
                    "university_code": row["university_code"],
                    "program_id": row["program_id"],
                    "program_name": row["program_name"],
                    "program_code": row["program_code"],
                    "section_id": row["section_id"],
                    "section_name": row["section_name"],
                    "section_code": row["section_code"],
                    "academic_year": row["academic_year"],
                    "current_year": row["current_year"],
                    "semester": row["semester"],
                    "is_active": bool(row["is_active"]),
                    "courses": course_map.get(row["user_id"], []),
                }
            )

        return {
            "message": "Professor students retrieved successfully",
            "professor": {
                "professor_id": professor["professor_id"],
                "user_id": professor["user_id"],
                "full_name": professor["full_name"],
                "email": professor["email"],
                "department": professor["department"],
                "verification_status": professor["verification_status"],
            },
            "count": len(students),
            "total": total,
            "page": page,
            "limit": limit,
            "students": students,
        }
    finally:
        connection.close()
