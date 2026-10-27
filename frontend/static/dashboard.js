
"use strict";

/*
 * NFR-003: Usability improvements for the Student Record System.
 * Uses the element IDs defined in dashboard.html.
 * Keeps all attendance, GPA, and authentication logic in the backend.
 */

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const globalMessage = document.getElementById("globalMessage");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;

/* Display an accessible status or error message. */
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

/* Use the existing backend API with session cookies and CSRF protection. */
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
    ["attendanceView", "gpaView", "facultyView"].forEach((id) => {
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

/* Safely display records without inserting HTML from API responses. */
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

    document.getElementById("facultyNav")
        ?.classList.toggle("hidden", !isFaculty);

    clearMessage(loginMessage);
    showMessage(globalMessage, "Signed in successfully.");
    showView("attendanceView");
}

/* Return to a clean login screen without showing an error by default. */
function closeDashboard(message = "") {
    currentUser = null;

    dashboardPanel?.classList.add("hidden");
    loginPanel?.classList.remove("hidden");
    logoutButton?.classList.add("hidden");

    loginForm?.reset();

    clearMessage(globalMessage);

    if (message) {
        showMessage(loginMessage, message);
    } else {
        clearMessage(loginMessage);
    }
}

/* Login form. */
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email")?.value.trim() || "";
        const password = document.getElementById("password")?.value || "";
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

/* Logout. */
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

/* Navigation with role checks. */
document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!currentUser) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        const viewId = button.dataset.view;

        if (viewId === "gpaView" && currentUser.role !== "Student") {
            showMessage(
                globalMessage,
                "GPA records are available to student accounts.",
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

/* Attendance records. */
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

/* Semester GPA. */
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

/* Faculty shortcuts: informational only until faculty-specific endpoints exist. */
function handleFacultyShortcut(action) {
    const container = document.getElementById("facultyResults");

    if (!container) return;

    if (
        !currentUser ||
        !["Faculty", "Administrator"].includes(currentUser.role)
    ) {
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

/*
 * Restore a session quietly.
 * An unauthenticated response is normal on the login page, not a UI error.
 */
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
