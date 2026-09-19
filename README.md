EduSphere

EduSphere x StudyFlow --- a student-focused academic ecosystem and
marketplace with role-based campus management, learning resources,
developer tooling, and an AI-powered study assistant.

Overview
EduSphere is a full-stack education platform designed to bring academic
activities and student services into one system.

The platform combines:

Student academic management

Professor and teaching workflows

Administrator and Super Admin controls

Timetables and course management

Student attendance

Examination results

Digital library and learning resources

Marketplace for educational products/resources

Developer workspace with a browser-based VS Code-compatible IDE

AI-powered study assistance through StudyFlow AI

Google authentication

Cloud deployment and persistent storage

The project is designed around a role-based architecture so that
students, professors, administrators, Super Admins, and developers
receive different capabilities and permissions.

Core Vision
EduSphere aims to provide a unified digital environment for an
educational institution instead of requiring students and faculty to use
many disconnected systems.

Main goals
Make academic information accessible from one dashboard.

Give professors tools for courses, timetables, students, and
attendance.

Give administrators tools for institutional management.

Provide students with learning resources and academic information.

Provide a marketplace for educational resources and products.

Provide a controlled developer workspace for building and submitting
code.

Add AI-assisted study workflows through StudyFlow AI.

Major Modules
1. Authentication
EduSphere supports Google OAuth authentication.

Authentication flow
User
  ↓
EduSphere Frontend
  ↓
FastAPI Backend
  ↓
Google OAuth
  ↓
Google Callback
  ↓
Authenticated EduSphere Session
  ↓
Role / Profile Resolution
  ↓
Appropriate Dashboard
The platform uses role and profile information to determine what the
authenticated user can access.

2. Role-Based Access
EduSphere is designed around multiple roles.

Student
Students can access features such as:

Student dashboard

Academic profile

Timetable

Courses

Attendance

Examination results

Library

Marketplace

StudyFlow AI

Professor
Professors can access:

Professor dashboard

Assigned courses

Course details

Students belonging to their teaching sections

Timetable

Attendance

Academic workflows

Admin
Administrators manage institution-level academic data such as:

Students

Professors

Programs

Sections

Courses

Timetables

Academic configuration

Super Admin
Super Admin provides higher-level platform control, including:

User/institution management

Verification workflows

Library administration

Marketplace administration

Developer approval/review workflows

Platform-level controls

Developer
Developers receive a controlled development environment where they can:

Create and edit code

Work inside an isolated browser IDE

Save files to the EduSphere developer workspace

Synchronize IDE files with EduSphere

Submit files for Super Admin review

Developer access can be subject to Super Admin verification/approval.

3. Student Academic System
The academic system connects:

Institution
   ↓
Program
   ↓
Section
   ↓
Student Profile
   ↓
Courses
   ↓
Timetable
   ↓
Attendance / Results
Students are associated with academic programs and sections.

The timetable system supports:

Day

Start time

End time

Course

Professor

Section

Room

Semester

Academic year

4. Professor System
The professor module provides teaching-oriented workflows.

Professor dashboard
Professors can view information related to their teaching activities.

Professor courses
Professors can view assigned courses and course details.

Course information can include:

Course name

Course code

Semester

Section

Timetable day

Start/end time

Room

Professor students
The student roster is based on academic section relationships and
teaching assignments.

Attendance
Professors can record attendance for students in courses they are
authorized to teach.

The attendance data model includes:

attendance
├── id
├── student_id
├── course_id
├── attendance_date
└── status
5. Timetable System
EduSphere includes timetable management for students, professors, and
administrators.

The timetable connects courses, sections, professors, and rooms.

A simplified relationship is:

Program
  ↓
Section
  ↓
Timetable
  ├── Course
  ├── Professor
  ├── Day
  ├── Time
  └── Room
Administrator workflows can assign professors to timetable entries.

Professor assignments are validated against the appropriate professor
profile and verification state.

6. Examination Results
EduSphere supports examination-result records.

The result system stores information such as:

Student profile

Course

Exam type

Academic year

Semester

Marks obtained

Maximum marks

Grade

Grade point

Credits

Credit points

Result status

Uploader

Timestamps

Possible result statuses include:

PASS
FAIL
ABSENT
WITHHELD
7. Digital Library
The Library provides digital learning resources.

Resources can contain:

Title

Author

ISBN

Category

Subject

Description

Language

Publication year

Tags

Resource type

File

Cover

Status

Featured state

Persistent file storage
Library files use Supabase Storage rather than depending on a
web-service local filesystem.

The intended production architecture is:

Student / Admin
      ↓
FastAPI
      ↓
Supabase Storage
      ↓
Private Library Bucket
      ↓
Time-limited Signed URL
The library bucket should remain private, with protected downloads
served through signed URLs.

8. Marketplace
EduSphere includes an educational marketplace designed for buying and
selling educational products/resources.

Marketplace functionality includes concepts such as:

Products

Attachments

Cart

Orders

Order items

Payments

Refunds

Inventory reservation

Seller payouts

Payout transactions

Payout reversals

Payment webhook events

The database contains marketplace tables including:

marketplace_products
marketplace_attachments
marketplace_carts
marketplace_cart_items
marketplace_orders
marketplace_order_items
marketplace_payments
marketplace_payment_webhook_events
marketplace_refunds
marketplace_seller_payouts
marketplace_seller_payout_transactions
marketplace_payout_reversals
The marketplace payment architecture was being transitioned from
Razorpay Route toward Cashfree Easy Split for marketplace
split/payout workflows.

Payment provider activation, production credentials, KYC, and payout
eligibility depend on the provider's current requirements and should
be configured separately from the application code.

9. Developer Workspace
EduSphere contains a dedicated Developer Workspace.

The goal is to provide developers with a browser-accessible development
environment without mounting the main EduSphere source tree or
production secrets directly into the IDE.

Browser IDE
The IDE uses:

code-server

nginx

FastAPI-based IDE bridge

Docker

Render

Architecture:

Developer Workspace
        ↓
Vercel Frontend
        ↓
Public IDE URL
        ↓
nginx
   ┌────┴────┐
   ↓         ↓
code-server  IDE API
   ↓         ↓
workspace   files
Each developer receives an isolated workspace:

/home/coder/workspace/<developer_id>
Two-way synchronization
EduSphere supports both directions:

EduSphere DB
     ↓
 Export DB
     ↓
 Browser IDE
and:

Browser IDE
     ↓
 Sync IDE
     ↓
 EduSphere DB
This allows developers to edit code in the browser IDE while keeping an
EduSphere-managed copy.

Submission workflow
Developer edits code
        ↓
Save in IDE
        ↓
Sync IDE
        ↓
Submit file
        ↓
Super Admin review
        ↓
Approved / Rejected
Accepted submissions are reviewed before being used in the platform.
They are not automatically deployed into EduSphere.

10. StudyFlow AI
StudyFlow AI is EduSphere's AI-powered study assistant.

The concept is to help students turn study material into more useful
exam-preparation content.

Potential workflows include:

Note organization

Summaries

Exam-ready study material

Study assistance

Learning support

The AI interface is branded as StudyFlow AI inside EduSphere.

Technology Stack
Frontend
React
TypeScript
Vite
Tailwind CSS
React Router
Lucide React
The frontend is deployed on Vercel.

Backend
Python
FastAPI
Uvicorn
The backend is deployed on Render.

Database
MySQL 8.x
Production database hosting uses Aiven MySQL.

Authentication
Google OAuth
Session-based authentication
Role-based authorization
File Storage
Supabase Storage
Private buckets
Signed URLs
Browser IDE
code-server
Docker
nginx
FastAPI
Supervisor
Deployment
Vercel
Render
Aiven
Supabase
Google Cloud OAuth
Production Architecture
                         ┌──────────────────┐
                         │      USERS       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │     VERCEL      │
                         │ React + Vite     │
                         └────────┬─────────┘
                                  │ HTTPS
                                  ▼
                         ┌──────────────────┐
                         │     RENDER       │
                         │ FastAPI Backend  │
                         │ edusphere-fovh   │
                         └───────┬───┬──────┘
                                 │   │
                    ┌────────────┘   └───────────────┐
                    ▼                                ▼
           ┌─────────────────┐              ┌─────────────────┐
           │      AIVEN      │              │     SUPABASE    │
           │     MySQL       │              │ Storage / Files │
           └─────────────────┘              └─────────────────┘

                                  │
                                  │ Developer IDE
                                  ▼
                         ┌──────────────────┐
                         │     RENDER       │
                         │  edusphere-ide   │
                         │                  │
                         │ nginx            │
                         │ code-server      │
                         │ IDE API          │
                         └──────────────────┘
Database Model
Important academic tables include:

institutions
programs
sections
users
roles
student_profiles
professor_profiles
admin_profiles
courses
timetables
course_teachers
course_enrollments
attendance
examination_results
professor_verifications
The system intentionally separates user identity from academic profiles.

For example:

users
  ↓
student_profiles

users
  ↓
professor_profiles

users
  ↓
admin_profiles
This allows platform authentication and academic information to remain
logically separated.

Environment Variables
Never commit production secrets to GitHub.

Typical frontend configuration includes:

VITE_API_BASE_URL=https://edusphere-fovh.onrender.com
VITE_DEVELOPER_IDE_URL=https://edusphere-ide.onrender.com
Backend configuration includes database, OAuth, CORS, storage, and
developer IDE settings.

Example:

DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

CORS_ORIGINS=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_LIBRARY_BUCKET=library

DEVELOPER_IDE_INTERNAL_URL=
DEVELOPER_IDE_SHARED_SECRET=
Security
Never commit:

Database passwords

OAuth client secrets

Supabase service-role keys

Developer IDE shared secrets

Payment provider secret keys

Production API keys

Use environment variables in Vercel, Render, Aiven/Supabase
configuration, or another secure secret-management mechanism.

Local Development
Frontend
From the frontend directory:

npm install
npm run dev
The Vite development server normally runs on:

http://localhost:5173
Backend
Create the backend environment configuration and install the Python
dependencies required by the project.

Run FastAPI with Uvicorn, for example:

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
The local backend normally runs on:

http://localhost:8000
Browser IDE
The repository includes the developer IDE Docker configuration.

A local development environment can use:

docker compose -f docker-compose.developer-workspace.yml up -d
The production browser IDE is deployed separately from the main FastAPI
service.

Deployment
Frontend --- Vercel
The Vercel project uses:

Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
Production API configuration:

VITE_API_BASE_URL=https://edusphere-fovh.onrender.com
Developer IDE configuration:

VITE_DEVELOPER_IDE_URL=https://edusphere-ide.onrender.com
For client-side routing, the Vercel deployment uses a rewrite to
index.html.

Backend --- Render
The FastAPI backend runs as a Render web service.

The application must listen on the Render-provided port and on:

0.0.0.0
Production OAuth callback:

https://edusphere-fovh.onrender.com/auth/google/callback
Developer IDE --- Render
The browser IDE runs as the separate:

edusphere-ide
service.

The container runs:

nginx
code-server
IDE API
supervisor
nginx exposes the public Render port and routes traffic internally to
code-server and the IDE bridge.

Database --- Aiven
Production MySQL is hosted by Aiven.

The backend connects using environment variables rather than hard-coded
credentials.

Security Architecture
EduSphere is designed with several boundaries.

API authorization
Backend routes should validate:

Authentication

User role

Institution ownership

Profile ownership

Resource ownership

Verification state where applicable

Developer isolation
The browser IDE should not have direct access to:

Production application source code

Production secrets

Database credentials

Deployment credentials

The IDE communicates through a controlled bridge.

Library security
Library resources are intended to use private storage and signed URLs
rather than exposing storage objects publicly.

Marketplace security
Payment state should be confirmed server-side through payment-provider
mechanisms/webhooks rather than trusting frontend payment status.

Project Structure
A simplified project structure is:

EduSphere/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── public/
│   ├── package.json
│   ├── vercel.json
│   └── ...
│
├── backend/
│   └── app/
│       ├── routes/
│       ├── services/
│       ├── schemas/
│       ├── middleware/
│       └── ...
│   
│
├── developer-ide/
│   ├── Dockerfile
│   ├── start.sh
│   ├── nginx.conf
│   ├── supervisord.conf
│   ├── ide_api.py
│   └── requirements.txt
│
├── docker-compose.developer-workspace.yml
└── README.md
The exact directory structure can evolve as the project grows.

Development Workflow
A typical feature workflow is:

1. Create / update database schema
2. Update backend schema/service
3. Add or update API route
4. Update frontend API integration
5. Build frontend
6. Test locally
7. Commit changes
8. Push to GitHub
9. Deploy
10. Test production
For developer-workspace features:

Edit code in Browser IDE
        ↓
Save
        ↓
Sync IDE
        ↓
EduSphere DB copy updated
        ↓
Submit
        ↓
Super Admin review
Testing Checklist
Before considering a production release, test:

Authentication
Google login

OAuth callback

Session persistence

Logout

Role-based routing

Student
Profile

Dashboard

Timetable

Courses

Attendance

Results

Library

Professor
Dashboard

Assigned courses

Course details

Student roster

Timetable

Attendance

Admin
Student management

Professor management

Course management

Section management

Timetable management

Professor assignment

Library
Create resource

Upload file

Optional cover

Private storage

Download

Delete

Update

Re-upload after migration

Marketplace
Product creation

Product listing

Cart

Order

Payment

Webhook

Refund

Seller payout

Inventory

Developer Workspace
IDE health

Open IDE

Workspace isolation

Export DB → IDE

Edit file in IDE

Save file

Sync IDE → DB

Submit file

Super Admin review

Important Production Notes
Render Free Services
Render Free web services can spin down after inactivity. For workloads
that require continuous availability, use an appropriate paid compute
plan.

This is particularly relevant for:

edusphere-fovh

edusphere-ide

Database Availability
The production application depends on Aiven MySQL being available.

If the database service is powered off, the backend cannot perform
normal database operations.

IDE Persistence
The code-server container filesystem should not be treated as the
permanent source of truth.

The application maintains an EduSphere-managed copy and synchronization
mechanism for developer files.

GitHub Repository Guidelines
Do not commit:

.env
.env.*
*.pem
*.key
credentials.json
service-account.json
production secrets
database dumps containing private data
Use an .env.example file instead:

DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

CORS_ORIGINS=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_LIBRARY_BUCKET=library

DEVELOPER_IDE_INTERNAL_URL=
DEVELOPER_IDE_SHARED_SECRET=
Roadmap
Possible future improvements include:

Stronger developer IDE authentication

Automated code review

Git integration inside Developer Workspace

Better marketplace seller onboarding

Production payment-provider activation

Notification system

Advanced analytics

AI-powered study plans

AI note processing

Institution-wide announcements

Mobile application

Automated testing and CI/CD

Improved observability and audit logs

Project Status
EduSphere is an actively developed full-stack platform.

The system already includes the core architecture for:

Authentication

Role-based dashboards

Academic management

Timetables

Attendance

Results

Library

Marketplace

Developer Workspace

Browser-based IDE

StudyFlow AI integration

Cloud deployment

Some production capabilities, especially payment-provider production
onboarding, KYC/verification, billing tiers, and third-party service
limits, depend on external provider requirements and account
configuration.

Contributing
Fork the repository.

Create a feature branch.

git checkout -b feature/my-feature
Make your changes.

Test the changes locally.

Commit them.

git add .
git commit -m "Add my feature"
Push the branch.

git push origin feature/my-feature
Open a Pull Request.

License
Add the project's chosen license here before publishing the repository
publicly.

EduSphere
EduSphere x StudyFlow

A unified education platform connecting students, professors,
administrators, developers, learning resources, marketplaces, and
AI-assisted study workflows.
