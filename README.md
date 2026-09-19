✨ Overview

EduSphere is a full-stack education platform designed to bring academic activities, learning resources, student services, marketplace functionality, developer tooling, and AI-assisted study workflows into one system.

Instead of relying on multiple disconnected systems, EduSphere provides role-based access to students, professors, administrators, Super Admins, and developers.

Core Platform

🎓 Student academic management

👨‍🏫 Professor and teaching workflows

🛡️ Administrator and Super Admin controls

🗓️ Timetable and course management

✅ Attendance management

📊 Examination results

📚 Digital library and learning resources

🛒 Educational marketplace

💻 Browser-based Developer Workspace

🤖 EduSphere AI for AI-assisted study workflows

🔐 Google authentication

☁️ Cloud deployment and persistent storage

🎯 Vision

EduSphere aims to provide a unified digital environment for educational institutions.

Main Goals

Centralize academic information in one dashboard.

Give professors tools for courses, timetables, students, and attendance.

Give administrators institution-level management tools.

Give students access to learning resources and academic information.

Provide a marketplace for educational products and resources.

Provide a controlled browser-based development environment.

Add AI-assisted study workflows through EduSphere AI.

🧩 Major Modules

1. 🔐 Authentication

EduSphere uses Google OAuth with session-based authentication and role-based authorization.

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
Authenticated Session
  ↓
Role / Profile Resolution
  ↓
Appropriate Dashboard

The authenticated user's role and academic profile determine which parts of the platform are accessible.

2. 👥 Role-Based Access

EduSphere is designed around multiple roles.

Student

Students can access:

Student Dashboard

Academic Profile

Timetable

Courses

Attendance

Examination Results

Digital Library

Marketplace

EduSphere AI

Professor

Professors can access:

Professor Dashboard

Assigned Courses

Course Details

Students belonging to their teaching sections

Timetable

Attendance

Academic workflows

Administrator

Administrators manage institution-level academic data, including:

Students

Professors

Programs

Sections

Courses

Timetables

Academic configuration

Super Admin

Super Admin functionality includes:

User and institution management

Verification workflows

Library administration

Marketplace administration

Developer approval and review workflows

Platform-level controls

Developer

Developers receive a controlled development environment where they can:

Create and edit code

Work inside an isolated browser IDE

Save files to an EduSphere-managed workspace

Synchronize IDE files with EduSphere

Submit files for Super Admin review

Developer access may require Super Admin verification or approval.

🎓 Academic Management

Student Academic System

The academic system connects institutional and student information through:

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

Timetable

Timetable records can contain:

Day

Start time

End time

Course

Professor

Section

Room

Semester

Academic year

👨‍🏫 Professor System

The professor module provides teaching-oriented workflows.

Professor Courses

Course information can include:

Course name

Course code

Semester

Section

Timetable day

Start/end time

Room

Student Roster

Professor student lists are based on academic section relationships and teaching assignments.

Attendance

Authorized professors can record attendance for students in their courses.

attendance
├── id
├── student_id
├── course_id
├── attendance_date
└── status

📊 Examination Results

EduSphere supports examination-result records containing information such as:

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

PASS · FAIL · ABSENT · WITHHELD

📚 Digital Library

The EduSphere Library provides digital learning resources.

Resources may contain:

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

🔒 Private File Storage

Library files use Supabase Storage.

Student / Admin
      ↓
FastAPI
      ↓
Supabase Storage
      ↓
Private Library Bucket
      ↓
Time-limited Signed URL

The library bucket is intended to remain private, with protected downloads served through signed URLs.

🛒 Marketplace

EduSphere includes an educational marketplace for buying and selling educational products and resources.

Marketplace Features

Products

Attachments

Shopping carts

Orders

Order items

Payments

Refunds

Inventory reservation

Seller payouts

Payout transactions

Payout reversals

Payment webhook events

Database Tables

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

The payment architecture has been transitioning from Razorpay Route toward Cashfree Easy Split for marketplace split and payout workflows.

Payment-provider activation, production credentials, KYC, and payout eligibility depend on the provider's current requirements and account configuration.

💻 Developer Workspace

EduSphere contains a dedicated Developer Workspace designed to provide developers with a browser-accessible development environment.

The workspace is designed so that developers do not receive direct access to the main EduSphere source tree or production secrets.

Browser IDE Stack

code-server

nginx

FastAPI IDE bridge

Docker

Render

Architecture

Developer Workspace
        ↓
Vercel Frontend
        ↓
Public IDE URL
        ↓
      nginx
     ↙     ↘
code-server  IDE API
     ↓        ↓
workspace    files

Each developer receives an isolated workspace:

/home/coder/workspace/<developer_id>

🔄 Two-Way Synchronization

EduSphere → IDE

EduSphere DB
    ↓
Export DB
    ↓
Browser IDE

IDE → EduSphere

Browser IDE
    ↓
Sync IDE
    ↓
EduSphere DB

📝 Submission Workflow

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

Accepted submissions are reviewed before being used in the platform and are not automatically deployed into EduSphere.

🤖 EduSphere AI

EduSphere AI is EduSphere's AI-powered study assistant.

It is designed to help students turn study material into more useful exam-preparation content.

Study Workflows

Note organization

Summaries

Exam-ready study material

Study assistance

Learning support

The AI experience is branded consistently as EduSphere AI across the platform.

🧰 Technology Stack

Frontend

Technology

Purpose

React

UI

TypeScript

Application development

Vite

Frontend tooling

Tailwind CSS

Styling

React Router

Routing

Lucide React

Icons

Vercel

Deployment

Backend

Technology

Purpose

Python

Backend development

FastAPI

API framework

Uvicorn

ASGI server

Render

Deployment

Database & Storage

Technology

Purpose

MySQL 8.x

Application database

Aiven MySQL

Production database hosting

Supabase Storage

Private file storage

Signed URLs

Protected file access

Authentication & Developer Infrastructure

Google OAuth

Session-based authentication

Role-based authorization

code-server

Docker

nginx

Supervisor

Deployment

Vercel

Render

Aiven

Supabase

Google Cloud OAuth

🏗️ Production Architecture

                         ┌──────────────────┐
                         │      USERS       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │      VERCEL      │
                         │   React + Vite   │
                         └────────┬─────────┘
                                  │ HTTPS
                                  ▼
                         ┌──────────────────┐
                         │      RENDER      │
                         │  FastAPI Backend │
                         └───────┬─────┬────┘
                                 │     │
                     ┌───────────┘     └──────────────┐
                     ▼                                ▼
            ┌─────────────────┐              ┌─────────────────┐
            │      AIVEN      │              │    SUPABASE     │
            │      MySQL      │              │ Storage / Files │
            └─────────────────┘              └─────────────────┘

                                 │
                                 │ Developer IDE
                                 ▼
                         ┌──────────────────┐
                         │      RENDER      │
                         │  edusphere-ide   │
                         │                  │
                         │     nginx        │
                         │   code-server    │
                         │     IDE API      │
                         └──────────────────┘

🗄️ Database Model

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

User identity and academic profiles are intentionally separated:

users
  ├── student_profiles
  ├── professor_profiles
  └── admin_profiles

This keeps platform authentication logically separate from academic information.

🔑 Environment Variables

Never commit production secrets to GitHub.

Frontend

VITE_API_BASE_URL=https://edusphere-fovh.onrender.com
VITE_DEVELOPER_IDE_URL=https://edusphere-ide.onrender.com

Backend

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

Never commit

.env
.env.*
*.pem
*.key
credentials.json
service-account.json
database dumps containing private data
production API keys
payment provider secret keys

Use environment variables or a secure secret-management system for production credentials.

🚀 Local Development

Frontend

From the frontend directory:

npm install
npm run dev

The Vite development server normally runs on:

http://localhost:5173

Backend

Install the required Python dependencies and configure the backend environment.

Run FastAPI with Uvicorn:

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

The local backend normally runs on:

http://localhost:8000

Developer IDE

The repository includes Docker configuration for the developer workspace:

docker compose -f docker-compose.developer-workspace.yml up -d

The production browser IDE is deployed separately from the main FastAPI service.

☁️ Deployment

Frontend — Vercel

Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist

Production API:

VITE_API_BASE_URL=https://edusphere-fovh.onrender.com

Developer IDE:

VITE_DEVELOPER_IDE_URL=https://edusphere-ide.onrender.com

The Vercel deployment uses a rewrite to index.html for client-side routing.

Backend — Render

The FastAPI backend runs as a Render web service.

The application must listen on:

0.0.0.0

Production OAuth callback:

https://edusphere-fovh.onrender.com/auth/google/callback

Developer IDE — Render

The browser IDE runs as:

edusphere-ide

The container includes:

nginx

code-server

IDE API

supervisor

Database — Aiven

Production MySQL is hosted by Aiven.

The backend connects using environment variables rather than hard-coded credentials.

🛡️ Security Architecture

EduSphere is designed with multiple security boundaries.

API Authorization

Backend routes should validate:

Authentication

User role

Institution ownership

Profile ownership

Resource ownership

Verification state where applicable

Developer Isolation

The browser IDE should not have direct access to:

Production application source code

Production secrets

Database credentials

Deployment credentials

The IDE communicates through a controlled bridge.

Library Security

Library resources are intended to use private storage and signed URLs rather than publicly exposing storage objects.

Marketplace Security

Payment state should be confirmed server-side through payment-provider mechanisms and webhooks rather than trusting frontend payment status.

📁 Project Structure

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

🔄 Development Workflow

A typical feature workflow:

1. Create / update database schema
2. Update backend schema / service
3. Add or update API route
4. Update frontend API integration
5. Build frontend
6. Test locally
7. Commit changes
8. Push to GitHub
9. Deploy
10. Test production

For Developer Workspace features:

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

✅ Production Testing Checklist

Before a production release, test the following areas.

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

⚠️ Production Notes

Render Free Services

Render Free web services can spin down after inactivity. Workloads requiring continuous availability should use an appropriate compute plan.

This is particularly relevant to:

edusphere-fovh
edusphere-ide

Database Availability

The production application depends on Aiven MySQL being available.

If the database service is unavailable, the backend cannot perform normal database operations.

IDE Persistence

The code-server container filesystem should not be treated as the permanent source of truth.

EduSphere maintains an application-managed copy and synchronization mechanism for developer files.

🗺️ Roadmap

Possible future improvements include:

Stronger Developer Workspace authentication

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

📌 Project Status

EduSphere is an actively developed full-stack platform.

The current architecture includes the core foundation for:

Authentication

Role-based dashboards

Academic management

Timetables

Attendance

Examination results

Digital Library

Marketplace

Developer Workspace

Browser-based IDE

EduSphere AI

Cloud deployment

Some production capabilities — especially payment-provider production onboarding, KYC/verification, billing tiers, and third-party service limits — depend on external provider requirements and account configuration.

🤝 Contributing

Fork the repository.

Create a feature branch.

git checkout -b feature/my-feature

Make your changes.

Test the changes.

Commit them.

git add .
git commit -m "Add my feature"

Push the branch.

git push origin feature/my-feature

Open a Pull Request.

# 📄 License

Copyright © 2026 EduSphere.

All rights reserved.

This project is currently not licensed for redistribution, modification,
or commercial use without explicit permission from the project owner.

