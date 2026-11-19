# 🧪 Testing & Quality Assurance Deliverables

This directory contains the final automated test reports, system validation evidence, and coverage audits for the **Student Record System**, adhering to IEEE testing standards and the Agile development sprint plan.

---

## 📊 Executive Testing Summary

| Deliverable | Metric / Score | Status | Description | Link |
| :--- | :---: | :---: | :--- | :---: |
| **Unit Testing Report** | **100% Pass Rate** (201/201) | ✅ PASSED | Automated unit test suite execution across all system modules | [View PDF](./Unit_Test_Report.pdf) |
| **System Validation Report** | **100% Pass Rate** (59/59) | ✅ VERIFIED | End-to-end functional & security validation against IEEE SRS | [View PDF](./System_Validation_Report.pdf) |
| **Code Coverage Report** | **83.9% Statement Coverage** | ✅ EXCELLENT | Line-by-line source execution audit (1,434 / 1,710 statements) | [View PDF](./Code_Coverage_Report.pdf) |
| **Branch Coverage Report** | **73.6% Decision Coverage** | ✅ VERIFIED | Conditional logic & boolean branch path execution (452 / 614) | [View PDF](./Branch_Coverage_Report.pdf) |

---

## 1. 📋 Unit Testing Report (`Unit_Test_Report.pdf`)

The automated unit test suite covers core business logic, database models, utility calculations, and API route controllers.

### Key Metrics:
* **Total Tests Executed:** `201`
* **Passed:** `201`
* **Failures / Errors:** `0`
* **Success Rate:** `100.0%`
* **Execution Duration:** `151.52s`
* **Test Runner:** `pytest 9.1.1`

### Test Suite Distribution:
* **Authentication & Session Management:** 8 tests
* **Role-Based Permissions (Admin, Faculty, Student):** 43 tests
* **Attendance Tracking & Daily Allocation:** 35 tests
* **Marks Management & Grade Boundary Validation:** 27 tests
* **Academic Records, GPA & CGPA Calculation:** 33 tests
* **Low Attendance Notifications (<75% triggers):** 11 tests
* **Disaster Recovery & Database Backup/Restore:** 8 tests
* **System Boost & Availability Verification:** 36 tests

📄 **Deliverable File:** [`Unit_Test_Report.pdf`](./Unit_Test_Report.pdf)

---

## 2. 🛡️ System Validation Report (`System_Validation_Report.pdf`)

The System Validation suite validates the integrated system against the **Software Requirements Specification (SRS)** and **Software Architecture & Design (SAD)** documents.

### Functional Requirement Traceability:
* **FR-001 (Authentication & Authorization):** Validated secure credential hashing, session revocation on logout, and CSRF protection.
* **FR-002 to FR-004 (Role-Based Access Control):** Validated that unauthorized users cannot escalate privileges or access restricted views across Student, Faculty, and Admin endpoints.
* **FR-005 to FR-008 (Academic & Grade Engine):** Validated accurate GPA/CGPA computation, transcript generation, and student self-service record view.
* **FR-010 to FR-013 (Attendance Monitoring & Thresholds):** Validated automated alert creation when attendance falls below the mandatory 75% limit.
* **FR-014 (Disaster Recovery & Backups):** Validated system state preservation, corrupt record rollback, and recovery workflows without data loss.

### Validation Results:
* **Test Cases:** `59`
* **Passing Cases:** `59`
* **Defects Identified:** `0`
* **Requirement Compliance:** `100%`

📄 **Deliverable File:** [`System_Validation_Report.pdf`](./System_Validation_Report.pdf)

---

## 3. 📈 Code Statement Coverage Report (`Code_Coverage_Report.pdf`)

Code coverage measures the percentage of executable Python statements executed during test runs using `coverage.py`.

### Line Coverage Summary:
* **Total Executable Statements:** `1,710`
* **Statements Executed:** `1,434`
* **Statements Missed:** `276`
* **Overall Statement Coverage:** **`83.9% (~84%)`**
* **Rating:** `EXCELLENT` (Exceeds industry standard benchmark of 70%)

### Component Breakdown:
| Component / Module | Executable Statements | Executed Statements | Line Coverage % | Quality Rating |
| :--- | :---: | :---: | :---: | :---: |
| **Database Models (`backend/models/*`)** | 104 | 104 | **100.0%** | `EXCELLENT` |
| **Availability Service (`availability_service.py`)** | 43 | 42 | **97.7%** | `EXCELLENT` |
| **Academic Records (`routes/academic_records.py`)** | 67 | 65 | **97.0%** | `EXCELLENT` |
| **Student Management (`routes/students.py`)** | 69 | 66 | **95.7%** | `EXCELLENT` |
| **Notification Service (`notification_service.py`)** | 25 | 24 | **96.0%** | `EXCELLENT` |
| **Subject Routes (`routes/subjects.py`)** | 120 | 107 | **89.2%** | `EXCELLENT` |
| **Authentication Engine (`routes/auth.py`)** | 44 | 41 | **93.2%** | `EXCELLENT` |
| **CGPA Service (`routes/cgpa.py`)** | 35 | 32 | **91.4%** | `EXCELLENT` |
| **Marks Processing (`routes/marks.py`)** | 176 | 149 | **84.7%** | `GOOD` |
| **Backup & Recovery (`routes/backups.py`)** | 112 | 92 | **82.1%** | `GOOD` |
| **Admin Operations (`routes/admin.py`)** | 441 | 329 | **74.6%** | `GOOD` |
| **Attendance Routes (`routes/attendance.py`)** | 248 | 189 | **76.2%** | `GOOD` |

📄 **Deliverable File:** [`Code_Coverage_Report.pdf`](./Code_Coverage_Report.pdf)

---

## 4. 🔀 Branch & Decision Coverage Report (`Branch_Coverage_Report.pdf`)

Branch coverage assesses whether each conditional branch (`if`, `elif`, `else`, boolean guards) has been exercised for both `True` and `False` outcomes.

### Branch Coverage Summary:
* **Total Decision Branches:** `614`
* **Fully Covered Branches:** `452` *(both True and False paths exercised)*
* **Partial Branches:** `136`
* **Missed Branches:** `162`
* **Branch Coverage Rate:** **`73.6%`**
* **Verification Status:** `VERIFIED`

### Critical Logic Branches Verified:
1. **Access Control Decision Logic:**
   - Both authorized and unauthorized access paths verified across all roles (`Administrator`, `Faculty`, `Student`).
2. **Attendance 75% Rule:**
   - True branch ($< 75\%$): Triggers automated notification in database.
   - False branch ($\ge 75\%$): Suppresses notification without write operations.
3. **Marks Range & Grade Bounds:**
   - Evaluated boundaries: negative marks, marks exceeding assessment maximums, zero marks, and canonical assessment names (`ISA 1`, `ISA 2`, `ESA`).
4. **Database Rollback on Failure:**
   - Verified that unhandled exceptions or constraint violations trigger `db.session.rollback()` and return appropriate HTTP 400/409/500 error envelopes without orphan state creation.

📄 **Deliverable File:** [`Branch_Coverage_Report.pdf`](./Branch_Coverage_Report.pdf)

---

## ⚙️ How to Reproduce Locally

To re-run the entire test and coverage suite from the project root:

```bash
# 1. Activate environment and set search path
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = ".;tests"

# 2. Run all unit tests with coverage
pytest -o pythonpath=". tests" -W ignore::ResourceWarning --cov=backend/routes --cov=backend/models --cov=backend/services --cov-branch --cov-report=term-missing
```
