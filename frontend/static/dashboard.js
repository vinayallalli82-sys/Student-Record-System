
"use strict";

/*
 * Student Record System dashboard.
 * Supports authentication, student attendance, semester GPA,
 * faculty attendance, and faculty marks management.
 */

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const globalMessage = document.getElementById("globalMessage");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;

/* Accessible messages */
function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.setAttribute("role", isError ? "alert" : "status");
    element.setAttribute("aria-live", isError ? "assertive" : "polite");
    element.classList.toggle("error-message", isError);
    element.classList.toggle("success-message", !isError);
}

function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.classList.remove("error-message", "success-message");
}

/* API helper with session cookies and CSRF protection */
async function api(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    const headers = {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const csrfResponse = await fetch("/api/auth/csrf", {
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });

        const csrfData = await csrfResponse.json().catch(() => ({}));

        if (!csrfResponse.ok || !csrfData.csrf_token) {
            throw new Error(
                "Unable to start a secure request. Refresh the page and try again."
            );
        }

        headers["X-CSRFToken"] = csrfData.csrf_token;
    }

    const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: "same-origin"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed (HTTP ${response.status}).`
        );
    }

    return data;
}

/* Navigation */
function showView(viewId) {
    [
        "attendanceView",
        "gpaView",
        "academicRecordsView",
        "facultyView"
    ].forEach((id) => {
        const section = document.getElementById(id);

        if (section) {
            section.classList.toggle("hidden", id !== viewId);
        }
    });

    clearMessage(globalMessage);

    const heading = document
        .getElementById(viewId)
        ?.querySelector("h2");

    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
    }
}

/* Safe table rendering */
function renderTable(container, columns, records) {
    if (!container) return;

    container.replaceChildren();

    if (!Array.isArray(records) || records.length === 0) {
        container.textContent = "No records are available.";
        return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    columns.forEach((column) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = column.label;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    records.forEach((record) => {
        const row = document.createElement("tr");

        columns.forEach((column) => {
            const cell = document.createElement("td");
            const value = record[column.key];

            cell.textContent =
                value === null || value === undefined || value === ""
                    ? "—"
                    : String(value);

            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

function formatNumber(value, decimalPlaces = 2) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(decimalPlaces) : "—";
}

function appendSummaryRow(container, label, value) {
    const row = document.createElement("p");
    const strong = document.createElement("strong");

    strong.textContent = `${label}: `;
    row.appendChild(strong);
    row.appendChild(document.createTextNode(String(value)));
    container.appendChild(row);
}

function renderAcademicRecords(container, subjects) {
    container.replaceChildren();

    if (!Array.isArray(subjects) || subjects.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent =
            "No subjects or academic records are available for this semester.";
        container.appendChild(emptyMessage);
        return;
    }

    subjects.forEach((subject) => {
        const card = document.createElement("article");
        card.className = "academic-subject";

        const heading = document.createElement("h3");
        heading.textContent =
            `${subject.subject_code || "Subject"} — ` +
            `${subject.subject_name || "Unnamed subject"}`;
        card.appendChild(heading);
        appendSummaryRow(card, "Credits", formatNumber(subject.credits, 1));

        const assessments = Array.isArray(subject.assessments)
            ? subject.assessments
            : [];
        const assessmentHeading = document.createElement("h4");
        assessmentHeading.textContent = "Assessment marks";
        card.appendChild(assessmentHeading);

        if (assessments.length > 0) {
            const tableContainer = document.createElement("div");
            renderTable(
                tableContainer,
                [
                    { key: "assessment_name", label: "Assessment" },
                    { key: "marks_obtained", label: "Marks Obtained" },
                    { key: "max_marks", label: "Maximum Marks" },
                    { key: "percentage", label: "Percentage (%)" },
                    { key: "grade", label: "Grade" },
                    { key: "grade_point", label: "Grade Point" }
                ],
                assessments.map((assessment) => ({
                    ...assessment,
                    marks_obtained: formatNumber(assessment.marks_obtained),
                    max_marks: formatNumber(assessment.max_marks),
                    percentage: formatNumber(assessment.percentage),
                    grade_point: formatNumber(assessment.grade_point)
                }))
            );
            card.appendChild(tableContainer);
        } else {
            const noAssessments = document.createElement("p");
            noAssessments.textContent =
                "No assessment marks have been recorded for this subject.";
            card.appendChild(noAssessments);
        }

        const totalObtained = Number(subject.total_marks_obtained);
        const totalMaximum = Number(subject.total_max_marks);
        if (
            subject.total_marks_obtained !== null &&
            subject.total_marks_obtained !== undefined &&
            subject.total_max_marks !== null &&
            subject.total_max_marks !== undefined &&
            Number.isFinite(totalObtained) &&
            Number.isFinite(totalMaximum)
        ) {
            appendSummaryRow(
                card,
                "Total marks",
                `${formatNumber(totalObtained)} / ${formatNumber(totalMaximum)}`
            );
        }

        const attendance = subject.attendance || {};
        const attendanceHeading = document.createElement("h4");
        attendanceHeading.textContent = "Attendance";
        card.appendChild(attendanceHeading);
        appendSummaryRow(
            card,
            "Total classes",
            Number(attendance.total_classes || 0)
        );
        appendSummaryRow(
            card,
            "Classes attended",
            Number(attendance.classes_attended || 0)
        );
        appendSummaryRow(
            card,
            "Attendance percentage",
            `${formatNumber(Number(attendance.percentage || 0))}%`
        );

        container.appendChild(card);
    });
}

/* Open the dashboard for the authenticated user */
function openDashboard(user) {
    currentUser = user;

    loginPanel?.classList.add("hidden");
    dashboardPanel?.classList.remove("hidden");
    logoutButton?.classList.remove("hidden");

    const welcomeTitle = document.getElementById("welcomeTitle");
    const userDetails = document.getElementById("userDetails");

    if (welcomeTitle) {
        welcomeTitle.textContent = "Welcome to your dashboard";
    }

    if (userDetails) {
        userDetails.textContent =
            `${user.email || "User"} — ${user.role || "User"}`;
    }

    const isStudent = user.role === "Student";
    const isFaculty =
        user.role === "Faculty" || user.role === "Administrator";

    document.getElementById("gpaNav")
        ?.classList.toggle("hidden", !isStudent);

    document.getElementById("academicRecordsNav")
        ?.classList.toggle("hidden", !isStudent);

    document.getElementById("facultyNav")
        ?.classList.toggle("hidden", !isFaculty);

    document.getElementById("facultyMarksSection")
        ?.classList.toggle("hidden", user.role !== "Faculty");

    clearMessage(loginMessage);
    showMessage(globalMessage, "Signed in successfully.");
    showView("attendanceView");
}

/* Return to the login screen */
function closeDashboard(message = "") {
    currentUser = null;

    dashboardPanel?.classList.add("hidden");
    loginPanel?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");

    loginForm?.reset();

    clearMessage(globalMessage);
    [
        "attendanceResults",
        "gpaResults",
        "academicRecordsResults",
        "marksResults",
        "facultyAttendanceResults"
    ].forEach((id) => {
        document.getElementById(id)?.replaceChildren();
    });
    clearMessage(document.getElementById("academicRecordsMessage"));
    clearMessage(marksMessage);
    clearMessage(facultyAttendanceMessage);

    if (message) {
        showMessage(loginMessage, message);
    } else {
        clearMessage(loginMessage);
    }
}

/* Login */
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email =
            document.getElementById("email")?.value.trim() || "";
        const password =
            document.getElementById("password")?.value || "";

        const submitButton = loginForm.querySelector(
            'button[type="submit"]'
        );

        if (!email || !password) {
            showMessage(
                loginMessage,
                "Enter your email address and password.",
                true
            );
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Signing in...";
        }

        showMessage(loginMessage, "Signing in...");

        try {
            const result = await api("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password })
            });

            if (!result.user) {
                throw new Error("The server did not return user details.");
            }

            openDashboard(result.user);
        } catch (error) {
            showMessage(
                loginMessage,
                error.message || "Unable to sign in. Please try again.",
                true
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Sign in";
            }
        }
    });
}

/* Logout */
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {
            await api("/api/auth/logout", { method: "POST" });
            closeDashboard("You have logged out successfully.");
        } catch (error) {
            showMessage(
                globalMessage,
                error.message || "Unable to sign out. Please try again.",
                true
            );
        } finally {
            logoutButton.disabled = false;
            logoutButton.textContent = "Log out";
        }
    });
}

/* Student attendance */
const attendanceButton = document.getElementById("loadAttendance");

attendanceButton?.addEventListener("click", async () => {
    const container = document.getElementById("attendanceResults");

    if (!currentUser || !container) {
        showMessage(globalMessage, "Please sign in first.", true);
        return;
    }

    if (["Faculty", "Administrator"].includes(currentUser.role)) {
        showView("facultyView");
        await initializeFacultyAttendance();
        return;
    }

    if (currentUser.role !== "Student") {
        container.textContent =
            "Student attendance is available to student accounts.";
        return;
    }

    attendanceButton.disabled = true;
    attendanceButton.textContent = "Loading...";
    container.textContent = "Loading attendance records...";

    try {
        const result = await api("/api/attendance/my");

        const records = Array.isArray(result)
            ? result
            : result.attendance || result.records || [];

        renderTable(
            container,
            [
                { key: "attendance_date", label: "Date" },
                { key: "subject_id", label: "Subject ID" },
                { key: "status", label: "Status" }
            ],
            records
        );
    } catch (error) {
        container.textContent =
            error.message || "Unable to load attendance records.";
    } finally {
        attendanceButton.disabled = false;
        attendanceButton.textContent = "Load attendance";
    }
});

/* Student semester GPA */
const gpaButton = document.getElementById("loadGpa");

gpaButton?.addEventListener("click", async () => {
    const container = document.getElementById("gpaResults");
    const semesterSelect = document.getElementById("semesterNumber");

    if (!currentUser || !container || !semesterSelect) {
        showMessage(globalMessage, "Please sign in first.", true);
        return;
    }

    if (currentUser.role !== "Student") {
        container.textContent =
            "GPA records are available to student accounts.";
        return;
    }

    const semesterValue = semesterSelect.value;
    const semester = Number(semesterValue);

    if (
        !semesterValue ||
        !Number.isInteger(semester) ||
        semester < 1 ||
        semester > 8
    ) {
        container.textContent = "Choose a semester from 1 to 8.";
        semesterSelect.focus();
        return;
    }

    if (!currentUser.student_id) {
        container.textContent =
            "No student profile is linked to this account. Please contact the administrator.";
        return;
    }

    gpaButton.disabled = true;
    gpaButton.textContent = "Loading GPA...";
    container.textContent = "Retrieving GPA records...";

    try {
        const result = await api(
            `/api/students/${encodeURIComponent(currentUser.student_id)}` +
            `/semesters/${semester}/gpa`
        );

        container.replaceChildren();

        const gpaValue =
            result.gpa ?? result.semester_gpa ?? result.sgpa;

        const summary = document.createElement("p");
        summary.textContent =
            gpaValue === null || gpaValue === undefined
                ? "No GPA value was returned by the server."
                : `Semester ${semester} GPA: ${gpaValue}`;

        container.appendChild(summary);

        const subjects =
            result.subjects ||
            result.subject_results ||
            result.results ||
            [];

        if (Array.isArray(subjects) && subjects.length > 0) {
            const tableContainer = document.createElement("div");

            renderTable(
                tableContainer,
                [
                    { key: "subject_name", label: "Subject" },
                    { key: "credits", label: "Credits" },
                    { key: "grade", label: "Grade" },
                    { key: "grade_point", label: "Grade Point" }
                ],
                subjects
            );

            container.appendChild(tableContainer);
        }
    } catch (error) {
        container.textContent =
            error.message || "Unable to retrieve semester GPA.";
    } finally {
        gpaButton.disabled = false;
        gpaButton.textContent = "View GPA";
    }
});

/* Faculty marks elements */
const marksForm = document.getElementById("marksForm");
const marksSubject = document.getElementById("marksSubject");
const marksStudent = document.getElementById("marksStudent");
const marksMessage = document.getElementById("marksMessage");
const marksResults = document.getElementById("marksResults");
const markIdInput = document.getElementById("markId");
const saveMarksButton = document.getElementById("saveMarksButton");
const resetMarksButton = document.getElementById("resetMarksButton");
const loadMarksButton = document.getElementById("loadMarksButton");

let savedMarks = [];

/* Faculty attendance elements and state */
const attendanceSubject = document.getElementById("attendanceSubject");
const attendanceDate = document.getElementById("attendanceDate");
const facultyAttendanceMessage =
    document.getElementById("facultyAttendanceMessage");
const facultyAttendanceResults =
    document.getElementById("facultyAttendanceResults");
const saveAttendanceButton =
    document.getElementById("saveAttendanceButton");

let facultyAttendanceStudents = [];
let facultyAttendanceRecords = new Map();
let attendanceStatusControls = new Map();
let attendanceLoadVersion = 0;
let attendanceSaveInProgress = false;
let facultyAttendanceInitialized = false;

function getLocalDateValue() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${today.getFullYear()}-${month}-${day}`;
}

if (attendanceDate) {
    attendanceDate.value = getLocalDateValue();
}

async function loadAttendanceSubjects() {
    if (!attendanceSubject) {
        throw new Error("The attendance subject dropdown was not found.");
    }

    const selectedSubject = attendanceSubject.value;
    const subjects = await api("/api/subjects");

    if (!Array.isArray(subjects)) {
        throw new Error("The server returned an invalid subjects list.");
    }

    attendanceSubject.replaceChildren(
        new Option("Choose a subject", "")
    );

    subjects.forEach((subject) => {
        attendanceSubject.add(
            new Option(
                `${subject.subject_code} — ${subject.subject_name}`,
                String(subject.subject_id)
            )
        );
    });

    if (subjects.some(
        (subject) => String(subject.subject_id) === selectedSubject
    )) {
        attendanceSubject.value = selectedSubject;
    }

    if (subjects.length === 0) {
        showMessage(
            facultyAttendanceMessage,
            "No subjects are available.",
            true
        );
    }
}

function renderFacultyAttendance() {
    if (!facultyAttendanceResults) return;

    facultyAttendanceResults.replaceChildren();
    attendanceStatusControls = new Map();

    if (facultyAttendanceStudents.length === 0) {
        facultyAttendanceResults.textContent =
            "No students are enrolled in this subject.";
        return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    [
        "Registration No.",
        "Name",
        "Current status",
        "Mark status"
    ].forEach((label) => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = label;
        headerRow.appendChild(heading);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    facultyAttendanceStudents.forEach((student) => {
        const studentId = String(student.student_id);
        const record = facultyAttendanceRecords.get(studentId);
        const status = record?.status || student.attendance_status || "";
        const row = document.createElement("tr");
        const registrationCell = document.createElement("td");
        const nameCell = document.createElement("td");
        const currentStatusCell = document.createElement("td");
        const selectorCell = document.createElement("td");
        const fullName =
            `${student.first_name || ""} ${student.last_name || ""}`.trim();
        const statusSelect = document.createElement("select");

        registrationCell.textContent =
            student.registration_number || "—";
        nameCell.textContent = fullName || "—";
        currentStatusCell.textContent = status || "Not recorded";

        statusSelect.setAttribute(
            "aria-label",
            `Attendance status for ${student.registration_number || fullName}`
        );
        statusSelect.dataset.studentId = studentId;

        ["Present", "Absent"].forEach((optionStatus) => {
            statusSelect.add(
                new Option(optionStatus, optionStatus)
            );
        });
        statusSelect.value = status || "Present";
        attendanceStatusControls.set(studentId, statusSelect);
        selectorCell.appendChild(statusSelect);

        row.append(
            registrationCell,
            nameCell,
            currentStatusCell,
            selectorCell
        );
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    facultyAttendanceResults.appendChild(table);
}

async function loadFacultyAttendance() {
    if (!attendanceSubject || !attendanceDate ||
        !facultyAttendanceResults) {
        throw new Error("The faculty attendance controls were not found.");
    }

    const loadVersion = ++attendanceLoadVersion;
    const subjectId = attendanceSubject.value;
    const dateValue = attendanceDate.value;

    facultyAttendanceStudents = [];
    facultyAttendanceRecords = new Map();
    attendanceStatusControls = new Map();
    facultyAttendanceResults.replaceChildren();

    if (!subjectId || !dateValue) {
        const noSubjectsAvailable =
            attendanceSubject.options.length <= 1;
        const emptyState = noSubjectsAvailable
            ? "No subjects are available."
            : "Choose a subject and date to load enrolled students.";
        facultyAttendanceResults.textContent = emptyState;
        if (saveAttendanceButton) saveAttendanceButton.disabled = true;
        showMessage(facultyAttendanceMessage, emptyState);
        return;
    }

    showMessage(facultyAttendanceMessage, "Loading enrolled students...");
    facultyAttendanceResults.textContent =
        "Loading attendance records...";
    if (saveAttendanceButton) saveAttendanceButton.disabled = true;

    const query = `subject_id=${encodeURIComponent(subjectId)}` +
        `&date=${encodeURIComponent(dateValue)}`;

    try {
        const [students, records] = await Promise.all([
            api(`/api/attendance/students?${query}`),
            api(`/api/attendance?${query}`)
        ]);

        if (loadVersion !== attendanceLoadVersion) return;

        if (!Array.isArray(students) || !Array.isArray(records)) {
            throw new Error("The server returned invalid attendance data.");
        }

        facultyAttendanceStudents = students;
        facultyAttendanceRecords = new Map(
            records.map((record) => [
                String(record.student_id),
                record
            ])
        );
        renderFacultyAttendance();

        if (students.length === 0) {
            showMessage(
                facultyAttendanceMessage,
                "No students are enrolled in this subject."
            );
        } else {
            showMessage(
                facultyAttendanceMessage,
                `Loaded ${students.length} enrolled student` +
                `${students.length === 1 ? "" : "s"}.`
            );
        }

        if (saveAttendanceButton) {
            saveAttendanceButton.disabled = attendanceSaveInProgress ||
                students.length === 0;
        }
    } catch (error) {
        if (loadVersion !== attendanceLoadVersion) return;

        facultyAttendanceStudents = [];
        facultyAttendanceRecords = new Map();
        attendanceStatusControls = new Map();
        facultyAttendanceResults.textContent =
            error.message || "Unable to load attendance.";
        if (saveAttendanceButton) saveAttendanceButton.disabled = true;
        throw error;
    }
}

async function initializeFacultyAttendance() {
    if (!currentUser ||
        !["Faculty", "Administrator"].includes(currentUser.role)) {
        showMessage(
            globalMessage,
            "Faculty tools require a faculty or administrator account.",
            true
        );
        return;
    }

    if (facultyAttendanceInitialized) return;

    try {
        await loadAttendanceSubjects();
        await loadFacultyAttendance();
        facultyAttendanceInitialized = true;
    } catch (error) {
        showMessage(
            facultyAttendanceMessage,
            error.message || "Unable to initialize faculty attendance.",
            true
        );
    }
}

attendanceSubject?.addEventListener("change", () => {
    loadFacultyAttendance().catch((error) => {
        showMessage(
            facultyAttendanceMessage,
            error.message || "Unable to load attendance.",
            true
        );
    });
});

attendanceDate?.addEventListener("change", () => {
    loadFacultyAttendance().catch((error) => {
        showMessage(
            facultyAttendanceMessage,
            error.message || "Unable to load attendance.",
            true
        );
    });
});

saveAttendanceButton?.addEventListener("click", async () => {
    if (!currentUser ||
        !["Faculty", "Administrator"].includes(currentUser.role)) {
        showMessage(
            facultyAttendanceMessage,
            "Faculty tools require a faculty or administrator account.",
            true
        );
        return;
    }

    if (attendanceSaveInProgress) return;

    const subjectId = attendanceSubject?.value || "";
    const dateValue = attendanceDate?.value || "";

    if (!subjectId || !dateValue || facultyAttendanceStudents.length === 0) {
        showMessage(
            facultyAttendanceMessage,
            "Choose a subject and date with enrolled students.",
            true
        );
        return;
    }

    attendanceSaveInProgress = true;
    saveAttendanceButton.disabled = true;
    saveAttendanceButton.textContent = "Saving...";
    if (attendanceSubject) attendanceSubject.disabled = true;
    if (attendanceDate) attendanceDate.disabled = true;
    attendanceStatusControls.forEach((control) => {
        control.disabled = true;
    });
    showMessage(facultyAttendanceMessage, "Saving attendance...");

    let savedCount = 0;

    try {
        for (const student of facultyAttendanceStudents) {
            const studentId = String(student.student_id);
            const record = facultyAttendanceRecords.get(studentId);
            const status = attendanceStatusControls.get(studentId)?.value;

            if (!status || !["Present", "Absent"].includes(status)) {
                throw new Error(
                    `Choose Present or Absent for student ` +
                    `${student.registration_number || studentId}.`
                );
            }

            if (record?.attendance_id) {
                await api(
                    `/api/attendance/${encodeURIComponent(record.attendance_id)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({ status })
                    }
                );
            } else {
                await api("/api/attendance", {
                    method: "POST",
                    body: JSON.stringify({
                        student_id: Number(student.student_id),
                        subject_id: Number(subjectId),
                        attendance_date: dateValue,
                        status
                    })
                });
            }
            savedCount += 1;
        }

        await loadFacultyAttendance();
        showMessage(
            facultyAttendanceMessage,
            `Attendance saved for ${savedCount} student` +
            `${savedCount === 1 ? "" : "s"}.`
        );
    } catch (error) {
        let refreshError = "";
        try {
            await loadFacultyAttendance();
        } catch (loadError) {
            refreshError = ` The roster could not be refreshed: ` +
                `${loadError.message || "unknown error"}`;
        }

        const partialSaveMessage = savedCount > 0
            ? ` ${savedCount} student record` +
                `${savedCount === 1 ? " was" : "s were"} saved before the error.`
            : "";
        showMessage(
            facultyAttendanceMessage,
            `${error.message || "Unable to save attendance."}` +
            `${partialSaveMessage}${refreshError}`,
            true
        );
    } finally {
        attendanceSaveInProgress = false;
        if (attendanceSubject) attendanceSubject.disabled = false;
        if (attendanceDate) attendanceDate.disabled = false;
        attendanceStatusControls.forEach((control) => {
            control.disabled = false;
        });
        saveAttendanceButton.disabled =
            facultyAttendanceStudents.length === 0;
        saveAttendanceButton.textContent = "Save attendance";
    }
});

/* Load available subjects */
async function loadMarkSubjects() {
    if (!marksSubject) {
        throw new Error("The subject dropdown was not found in the page.");
    }

    const subjects = await api("/api/subjects");

    marksSubject.replaceChildren(
        new Option("Choose a subject", "")
    );

    subjects.forEach((subject) => {
        marksSubject.add(
            new Option(
                `${subject.subject_code} — ${subject.subject_name}`,
                String(subject.subject_id)
            )
        );
    });

    if (subjects.length === 0) {
        showMessage(marksMessage, "No subjects are available.", true);
    }
}

/* Load students enrolled in the selected subject */
async function loadMarkStudents() {
    if (!marksStudent || !marksSubject) return;

    marksStudent.replaceChildren(
        new Option("Choose a student", "")
    );

    if (!marksSubject.value) return;

    const students = await api(
        `/api/attendance/students?subject_id=${encodeURIComponent(marksSubject.value)}`
    );

    students.forEach((student) => {
        const fullName =
            `${student.first_name || ""} ${student.last_name || ""}`.trim();

        marksStudent.add(
            new Option(
                `${student.registration_number} — ${fullName}`,
                String(student.student_id)
            )
        );
    });

    if (students.length === 0) {
        showMessage(
            marksMessage,
            "No students are enrolled in this subject.",
            true
        );
    }
}

/* Load saved marks from the faculty-protected GET endpoint */
async function loadSavedMarks() {
    if (!marksResults) return;

    marksResults.textContent = "Loading saved marks...";

    try {
        const result = await api("/api/marks/");
        savedMarks = Array.isArray(result) ? result : [];

        renderTable(
            marksResults,
            [
                { key: "mark_id", label: "Mark ID" },
                { key: "registration_number", label: "Registration No." },
                { key: "first_name", label: "First Name" },
                { key: "last_name", label: "Last Name" },
                { key: "subject_code", label: "Subject" },
                { key: "assessment_name", label: "Assessment" },
                { key: "marks_obtained", label: "Obtained" },
                { key: "max_marks", label: "Maximum" }
            ],
            savedMarks
        );

        const table = marksResults.querySelector("table");

        if (!table) return;

        savedMarks.forEach((mark, index) => {
            const row = table.querySelectorAll("tbody tr")[index];

            if (!row) return;

            row.tabIndex = 0;
            row.setAttribute("role", "button");
            row.setAttribute(
                "aria-label",
                `Edit marks record ${mark.mark_id}`
            );

            const selectRecord = async () => {
                markIdInput.value = String(mark.mark_id);
                marksSubject.value = String(mark.subject_id);

                try {
                    await loadMarkStudents();

                    marksStudent.value = String(mark.student_id);

                    document.getElementById("assessmentName").value =
                        mark.assessment_name;

                    document.getElementById("marksObtained").value =
                        mark.marks_obtained;

                    document.getElementById("maxMarks").value =
                        mark.max_marks;

                    saveMarksButton.textContent = "Update marks";

                    showMessage(
                        marksMessage,
                        `Editing marks record ${mark.mark_id}.`
                    );
                } catch (error) {
                    showMessage(marksMessage, error.message, true);
                }
            };

            row.addEventListener("click", selectRecord);

            row.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRecord();
                }
            });
        });
    } catch (error) {
        marksResults.textContent =
            error.message || "Unable to load saved marks.";
    }
}

/* Clear the marks form */
function resetMarksForm() {
    marksForm?.reset();

    if (markIdInput) markIdInput.value = "";

    if (saveMarksButton) {
        saveMarksButton.textContent = "Save marks";
    }

    marksStudent?.replaceChildren(
        new Option("Choose a student", "")
    );

    clearMessage(marksMessage);
}

marksSubject?.addEventListener("change", async () => {
    try {
        await loadMarkStudents();
    } catch (error) {
        showMessage(marksMessage, error.message, true);
    }
});

/* Create or update a marks record */
marksForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const markId = markIdInput?.value || "";

    const payload = {
        student_id: Number(marksStudent?.value),
        subject_id: Number(marksSubject?.value),
        assessment_name:
            document.getElementById("assessmentName")?.value.trim() || "",
        marks_obtained:
            Number(document.getElementById("marksObtained")?.value),
        max_marks:
            Number(document.getElementById("maxMarks")?.value)
    };

    if (!payload.student_id || !payload.subject_id) {
        showMessage(
            marksMessage,
            "Choose a subject and student.",
            true
        );
        return;
    }

    if (
        !payload.assessment_name ||
        !Number.isFinite(payload.marks_obtained) ||
        !Number.isFinite(payload.max_marks)
    ) {
        showMessage(
            marksMessage,
            "Enter a valid assessment name and marks.",
            true
        );
        return;
    }

    if (saveMarksButton) {
        saveMarksButton.disabled = true;
        saveMarksButton.textContent = "Saving...";
    }

    try {
        await api(
            markId
                ? `/api/marks/${encodeURIComponent(markId)}`
                : "/api/marks/",
            {
                method: markId ? "PUT" : "POST",
                body: JSON.stringify(payload)
            }
        );

        showMessage(
            marksMessage,
            markId
                ? "Marks updated successfully."
                : "Marks saved successfully."
        );

        resetMarksForm();
        await loadSavedMarks();
    } catch (error) {
        showMessage(
            marksMessage,
            error.message || "Unable to save marks.",
            true
        );
    } finally {
        if (saveMarksButton) {
            saveMarksButton.disabled = false;
            saveMarksButton.textContent =
                markIdInput?.value ? "Update marks" : "Save marks";
        }
    }
});

resetMarksButton?.addEventListener("click", resetMarksForm);

loadMarksButton?.addEventListener("click", loadSavedMarks);

/* Initialize the faculty marks view when it is opened */
async function initializeFacultyMarks() {
    if (!currentUser || currentUser.role !== "Faculty") {
        showMessage(
            globalMessage,
            "Marks management requires a faculty account.",
            true
        );
        return;
    }

    clearMessage(marksMessage);

    try {
        await loadMarkSubjects();
        await loadMarkStudents();
        await loadSavedMarks();
    } catch (error) {
        showMessage(
            marksMessage,
            error.message || "Unable to initialize marks management.",
            true
        );
    }
}

/* Navigation with role checks */
document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
        if (!currentUser) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        const requestedViewId = button.dataset.view;

        if (
            ["gpaView", "academicRecordsView"].includes(requestedViewId) &&
            currentUser.role !== "Student"
        ) {
            showMessage(
                globalMessage,
                "Academic records are available to student accounts.",
                true
            );
            return;
        }

        const isFaculty =
            ["Faculty", "Administrator"].includes(currentUser.role);
        const viewId =
            requestedViewId === "attendanceView" && isFaculty
                ? "facultyView"
                : requestedViewId;

        if (
            viewId === "facultyView" &&
            !isFaculty
        ) {
            showMessage(
                globalMessage,
                "Faculty tools require a faculty or administrator account.",
                true
            );
            return;
        }

        showView(viewId);

        if (viewId === "facultyView") {
            if (requestedViewId === "attendanceView") {
                await initializeFacultyAttendance();
            } else {
                if (currentUser.role === "Faculty") {
                    await initializeFacultyMarks();
                }
                await initializeFacultyAttendance();
            }
        }
    });
});

/* Faculty shortcut button: retained if present in the HTML */
document.getElementById("facultyMarks")
    ?.addEventListener("click", initializeFacultyMarks);

document.getElementById("facultyAttendance")
    ?.addEventListener("click", async () => {
        if (!currentUser ||
            !["Faculty", "Administrator"].includes(currentUser.role)) {
            showMessage(
                globalMessage,
                "Faculty tools require a faculty or administrator account.",
                true
            );
            return;
        }

        showView("facultyView");
        await initializeFacultyAttendance();
        document.getElementById("attendanceSubject")?.focus();
    });

/* Student-only semester academic records */
const academicRecordsButton =
    document.getElementById("loadAcademicRecords");

academicRecordsButton?.addEventListener("click", async () => {
    const container = document.getElementById("academicRecordsResults");
    const messageElement = document.getElementById("academicRecordsMessage");
    const semesterSelect =
        document.getElementById("academicSemesterNumber");

    if (!currentUser || !container || !semesterSelect) {
        showMessage(globalMessage, "Please sign in first.", true);
        return;
    }

    if (currentUser.role !== "Student") {
        showMessage(
            messageElement,
            "Academic records are available to student accounts.",
            true
        );
        return;
    }

    const semesterValue = semesterSelect.value;
    const semester = Number(semesterValue);
    if (
        !semesterValue ||
        !Number.isInteger(semester) ||
        semester < 1 ||
        semester > 8
    ) {
        showMessage(messageElement, "Choose a semester from 1 to 8.", true);
        semesterSelect.focus();
        return;
    }

    academicRecordsButton.disabled = true;
    academicRecordsButton.textContent = "Loading records...";
    container.textContent = "Retrieving academic records...";
    clearMessage(messageElement);

    try {
        const result = await api(
            `/api/academic-records/my?semester=${semester}`
        );

        if (!result || !Array.isArray(result.subjects)) {
            throw new Error(
                "The server returned an unexpected academic records response."
            );
        }

        renderAcademicRecords(container, result.subjects);
        showMessage(
            messageElement,
            result.message ||
                `Academic records loaded for semester ${semester}.`
        );

        if (
            result.subjects.length > 0 &&
            result.academic_year !== null &&
            result.academic_year !== undefined &&
            result.academic_year !== ""
        ) {
            const yearInfo = document.createElement("p");
            yearInfo.textContent = `Academic year: ${result.academic_year}`;
            container.prepend(yearInfo);
        }
    } catch (error) {
        container.replaceChildren();
        showMessage(
            messageElement,
            error.message || "Unable to load academic records.",
            true
        );
    } finally {
        academicRecordsButton.disabled = false;
        academicRecordsButton.textContent = "View Academic Records";
    }
});

/* Restore an existing authenticated session */
async function restoreSession() {
    try {
        const user = await api("/api/auth/me");
        openDashboard(user);
    } catch (_error) {
        currentUser = null;

        dashboardPanel?.classList.add("hidden");
        loginPanel?.classList.remove("hidden");
        logoutButton?.classList.add("hidden");

        clearMessage(loginMessage);
        clearMessage(globalMessage);
    }
}

restoreSession();
