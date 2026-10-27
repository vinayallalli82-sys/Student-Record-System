
"use strict";

/*
 * NFR-003: Usability improvements for the Student Record System.
 * FR-005: View semester-wise academic records.
 * Preserves authentication, attendance, GPA, and faculty functionality.
 */

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const globalMessage = document.getElementById("globalMessage");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;

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

/* Use the backend API with session cookies and CSRF protection. */
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

/* Display one dashboard section at a time. */
function showView(viewId) {
    const viewIds = [
        "attendanceView",
        "gpaView",
        "academicRecordsView",
        "facultyView"
    ];

    viewIds.forEach((id) => {
        const section = document.getElementById(id);

        if (section) {
            section.classList.toggle("hidden", id !== viewId);
        }
    });

    clearMessage(globalMessage);

    const heading = document.getElementById(viewId)?.querySelector("h2");

    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
    }
}

/* Render tables using text nodes, not untrusted HTML. */
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

/* FR-005: Render semester-wise academic records. */
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
        const totalClasses = Number(attendance.total_classes || 0);
        const classesAttended = Number(attendance.classes_attended || 0);
        const attendancePercentage = Number(attendance.percentage || 0);

        const attendanceHeading = document.createElement("h4");
        attendanceHeading.textContent = "Attendance";
        card.appendChild(attendanceHeading);

        appendSummaryRow(card, "Total classes", totalClasses);
        appendSummaryRow(card, "Classes attended", classesAttended);
        appendSummaryRow(
            card,
            "Attendance percentage",
            `${formatNumber(attendancePercentage)}%`
        );

        container.appendChild(card);
    });
}

/* Open the correct dashboard for the authenticated user. */
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

    clearMessage(loginMessage);
    showMessage(globalMessage, "Signed in successfully.");
    showView("attendanceView");
}

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
        "facultyResults"
    ].forEach((id) => {
        const container = document.getElementById(id);
        if (container) container.replaceChildren();
    });

    clearMessage(document.getElementById("academicRecordsMessage"));

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

        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";
        const submitButton = loginForm.querySelector('button[type="submit"]');

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

/* Navigation with role checks */
document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!currentUser) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        const viewId = button.dataset.view;

        if (
            ["gpaView", "academicRecordsView"].includes(viewId) &&
            currentUser.role !== "Student"
        ) {
            showMessage(
                globalMessage,
                "These academic features are available to student accounts.",
                true
            );
            return;
        }

        if (
            viewId === "facultyView" &&
            !["Faculty", "Administrator"].includes(currentUser.role)
        ) {
            showMessage(
                globalMessage,
                "Faculty tools require a faculty or administrator account.",
                true
            );
            return;
        }

        showView(viewId);
    });
});

/* Attendance records */
const attendanceButton = document.getElementById("loadAttendance");

attendanceButton?.addEventListener("click", async () => {
    const container = document.getElementById("attendanceResults");

    if (!currentUser || !container) {
        showMessage(globalMessage, "Please sign in first.", true);
        return;
    }

    if (currentUser.role !== "Student") {
        container.textContent =
            "Student attendance is available here. Faculty management requires a faculty-specific API.";
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

/* Semester GPA */
const gpaButton = document.getElementById("loadGpa");

gpaButton?.addEventListener("click", async () => {
    const container = document.getElementById("gpaResults");
    const semesterSelect = document.getElementById("semesterNumber");

    if (!currentUser || !container || !semesterSelect) {
        showMessage(globalMessage, "Please sign in first.", true);
        return;
    }

    if (currentUser.role !== "Student") {
        container.textContent = "GPA records are available to student accounts.";
        return;
    }

    const semesterValue = semesterSelect.value;
    const semester = Number(semesterValue);

    if (!semesterValue || !Number.isInteger(semester) || semester < 1 || semester > 8) {
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

        const gpaValue = result.gpa ?? result.semester_gpa ?? result.sgpa;
        const summary = document.createElement("p");
        summary.textContent =
            gpaValue === null || gpaValue === undefined
                ? "No GPA value was returned by the server."
                : `Semester ${semester} GPA: ${gpaValue}`;

        container.appendChild(summary);

        const subjects =
            result.subjects || result.subject_results || result.results || [];

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

/* FR-005: Academic Records */
const academicRecordsButton = document.getElementById("loadAcademicRecords");

academicRecordsButton?.addEventListener("click", async () => {
    const container = document.getElementById("academicRecordsResults");
    const messageElement = document.getElementById("academicRecordsMessage");
    const semesterSelect = document.getElementById("academicSemesterNumber");

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

    if (!semesterValue || !Number.isInteger(semester) || semester < 1 || semester > 8) {
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

        if (result.subjects.length === 0) {
            showMessage(
                messageElement,
                result.message ||
                    `No academic records found for semester ${semester}.`
            );
        } else {
            showMessage(
                messageElement,
                result.message ||
                    `Academic records loaded for semester ${semester}.`
            );

            const academicYear = result.academic_year;
            if (academicYear !== null && academicYear !== undefined && academicYear !== "") {
                const yearInfo = document.createElement("p");
                yearInfo.textContent = `Academic year: ${academicYear}`;
                container.prepend(yearInfo);
            }
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

/* Faculty shortcuts: informational until faculty-specific endpoints exist. */
function handleFacultyShortcut(action) {
    const container = document.getElementById("facultyResults");
    if (!container) return;

    if (!currentUser || !["Faculty", "Administrator"].includes(currentUser.role)) {
        container.textContent =
            "Please sign in with a faculty or administrator account.";
        return;
    }

    container.textContent = action === "attendance"
        ? "Faculty attendance management requires a faculty-specific attendance API."
        : "Faculty marks management requires a faculty-specific marks API.";
}

document.getElementById("facultyAttendance")
    ?.addEventListener("click", () => handleFacultyShortcut("attendance"));

document.getElementById("facultyMarks")
    ?.addEventListener("click", () => handleFacultyShortcut("marks"));

/* Restore an existing session quietly. */
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
