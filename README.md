# 🎓 Student Record System (SRS)

A comprehensive, web-based academic record management system featuring role-based access control (RBAC), attendance tracking with automated threshold alerts, marks recording, and automated GPA/CGPA computation. Built in accordance with **IEEE Software Engineering standards** following an **Agile SDLC methodology**.

---

## 📑 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [User Roles & Permissions](#user-roles--permissions)
- [Technology Stack](#technology-stack)
- [Project Architecture & Structure](#project-architecture--structure)
- [Database Configuration](#database-configuration)
- [Installation & Getting Started](#installation--getting-started)
- [Running the Application](#running-the-application)
- [Testing & Quality Assurance Results](#testing--quality-assurance-results)
- [Documentation & Reports (`docs/`)](#documentation--reports-docs)
- [Agile Sprints & Delivery](#agile-sprints--delivery)
- [Contributors](#contributors)

---

## 🌟 Project Overview

The **Student Record System** provides a unified platform for educational institutions to manage academic data with high integrity. It provides strict security boundaries between Administrators, Faculty, and Students, automates continuous assessment evaluations, enforces attendance regulations (75% threshold), and includes disaster recovery workflows for database consistency.

---

## ✨ Key Features

- **Authentication & Security:** Secure session management, bcrypt password hashing, CSRF token validation, and inactive user protection.
- **Role-Based Access Control (RBAC):** Strict horizontal and vertical permission boundaries for Students, Faculty, and Administrators.
- **Course & Allocation Management:** Dynamic assignment of faculty to subjects per semester, and allocation of students to assigned courses.
- **Attendance Monitoring:** Session logging with automated notification triggers whenever attendance falls below the mandatory **75%** threshold.
- **Assessment & Marks Processing:** Structured recording for canonical assessments (**ISA 1**, **ISA 2**, and **ESA**) with boundary validations ($0 \le \text{marks} \le \text{max}$).
- **Academic Performance Engine:** Real-time Semester GPA and cumulative CGPA calculation.
- **Transcript Generation:** Downloadable official academic grade sheets in PDF format.
- **Disaster Recovery & Backups:** Full database backup exports, corrupted record rollbacks, and orphan account reconciliation.

---

## 🔐 User Roles & Permissions

| Role | Access Scope |
| :--- | :--- |
| **Administrator** | Full system administration, user management, semester creation, faculty assignments, student allocations, and backup/recovery operations. |
| **Faculty** | Attendance logging for assigned subjects, continuous marks entry (ISA/ESA), class attendance summary viewing, and attendance alert synchronization. |
| **Student** | Self-service portal to view personal attendance percentages, subject allocations, semester marks, GPA/CGPA, and download official PDF transcripts. |

---

## 💻 Technology Stack

| Component | Technology / Library |
| :--- | :--- |
| **Backend Framework** | Python 3.13, Flask 3.1.3 |
| **Security & Auth** | Flask-Login 0.6.3, Flask-WTF 1.3.0 (CSRF Protection), Werkzeug |
| **Database & ORM** | MySQL / SQLite, Flask-SQLAlchemy 3.1.1, PyMySQL |
| **Document Generation** | ReportLab 5.1 (PDF Transcript Engine) |
| **Frontend** | React (frontend-react), Modern Responsive UI |
| **Testing & Quality Assurance** | pytest 9.1.1, pytest-cov 7.1.0, pytest-html 4.2.0, coverage.py |

---

## 📂 Project Architecture & Structure

```text
Student-Record-System/
├── backend/
│   ├── app.py                      # Flask Application Factory & Route Registration
│   ├── config.py                   # Configuration & College Operating Hours
│   ├── extensions.py               # Database and Login Extensions
│   ├── models/                     # SQLAlchemy Relational Models
│   │   ├── attendance.py
│   │   ├── faculty_subject.py
│   │   ├── mark.py
│   │   ├── notification.py
│   │   ├── semester.py
│   │   ├── student.py
│   │   ├── student_subject.py
│   │   ├── subject.py
│   │   └── user.py
│   ├── routes/                     # Modular API Blueprints
│   │   ├── academic_records.py
│   │   ├── admin.py
│   │   ├── attendance.py
│   │   ├── auth.py
│   │   ├── backups.py
│   │   ├── cgpa.py
│   │   ├── gpa.py
│   │   ├── marks.py
│   │   ├── notifications.py
│   │   ├── students.py
│   │   └── subjects.py
│   └── services/                   # Business Logic & Algorithms
│       ├── academic_records_pdf.py
│       ├── availability_service.py
│       ├── cgpa_service.py
│       ├── gpa_service.py
│       └── notification_service.py
├── tests/                          # 201 Automated Unit & Integration Tests
├── docs/                           # IEEE Deliverables & PDF Reports
│   ├── Unit_Test_Report.pdf
│   ├── System_Validation_Report.pdf
│   ├── Code_Coverage_Report.pdf
│   └── Branch_Coverage_Report.pdf
├── frontend-react/                 # React Frontend Application
├── create_dev_user.py              # Initial User Seeding Script
└── README.md
```

---

## 🗄️ Database Configuration

The application uses MySQL for production and persistent storage. 

```sql
CREATE DATABASE student_record_system;
```

Configure your local connection details in a `.env` file in the project root:
```env
SECRET_KEY=your-secure-secret-key
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_record_system
```

---

## 🚀 Installation & Getting Started

### 1. Clone the repository:
```bash
git clone https://github.com/vinayallalli82-sys/Student-Record-System.git
cd Student-Record-System
```

### 2. Set up virtual environment (Windows PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install dependencies:
```powershell
pip install -r backend/requirements.txt
pip install pytest pytest-cov pytest-html
```

### 4. Seed initial administrator user:
```powershell
python create_dev_user.py
```

---

## ⚡ Running the Application

To run the backend server:

```powershell
python backend/app.py
```
*The Flask REST API will start at `http://127.0.0.1:5000`.*

---

## 🧪 Testing & Quality Assurance Results

The test suite was executed across unit, integration, and security layers using `pytest` and `coverage.py`.

| Metric / Deliverable | Target Standard | Result Achieved | Evaluation Status |
| :--- | :---: | :---: | :---: |
| **Unit Tests Executed** | All modules | **201 / 201 passed** | ✅ **100% Passed** |
| **System Validation** | IEEE SRS Requirements | **59 / 59 passed** | ✅ **100% Verified** |
| **Statement (Code) Coverage** | $>70\%$ | **83.9%** (1,434 / 1,710 lines) | ✅ **EXCELLENT** |
| **Branch (Decision) Coverage** | $>65\%$ | **73.6%** (452 / 614 branches) | ✅ **VERIFIED** |
| **Overall Combined Coverage** | $>70\%$ | **81%** | ✅ **EXCEEDS BENCHMARK** |
| **Test Execution Duration** | Fast feedback | **151.48 seconds** | ✅ **Passed** |

---

### Detailed Component Coverage:

| Subsystem / Component | Total Statements | Missed | Total Branches | Partial | Line Coverage | Branch Coverage |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Models (`backend/models/*`)** | 104 | 0 | 0 | 0 | **100.0%** | **100.0%** |
| **Availability Service (`services/availability_service.py`)** | 43 | 1 | 10 | 0 | **97.7%** | **100.0%** |
| **Academic Records (`routes/academic_records.py`)** | 67 | 2 | 20 | 2 | **97.0%** | **90.0%** |
| **Student Profiles (`routes/students.py`)** | 69 | 3 | 22 | 3 | **95.7%** | **86.4%** |
| **Notification Engine (`services/notification_service.py`)** | 25 | 1 | 8 | 1 | **96.0%** | **87.5%** |
| **Authentication Engine (`routes/auth.py`)** | 44 | 3 | 10 | 3 | **93.2%** | **70.0%** |
| **Subject Routes (`routes/subjects.py`)** | 120 | 13 | 44 | 2 | **89.2%** | **95.5%** |
| **CGPA Service (`routes/cgpa.py`)** | 35 | 3 | 16 | 1 | **91.4%** | **93.8%** |
| **Marks Processing (`routes/marks.py`)** | 176 | 27 | 78 | 16 | **84.7%** | **76.9%** |
| **Backup & Recovery (`routes/backups.py`)** | 112 | 20 | 38 | 6 | **82.1%** | **84.2%** |
| **Admin Operations (`routes/admin.py`)** | 441 | 112 | 174 | 53 | **74.6%** | **69.5%** |
| **Attendance Routes (`routes/attendance.py`)** | 248 | 59 | 110 | 24 | **76.2%** | **78.2%** |
| **TOTAL** | **1,710** | **276** | **614** | **136** | **83.9%** | **73.6%** |

---

### Command to Re-run All Tests:

```powershell
$env:PYTHONPATH = ".;tests"
pytest -o pythonpath=". tests" -W ignore::ResourceWarning --cov=backend/routes --cov=backend/models --cov=backend/services --cov-branch --cov-report=term-missing
```

---

## 📄 Documentation & Reports (`docs/`)

The following final PDF reports are maintained in the [`docs/`](./docs) directory:

- 📋 [**Unit Test Report**](./docs/Unit_Test_Report.pdf): Detailed execution results for all 201 automated unit test cases.
- 🛡️ [**System Validation Report**](./docs/System_Validation_Report.pdf): Verification of functional requirements (FR-001 through FR-014) and security controls.
- 📈 [**Code Coverage Report**](./docs/Code_Coverage_Report.pdf): Source line execution audit (83.9% statement coverage).
- 🔀 [**Branch Coverage Report**](./docs/Branch_Coverage_Report.pdf): Decision logic and conditional branch audit (73.6% branch coverage).

---

## 🏃 Agile Sprints & Delivery

- **Sprint 1:** Core authentication, database schema, relational entities, base marks and attendance APIs, working product demo video (1 min).
- **Sprint 2:** React UI redesign, automated low-attendance warnings, GPA/CGPA calculation engine, database disaster recovery, and 201-test coverage suite, final demo video (2 min).

---
