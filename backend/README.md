# EduSphere Backend

EduSphere is a role-based educational management platform designed to provide a centralized backend for students, professors, administrators, developers, and super administrators.

The backend is built with **FastAPI** and **MySQL**, with a modular architecture separating routes, services, schemas, authentication, middleware, and database access.

---

## Features

### Authentication & Authorization

- Google-based authentication
- User authentication and authorization
- Role-based access control
- Protected API routes
- Active/inactive user handling
- Profile completion tracking
- Verification status management
- Super administrator privileges

### Supported Roles

EduSphere supports the following major roles:

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Highest-level platform administrator with global administrative privileges |
| `ADMIN` | Institution-level administrator responsible for academic and administrative management |
| `DEVELOPER` | Development/system role for platform-level technical operations |
| `PROFESSOR` | Faculty member who manages courses, timetable, students, and academic results |
| `STUDENT` | Student who accesses academic information, results, timetable, attendance, events, and marketplace functionality |

Role-based permissions are enforced through the backend authentication and authorization layer.

---

# Technology Stack

| Technology | Purpose |
|------------|---------|
| Python | Backend programming language |
| FastAPI | REST API framework |
| MySQL | Relational database |
| PyMySQL | MySQL database connectivity |
| Pydantic | Request/response validation |
| Google Authentication | User authentication |
| Pytest | Automated testing |
| Ruff | Python linting |
| Uvicorn | ASGI application server |

---

# Project Structure

```text
backend/
│
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── database.py
│   │
│   ├── auth/
│   │   ├── __init__.py
│   │   └── google.py
│   │
│   ├── core/
│   │   └── exceptions.py
│   │
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth_guard.py
│   │
│   ├── models/
│   │   └── __init__.py
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── ai.py
│   │   ├── attendance.py
│   │   ├── auth.py
│   │   ├── course.py
│   │   ├── dashboard.py
│   │   ├── event.py
│   │   ├── marketplace.py
│   │   ├── marketplace_payment.py
│   │   ├── professor.py
│   │   ├── professor_dashboard.py
│   │   ├── professor_verification.py
│   │   ├── profile.py
│   │   ├── program.py
│   │   ├── protected.py
│   │   ├── result.py
│   │   ├── section.py
│   │   ├── student.py
│   │   ├── timetable.py
│   │   └── users.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── ai.py
│   │   ├── attendance.py
│   │   ├── course.py
│   │   ├── event.py
│   │   ├── marketplace.py
│   │   ├── marketplace_payment.py
│   │   ├── professor.py
│   │   ├── professor_verification.py
│   │   ├── profile.py
│   │   ├── program.py
│   │   ├── result.py
│   │   ├── section.py
│   │   ├── student.py
│   │   ├── timetable.py
│   │   └── user.py
│   │
│   └── services/
│       ├── __init__.py
│       ├── admin_service.py
│       ├── ai_context_service.py
│       ├── ai_service.py
│       ├── attendance_service.py
│       ├── course_service.py
│       ├── event_service.py
│       ├── marketplace_order_service.py
│       ├── marketplace_payment_service.py
│       ├── marketplace_service.py
│       ├── payment_gateway_service.py
│       ├── payment_webhook_service.py
│       ├── professor_service.py
│       ├── professor_verification_service.py
│       ├── profile_service.py
│       ├── program_service.py
│       ├── result_service.py
│       ├── section_service.py
│       ├── student_service.py
│       ├── timetable_service.py
│       └── user_service.py
│
├── tests/
│   ├── __init__.py
│   ├── test_admin.py
│   ├── test_ai.py
│   ├── test_api.py
│   ├── test_attendance.py
│   ├── test_course.py
│   ├── test_dashboard.py
│   ├── test_event.py
│   ├── test_marketplace.py
│   ├── test_mysql.py
│   ├── test_professor.py
│   ├── test_professor_verification.py
│   ├── test_profile.py
│   ├── test_program.py
│   ├── test_result.py
│   ├── test_section.py
│   ├── test_student.py
│   ├── test_timetable.py
│   └── test_users.py
│
├── .env
├── .gitignore
├── openapi-check.json
├── requirements.txt
└── README.md

Architecture

EduSphere follows a layered backend architecture.

Client
   │
   ▼
FastAPI Routes
   │
   ▼
Authentication / Authorization
   │
   ▼
Pydantic Schemas
   │
   ▼
Service Layer
   │
   ▼
MySQL Database
Routes

Routes expose HTTP endpoints and handle:

Authentication
Authorization
Request processing
HTTP responses
Error handling
Schemas

Pydantic schemas validate incoming API requests and define structured API data.

Services

Business logic is primarily organized into dedicated service modules.

Examples:

student_service.py
professor_service.py
result_service.py
attendance_service.py
course_service.py
timetable_service.py
program_service.py
section_service.py
marketplace_service.py
Database

Database access is centralized through the application's database layer and MySQL.

Core Modules
Authentication

EduSphere supports Google authentication and maintains authenticated user information.

Authentication includes:

Google login
User creation
Role assignment
Authentication guards
Protected routes
User Management

User management provides functionality for:

User records
Roles
Account status
Profile completion
Verification status
Super administrator status
Student Management

Students can have academic profiles containing:

Phone number
Institution
Enrollment number
Program
Section
Academic year
Current year
Semester
Student ID
Admission year

Academic entities are represented using relational IDs.

Institution
    │
    └── Program
          │
          └── Section
                │
                └── Student
Professor Management

Professor profiles support:

Employee ID
Institution
Department
Designation
Specialization
Subjects
Academic experience
Office information
Verification details
Professor Verification

Professor verification functionality provides administrative control over professor verification status.

Programs

Administrators can manage academic programs.

Programs contain information such as:

Institution
Program name
Program code
Degree
Duration
Active status

Example:

B.Tech in Computer Science and Engineering
Sections

Programs can contain multiple sections.

A section includes:

Program
Section name
Section code
Batch start year
Batch end year
Active status

Example:

Program: CSE-AI
Section: CSE-AI-A
Batch: 2025 - 2029
Courses

Course management supports academic course relationships and professor assignments.

Courses can be associated with:

Programs
Semesters
Professors
Sections
Academic information
Timetable

The timetable module manages scheduled academic activities.

Timetable information can include:

Professor
Course
Program
Section
Day
Time
Academic scheduling information
Attendance

The attendance module provides functionality for managing student attendance records.

Examination Results

The result module supports:

Creating results
Updating results
Deleting results
Student result access
Professor authorization
Administrator result management
Duplicate result protection
Marks validation
Result attachments

Result access is protected according to the authenticated user's role and ownership.

Events

The event module provides educational and institutional event functionality.

Marketplace

EduSphere includes marketplace functionality for educational-related products/services.

The marketplace architecture includes:

Marketplace
    │
    ├── Products / Listings
    │
    ├── Orders
    │
    └── Payments

Payment-related services include:

Payment gateway integration layer
Payment processing
Payment webhooks
Order/payment management
AI

The AI module provides AI-related backend functionality.

Components include:

ai_service.py
ai_context_service.py

The AI context service provides application context for AI-powered functionality.

Database Structure

The backend uses MySQL as its primary relational database.

Major entities include:

users
roles
institutions
student_profiles
professor_profiles
programs
sections
courses
course_teachers
timetables
attendance
examination_results
result_attachments
events
marketplace
orders
payments

Academic relationships follow a normalized relational structure.

For example:

institutions
     │
     ├── programs
     │      │
     │      └── sections
     │
     ├── student_profiles
     │
     └── professor_profiles