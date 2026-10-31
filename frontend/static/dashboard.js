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
const notificationModal = document.getElementById("notificationModal");
const notificationDialog =
    document.getElementById("notificationDialog");
const notificationCounter =
    document.getElementById("notificationCounter");
const notificationSubject =
    document.getElementById("notificationSubject");
const notificationPercentage =
    document.getElementById("notificationPercentage");
const notificationMessage =
    document.getElementById("notificationMessage");
const previousNotificationButton =
    document.getElementById("previousNotification");
const nextNotificationButton =
    document.getElementById("nextNotification");
const dismissNotificationButton =
    document.getElementById("dismissNotification");

let currentUser = null;
let notificationSessionId = 0;
let notificationDismissed = false;
let studentNotifications = [];
let currentNotificationIndex = 0;

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
        "marksSummaryView",
        "facultyView",
        "adminView"
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
            `Subject ID: ${subject.subject_id ?? "—"} — ` +
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

function renderStudentNotification(index) {
    const notification = studentNotifications[index];
    if (!notification) return;

    const message = String(notification.message || "");
    const subjectMatch = message.match(
        /^Low attendance alert for (.+?): your attendance is /i
    );
    const subjectName =
        notification.subject_name ||
        subjectMatch?.[1] ||
        `Subject ${notification.subject_id ?? "—"}`;

    notificationSubject.textContent = subjectName;
    notificationPercentage.textContent =
        `${formatNumber(notification.attendance_percentage)}%`;
    notificationMessage.textContent =
        message || "Your attendance is below the required threshold.";
    notificationCounter.textContent =
        `${index + 1} of ${studentNotifications.length}`;
    notificationCounter.classList.toggle(
        "hidden",
        studentNotifications.length < 2
    );
    previousNotificationButton.classList.toggle(
        "hidden",
        studentNotifications.length < 2
    );
    nextNotificationButton.classList.toggle(
        "hidden",
        studentNotifications.length < 2
    );
    previousNotificationButton.disabled = index === 0;
    nextNotificationButton.disabled =
        index === studentNotifications.length - 1;
}

function showStudentNotification() {
    if (
        notificationDismissed ||
        !currentUser ||
        currentUser.role !== "Student" ||
        studentNotifications.length === 0 ||
        !notificationModal
    ) {
        return;
    }

    renderStudentNotification(currentNotificationIndex);
    notificationModal.classList.remove("hidden");
    notificationModal.setAttribute("aria-hidden", "false");
    notificationDialog?.focus();
}

function dismissStudentNotification() {
    notificationDismissed = true;
    notificationModal?.classList.add("hidden");
    notificationModal?.setAttribute("aria-hidden", "true");
}

async function loadStudentNotifications(sessionId) {
    if (!currentUser || currentUser.role !== "Student") return;

    try {
        const notifications = await api("/api/notifications");

        if (
            sessionId !== notificationSessionId ||
            !currentUser ||
            currentUser.role !== "Student" ||
            notificationDismissed
        ) {
            return;
        }

        if (!Array.isArray(notifications)) {
            throw new Error(
                "The server returned an unexpected notifications response."
            );
        }

        if (notifications.length === 0) return;

        studentNotifications = notifications;
        currentNotificationIndex = 0;
        showStudentNotification();
    } catch (error) {
        if (sessionId === notificationSessionId && currentUser?.role === "Student") {
            showMessage(
                globalMessage,
                error.message || "Unable to load notifications.",
                true
            );
        }
    }
}

/* Open the dashboard for the authenticated user */
function openDashboard(user) {
    currentUser = user;
    notificationSessionId += 1;
    notificationDismissed = false;
    studentNotifications = [];
    currentNotificationIndex = 0;
    notificationModal?.classList.add("hidden");
    notificationModal?.setAttribute("aria-hidden", "true");

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
    const isFaculty = user.role === "Faculty";

    document.getElementById("gpaNav")
        ?.classList.toggle("hidden", !isStudent);

    document.getElementById("academicRecordsNav")
        ?.classList.toggle("hidden", !isStudent);

    document.getElementById("marksSummaryNav")
        ?.classList.toggle("hidden", !isStudent);

    document.getElementById("facultyNav")
        ?.classList.toggle("hidden", !isFaculty);
    const isAdministrator = user.role === "Administrator";
    document.getElementById("adminNav")
        ?.classList.toggle("hidden", !isAdministrator);
    document.getElementById("attendanceNav")
        ?.classList.toggle("hidden", isAdministrator);

    document.getElementById("facultyMarksSection")
        ?.classList.toggle("hidden", user.role !== "Faculty");

    clearMessage(loginMessage);
    showMessage(globalMessage, "Signed in successfully.");
    showView(isAdministrator ? "adminView" : "attendanceView");
    if (isAdministrator) {
        loadAdminData().catch((error) =>
            showMessage(globalMessage, error.message, true)
        );
    }
    if (isStudent) {
        void loadStudentNotifications(notificationSessionId);
    }
}

/* Return to the login screen */
function closeDashboard(message = "") {
    currentUser = null;
    notificationSessionId += 1;
    notificationDismissed = false;
    studentNotifications = [];
    currentNotificationIndex = 0;
    notificationModal?.classList.add("hidden");
    notificationModal?.setAttribute("aria-hidden", "true");
    notificationCounter.textContent = "";
    notificationSubject.textContent = "";
    notificationPercentage.textContent = "";
    notificationMessage.textContent = "";

    dashboardPanel?.classList.add("hidden");
    loginPanel?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");

    loginForm?.reset();

    clearMessage(globalMessage);

    [
        "attendanceResults",
        "gpaResults",
        "academicRecordsResults",
        "studentMarksSummaryResults",
        "marksResults",
        "facultyAttendanceResults"
    ].forEach((id) => {
        document.getElementById(id)?.replaceChildren();
    });

    clearMessage(document.getElementById("academicRecordsMessage"));
    clearMessage(studentMarksSummaryMessage);
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

    if (currentUser.role !== "Student") {
        container.textContent = "Student attendance is available to student accounts.";
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

        // Load subjects separately so attendance still displays if the lookup fails.
        const subjects = await api("/api/subjects").catch(() => []);
        const subjectsById = new Map(
            (Array.isArray(subjects) ? subjects : []).map((subject) => [
                String(subject.subject_id ?? subject.id),
                subject
            ])
        );

        renderTable(container, [
            { key: "attendance_date", label: "Date" },
            { key: "subject_id", label: "Subject ID" },
            { key: "subject_code", label: "Subject Code" },
            { key: "subject_name", label: "Subject Name" },
            { key: "status", label: "Status" }
        ], records.map((record) => {
            const subjectId = record.subject_id ?? record.subject?.subject_id ?? record.id;
            const subject = subjectsById.get(String(subjectId)) || {};

            return {
                ...record,
                subject_id: subjectId ?? "—",
                subject_code:
                    record.subject_code ??
                    record.subject?.subject_code ??
                    subject.subject_code ??
                    subject.code ??
                    "—",
                subject_name:
                    record.subject_name ??
                    record.subject?.subject_name ??
                    record.name ??
                    subject.subject_name ??
                    subject.name ??
                    "—"
            };
        }));
    } catch (error) {
        container.textContent =
            error.message || "Unable to load attendance records.";
    } finally {
        attendanceButton.disabled = false;
        attendanceButton.textContent = "Load attendance";
    }
});

/* FR-014: Faculty subject-wise marks summary */
const summarySubject = document.getElementById("summarySubject");
const loadSubjectSummaryButton = document.getElementById("loadSubjectSummary");
const subjectSummaryMessage = document.getElementById("subjectSummaryMessage");
const subjectSummaryResults = document.getElementById("subjectSummaryResults");

loadSubjectSummaryButton?.addEventListener("click", async () => {
    if (!summarySubject || !subjectSummaryResults) return;

    const subjectId = summarySubject.value;

    if (!subjectId) {
        if (subjectSummaryMessage) {
            subjectSummaryMessage.textContent = "Please select a subject.";
        }
        subjectSummaryResults.replaceChildren();
        return;
    }

    loadSubjectSummaryButton.disabled = true;
    loadSubjectSummaryButton.textContent = "Loading...";
    subjectSummaryResults.textContent = "Loading subject marks summary...";

    if (subjectSummaryMessage) {
        subjectSummaryMessage.textContent = "";
    }

    try {
        const result = await api(
            `/api/marks/summary?subject_id=${encodeURIComponent(subjectId)}`
        );

        const students = Array.isArray(result.students) ? result.students : [];
        const rows = [];

        students.forEach((student) => {
            const studentName = [
                student.first_name,
                student.last_name
            ].filter(Boolean).join(" ");

            if (!student.assessments?.length) {
                rows.push({
                    registration_number: student.registration_number,
                    student_name: studentName || "—",
                    assessment_name: "No marks recorded",
                    marks_obtained: "—",
                    max_marks: "—"
                });
                return;
            }

            student.assessments.forEach((assessment) => {
                rows.push({
                    registration_number: student.registration_number,
                    student_name: studentName || "—",
                    assessment_name: assessment.assessment_name,
                    marks_obtained: assessment.marks_obtained,
                    max_marks: assessment.max_marks
                });
            });
        });

        subjectSummaryResults.replaceChildren();

        const heading = document.createElement("h4");
        heading.textContent =
            `Subject ID: ${result.subject.subject_id ?? "—"} — ` +
            `${result.subject.subject_code || "—"} — ` +
            `${result.subject.subject_name || "—"}`;
        subjectSummaryResults.appendChild(heading);

        if (subjectSummaryMessage) {
            subjectSummaryMessage.textContent = result.message || "";
        }

        if (rows.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.textContent = "No students are enrolled in this subject.";
            subjectSummaryResults.appendChild(emptyMessage);
        } else {
            renderTable(subjectSummaryResults, [
                { key: "registration_number", label: "Registration Number" },
                { key: "student_name", label: "Student Name" },
                { key: "assessment_name", label: "Assessment" },
                { key: "marks_obtained", label: "Marks Obtained" },
                { key: "max_marks", label: "Maximum Marks" }
            ], rows);
        }
    } catch (error) {
        subjectSummaryResults.textContent =
            error.message || "Unable to load subject marks summary.";

        if (subjectSummaryMessage) {
            subjectSummaryMessage.textContent = "Failed to load summary.";
        }
    } finally {
        loadSubjectSummaryButton.disabled = false;
        loadSubjectSummaryButton.textContent = "View Summary";
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
            // Some GPA responses omit subject_id. Resolve it from /api/subjects
            // using the subject code, without changing the GPA calculation.
            let subjectCatalog = [];
            try {
                const catalogResult = await api("/api/subjects");
                subjectCatalog = Array.isArray(catalogResult)
                    ? catalogResult
                    : catalogResult.subjects || catalogResult.data || [];
            } catch (catalogError) {
                console.warn("Could not load subject IDs for GPA table:", catalogError);
            }

            const subjectsWithIds = subjects.map((item) => {
                const code = item.subject_code ?? item.code ?? item.subject?.subject_code;
                const matchedSubject = subjectCatalog.find((subject) =>
                    String(subject.subject_code ?? subject.code ?? "").toLowerCase() ===
                    String(code ?? "").toLowerCase()
                );
                return {
                    ...item,
                    subject_id:
                        item.subject_id ?? item.subject?.subject_id ?? item.id ??
                        matchedSubject?.subject_id ?? matchedSubject?.id ?? "—"
                };
            });

            const tableContainer = document.createElement("div");

            renderTable(
                tableContainer,
                [
                    { key: "subject_id", label: "Subject ID" },
                    { key: "subject_code", label: "Subject Code" },
                    { key: "subject_name", label: "Subject Name" },
                    { key: "credits", label: "Credits" },
                    { key: "grade", label: "Grade" },
                    { key: "grade_point", label: "Grade Point" }
                ],
                subjectsWithIds
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
const attendanceStartDate =
    document.getElementById("attendanceStartDate");
const attendanceEndDate =
    document.getElementById("attendanceEndDate");
const filterAttendanceButton =
    document.getElementById("filterAttendanceButton");
const clearAttendanceFilterButton =
    document.getElementById("clearAttendanceFilterButton");
const attendanceFilterMessage =
    document.getElementById("attendanceFilterMessage");
const attendanceFilterResults =
    document.getElementById("attendanceFilterResults");

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
                `${subject.subject_id} — ${subject.subject_code} — ${subject.subject_name}`,
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

async function filterAttendanceRecords() {
    const subjectId = attendanceSubject?.value;
    const startDate = attendanceStartDate?.value;
    const endDate = attendanceEndDate?.value;

    if (attendanceFilterResults) attendanceFilterResults.replaceChildren();

    if (!subjectId) {
        showMessage(attendanceFilterMessage, "Please choose a subject.", true);
        return;
    }

    if (!startDate && !endDate) {
        showMessage(
            attendanceFilterMessage,
            "Select a start date, an end date, or both.",
            true
        );
        return;
    }

    if (startDate && endDate && startDate > endDate) {
        showMessage(
            attendanceFilterMessage,
            "Start date cannot be after end date.",
            true
        );
        return;
    }

    const params = new URLSearchParams();
    params.set("subject_id", subjectId);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    showMessage(attendanceFilterMessage, "Loading attendance records...");

    try {
        const records = await api(`/api/attendance?${params.toString()}`);
        if (!Array.isArray(records)) {
            throw new Error("The server returned invalid attendance data.");
        }

        if (records.length === 0) {
            if (attendanceFilterResults) {
                attendanceFilterResults.textContent =
                    "No attendance records match the selected filters.";
            }
            showMessage(attendanceFilterMessage, "No matching records.");
            return;
        }

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Student ID", "Subject ID", "Date", "Status"].forEach((label) => {
            const th = document.createElement("th");
            th.textContent = label;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        records.forEach((record) => {
            const row = document.createElement("tr");
            [record.student_id, record.subject_id, record.attendance_date, record.status]
                .forEach((value) => {
                    const cell = document.createElement("td");
                    cell.textContent = value == null ? "—" : String(value);
                    row.appendChild(cell);
                });
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        attendanceFilterResults?.appendChild(table);
        showMessage(
            attendanceFilterMessage,
            `Found ${records.length} attendance record${records.length === 1 ? "" : "s"}.`
        );
    } catch (error) {
        if (attendanceFilterResults) {
            attendanceFilterResults.textContent =
                error.message || "Unable to filter attendance records.";
        }
        showMessage(
            attendanceFilterMessage,
            error.message || "Unable to filter attendance records.",
            true
        );
    }
}

filterAttendanceButton?.addEventListener("click", () => {
    filterAttendanceRecords();
});

clearAttendanceFilterButton?.addEventListener("click", () => {
    if (attendanceStartDate) attendanceStartDate.value = "";
    if (attendanceEndDate) attendanceEndDate.value = "";
    if (attendanceFilterResults) {
        attendanceFilterResults.textContent =
            "Choose a subject and date range, then select Filter records.";
    }
    showMessage(attendanceFilterMessage, "");
});

async function initializeFacultyAttendance() {
    if (!currentUser ||
        !["Faculty", "Administrator"].includes(currentUser.role)) {
        showMessage(
            globalMessage,
            "Faculty tools require a faculty account.",
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
            "Faculty tools require a faculty account.",
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
                `${subject.subject_id} — ${subject.subject_code} — ${subject.subject_name}`,
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

/* FR-014: Populate the faculty subject-wise summary dropdown. */
async function initializeFacultyMarksSummary() {
    if (!summarySubject) return;

    const selectedSubject = summarySubject.value;
    const subjects = await api("/api/subjects");

    if (!Array.isArray(subjects)) {
        throw new Error("The server returned an invalid subjects list.");
    }

    summarySubject.replaceChildren(
        new Option("Choose a subject", "")
    );

    subjects.forEach((subject) => {
        summarySubject.add(
            new Option(
                `ID: ${subject.subject_id} — ` +
                `${subject.subject_code} — ${subject.subject_name}`,
                String(subject.subject_id)
            )
        );
    });

    if (subjects.some(
        (subject) => String(subject.subject_id) === selectedSubject
    )) {
        summarySubject.value = selectedSubject;
    }
}

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
        await initializeFacultyMarksSummary();
    } catch (error) {
        showMessage(
            marksMessage,
            error.message || "Unable to initialize marks management.",
            true
        );
    }
}

/* ADMIN-002: account and faculty assignment management UI */
function makeAdminElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = text;
    if (className) element.className = className;
    return element;
}

async function loadAdminData() {
    if (!currentUser || currentUser.role !== "Administrator") return;
    const [users, subjects, assignments] = await Promise.all([
        api("/api/admin/users"),
        api("/api/subjects"),
        api("/api/admin/faculty-assignments")
    ]);

    const facultySelect = document.getElementById("adminFacultySelect");
    const subjectSelect = document.getElementById("adminSubjectSelect");
    facultySelect.replaceChildren(new Option("Choose faculty", ""));
    subjectSelect.replaceChildren(new Option("Choose subject", ""));
    users.filter((user) => user.role === "Faculty" && user.is_active).forEach((user) => {
        facultySelect.add(new Option(user.email, String(user.user_id)));
    });
    subjects.forEach((subject) => {
        subjectSelect.add(new Option(`${subject.subject_code} — ${subject.subject_name}`, String(subject.subject_id)));
    });

    const usersContainer = document.getElementById("adminUsersResults");
    usersContainer.replaceChildren();
    if (!users.length) usersContainer.append(makeAdminElement("p", "No accounts found."));
    users.forEach((user) => {
        const row = makeAdminElement("div", null, "admin-user-row");
        row.append(makeAdminElement("strong", `${user.email} (ID ${user.user_id})`));
        const role = document.createElement("select");
        ["Student", "Faculty", "Administrator"].forEach((value) => role.add(new Option(value, value)));
        role.value = user.role;
        role.setAttribute("aria-label", `Role for ${user.email}`);
        const activeLabel = makeAdminElement("label", " Active ");
        const active = document.createElement("input");
        active.type = "checkbox";
        active.checked = Boolean(user.is_active);
        active.setAttribute("aria-label", `Active status for ${user.email}`);
        activeLabel.prepend(active);
        const save = makeAdminElement("button", "Save changes");
        save.type = "button";
        save.addEventListener("click", async () => {
            try {
                await api(`/api/admin/users/${user.user_id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ role: role.value, is_active: active.checked })
                });
                showMessage(document.getElementById("adminAccountMessage"), `Updated ${user.email}.`);
                await loadAdminData();
            } catch (error) {
                showMessage(document.getElementById("adminAccountMessage"), error.message, true);
            }
        });
        row.append(role, activeLabel, save);
        usersContainer.append(row);
    });

    const assignmentsContainer = document.getElementById("adminAssignmentsResults");
    assignmentsContainer.replaceChildren();
    if (!assignments.length) assignmentsContainer.append(makeAdminElement("p", "No faculty assignments yet."));
    assignments.forEach((assignment) => {
        const row = makeAdminElement("div", null, "admin-assignment-row");
        row.append(makeAdminElement("span", `${assignment.faculty_email} — ${assignment.subject_code}: ${assignment.subject_name}`));
        const remove = makeAdminElement("button", "Remove assignment", "secondary");
        remove.type = "button";
        remove.addEventListener("click", async () => {
            try {
                await api(`/api/admin/faculty-assignments/${assignment.faculty_id}/${assignment.subject_id}`, { method: "DELETE" });
                showMessage(document.getElementById("adminAssignmentMessage"), "Faculty assignment removed.");
                await loadAdminData();
            } catch (error) {
                showMessage(document.getElementById("adminAssignmentMessage"), error.message, true);
            }
        });
        row.append(remove);
        assignmentsContainer.append(row);
    });
}

document.getElementById("adminCreateUserForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const user = await api("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({
                email: document.getElementById("adminNewEmail").value,
                password: document.getElementById("adminNewPassword").value,
                role: document.getElementById("adminNewRole").value
            })
        });
        event.currentTarget.reset();
        showMessage(document.getElementById("adminAccountMessage"), `Created ${user.user.email}.`);
        await loadAdminData();
    } catch (error) {
        showMessage(document.getElementById("adminAccountMessage"), error.message, true);
    }
});

document.getElementById("adminAssignmentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await api("/api/admin/faculty-assignments", {
            method: "POST",
            body: JSON.stringify({
                faculty_id: Number(document.getElementById("adminFacultySelect").value),
                subject_id: Number(document.getElementById("adminSubjectSelect").value)
            })
        });
        showMessage(document.getElementById("adminAssignmentMessage"), "Faculty assigned to subject.");
        await loadAdminData();
    } catch (error) {
        showMessage(document.getElementById("adminAssignmentMessage"), error.message, true);
    }
});

document.getElementById("refreshAdminUsers")?.addEventListener("click", () => loadAdminData().catch((error) => showMessage(document.getElementById("adminAccountMessage"), error.message, true)));
document.getElementById("refreshAdminAssignments")?.addEventListener("click", () => loadAdminData().catch((error) => showMessage(document.getElementById("adminAssignmentMessage"), error.message, true)));

/* Navigation with role checks */
document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
        if (!currentUser) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        const requestedViewId = button.dataset.view;

        if (requestedViewId === "adminView" && currentUser.role !== "Administrator") {
            showMessage(globalMessage, "Administrator tools require an Administrator account.", true);
            return;
        }

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

        const isFaculty = currentUser.role === "Faculty";
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
                "Faculty tools require a faculty account.",
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

previousNotificationButton?.addEventListener("click", () => {
    if (currentNotificationIndex > 0) {
        currentNotificationIndex -= 1;
        showStudentNotification();
    }
});

nextNotificationButton?.addEventListener("click", () => {
    if (currentNotificationIndex < studentNotifications.length - 1) {
        currentNotificationIndex += 1;
        showStudentNotification();
    }
});

dismissNotificationButton?.addEventListener(
    "click",
    dismissStudentNotification
);

/* Faculty shortcut button: retained if present in the HTML */
document.getElementById("facultyMarks")
    ?.addEventListener("click", initializeFacultyMarks);

document.getElementById("facultyAttendance")
    ?.addEventListener("click", async () => {
        if (!currentUser ||
            !["Faculty", "Administrator"].includes(currentUser.role)) {
            showMessage(
                globalMessage,
                "Faculty tools require a faculty account.",
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

/* FR-014: Students can view only their own marks by subject. */
const studentMarksSummaryButton =
    document.getElementById("loadStudentMarksSummary");
const studentMarksSummarySemester =
    document.getElementById("marksSummarySemester");
const studentMarksSummaryMessage =
    document.getElementById("studentMarksSummaryMessage");
const studentMarksSummaryResults =
    document.getElementById("studentMarksSummaryResults");

studentMarksSummaryButton?.addEventListener("click", async () => {
    if (!currentUser || currentUser.role !== "Student") {
        showMessage(
            studentMarksSummaryMessage,
            "This summary is available only to student accounts.",
            true
        );
        return;
    }

    const semesterValue = studentMarksSummarySemester?.value || "";
    const semester = Number(semesterValue);

    if (
        !semesterValue ||
        !Number.isInteger(semester) ||
        semester < 1 ||
        semester > 8
    ) {
        showMessage(
            studentMarksSummaryMessage,
            "Choose a semester from 1 to 8.",
            true
        );
        return;
    }

    studentMarksSummaryButton.disabled = true;
    studentMarksSummaryButton.textContent = "Loading...";
    studentMarksSummaryResults?.replaceChildren();
    showMessage(studentMarksSummaryMessage, "Loading your marks...");

    try {
        // The server derives the student from the authenticated session.
        const result = await api(
            `/api/academic-records/my?semester=${semester}`
        );

        if (!result || !Array.isArray(result.subjects)) {
            throw new Error("The server returned an invalid marks summary.");
        }

        if (result.subjects.length === 0) {
            studentMarksSummaryResults.textContent =
                "No subjects or marks are available for this semester.";
        } else {
            result.subjects.forEach((subject) => {
                const card = document.createElement("article");
                card.className = "academic-subject";

                const heading = document.createElement("h3");
                heading.textContent =
                    `Subject ID: ${subject.subject_id ?? "—"} — ` +
                    `${subject.subject_code || "—"} — ` +
                    `${subject.subject_name || "Unnamed subject"}`;
                card.appendChild(heading);

                const assessments = Array.isArray(subject.assessments)
                    ? subject.assessments
                    : [];

                if (assessments.length === 0) {
                    const empty = document.createElement("p");
                    empty.textContent = "No marks recorded yet.";
                    card.appendChild(empty);
                } else {
                    const table = document.createElement("div");
                    renderTable(
                        table,
                        [
                            { key: "assessment_name", label: "Assessment" },
                            { key: "marks_obtained", label: "Marks Obtained" },
                            { key: "max_marks", label: "Maximum Marks" }
                        ],
                        assessments
                    );
                    card.appendChild(table);
                }

                studentMarksSummaryResults.appendChild(card);
            });
        }

        showMessage(
            studentMarksSummaryMessage,
            result.message || "Your subject-wise marks summary is ready."
        );
    } catch (error) {
        studentMarksSummaryResults?.replaceChildren();
        showMessage(
            studentMarksSummaryMessage,
            error.message || "Unable to load your marks summary.",
            true
        );
    } finally {
        studentMarksSummaryButton.disabled = false;
        studentMarksSummaryButton.textContent = "View My Marks";
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