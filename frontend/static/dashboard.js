
"use strict";

/*
 * Student Record System — NFR-003 Usability
 * Matches the element IDs in frontend/templates/dashboard.html.
 */

const loginPanel = document.getElementById("loginPanel");
const dashboardPanel = document.getElementById("dashboardPanel");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const globalMessage = document.getElementById("globalMessage");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;
let csrfToken = null;

/* ---------- Accessible messages ---------- */

function showMessage(element, message, isError = false) {
    if (!element) return;

    element.textContent = message;
    element.setAttribute("role", isError ? "alert" : "status");
    element.setAttribute("aria-live", isError ? "assertive" : "polite");
    element.classList.toggle("error-message", isError);
    element.classList.toggle("success-message", !isError);
}

function setLoading(button, loading, loadingText, originalText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : originalText;
}

/* ---------- CSRF protection and API requests ---------- */

async function getCsrfToken() {
    const response = await fetch("/api/auth/csrf", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.csrf_token) {
        throw new Error("Unable to initialize a secure request. Refresh the page and try again.");
    }

    csrfToken = data.csrf_token;
    return csrfToken;
}

async function api(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
    };

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        headers["X-CSRFToken"] = await getCsrfToken();
    }

    const response = await fetch(url, {
        ...options,
        method,
        headers,
        credentials: "same-origin"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Your session may have expired. Please sign in again.");
        }

        throw new Error(
            data.error ||
            data.message ||
            `The request failed (HTTP ${response.status}).`
        );
    }

    return data;
}

/* ---------- View navigation ---------- */

function showView(viewId) {
    const viewIds = ["attendanceView", "gpaView", "facultyView"];

    viewIds.forEach((id) => {
        const view = document.getElementById(id);
        if (view) {
            view.classList.toggle("hidden", id !== viewId);
        }
    });

    const selectedView = document.getElementById(viewId);
    const heading = selectedView?.querySelector("h2");

    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus();
    }

    if (globalMessage) {
        globalMessage.textContent = "";
    }
}

/* ---------- Safe table rendering ---------- */

function renderTable(container, columns, rows) {
    if (!container) return;

    container.replaceChildren();

    if (!Array.isArray(rows) || rows.length === 0) {
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

    rows.forEach((record) => {
        const tr = document.createElement("tr");

        columns.forEach((column) => {
            const td = document.createElement("td");
            const value = record[column.key];

            td.textContent =
                value === null || value === undefined || value === ""
                    ? "—"
                    : String(value);

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

/* ---------- Login and dashboard state ---------- */

function openDashboard(user) {
    currentUser = user;

    if (loginPanel) {
        loginPanel.classList.add("hidden");
    }

    if (dashboardPanel) {
        dashboardPanel.classList.remove("hidden");
    }

    if (logoutButton) {
        logoutButton.classList.remove("hidden");
    }

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

    const gpaNav = document.getElementById("gpaNav");
    const facultyNav = document.getElementById("facultyNav");

    if (gpaNav) {
        gpaNav.classList.toggle("hidden", !isStudent);
    }

    if (facultyNav) {
        facultyNav.classList.toggle("hidden", !isFaculty);
    }

    showMessage(globalMessage, "You are signed in successfully.");
    showView("attendanceView");
}

function closeDashboard(message = "Please sign in to continue.") {
    currentUser = null;
    csrfToken = null;

    if (dashboardPanel) {
        dashboardPanel.classList.add("hidden");
    }

    if (loginPanel) {
        loginPanel.classList.remove("hidden");
    }

    if (logoutButton) {
        logoutButton.classList.add("hidden");
    }

    if (loginForm) {
        loginForm.reset();
    }

    showMessage(loginMessage, message);

    document.getElementById("email")?.focus();
}

/* ---------- Login ---------- */

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const submitButton = loginForm.querySelector('button[type="submit"]');

        const email = emailInput?.value.trim() || "";
        const password = passwordInput?.value || "";

        if (!email || !password) {
            showMessage(loginMessage, "Enter your email address and password.", true);
            return;
        }

        setLoading(submitButton, true, "Signing in...", "Sign in");
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
            setLoading(submitButton, false, "Signing in...", "Sign in");
        }
    });
}

/* ---------- Logout ---------- */

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        setLoading(logoutButton, true, "Signing out...", "Log out");

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
            setLoading(logoutButton, false, "Signing out...", "Log out");
        }
    });
}

/* ---------- Dashboard navigation ---------- */

document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
        if (!currentUser) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        const viewId = button.dataset.view;

        if (viewId === "gpaView" && currentUser.role !== "Student") {
            showMessage(globalMessage, "GPA records are available to student accounts.", true);
            return;
        }

        if (
            viewId === "facultyView" &&
            !["Faculty", "Administrator"].includes(currentUser.role)
        ) {
            showMessage(globalMessage, "Faculty tools require a faculty or administrator account.", true);
            return;
        }

        showView(viewId);
    });
});

/* ---------- Attendance ---------- */

const attendanceButton = document.getElementById("loadAttendance");

if (attendanceButton) {
    attendanceButton.addEventListener("click", async () => {
        const container = document.getElementById("attendanceResults");

        if (!currentUser || !container) {
            showMessage(globalMessage, "Please sign in first.", true);
            return;
        }

        if (currentUser.role !== "Student") {
            container.textContent =
                "Student attendance is shown here. Faculty management requires a faculty-specific API.";
            return;
        }

        setLoading(attendanceButton, true, "Loading...", "Load attendance");
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
            setLoading(attendanceButton, false, "Loading...", "Load attendance");
        }
    });
}

/* ---------- Semester GPA ---------- */

const gpaButton = document.getElementById("loadGpa");

if (gpaButton) {
    gpaButton.addEventListener("click", async () => {
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

        const semester = Number(semesterSelect.value);

        if (!semesterSelect.value || !Number.isInteger(semester) ||
            semester < 1 || semester > 8) {
            container.textContent = "Please choose a semester from 1 to 8.";
            semesterSelect.focus();
            return;
        }

        if (!currentUser.student_id) {
            container.textContent =
                "No student profile is linked to this account. Please contact the administrator.";
            return;
        }

        setLoading(gpaButton, true, "Loading GPA...", "View GPA");
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
                    ? "The server did not return a GPA value."
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
            setLoading(gpaButton, false, "Loading GPA...", "View GPA");
        }
    });
}

/* ---------- Faculty shortcuts ---------- */

const facultyAttendanceButton = document.getElementById("facultyAttendance");
const facultyMarksButton = document.getElementById("facultyMarks");

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

    if (action === "attendance") {
        container.textContent =
            "Faculty attendance management requires a faculty-specific attendance API.";
    } else {
        container.textContent =
            "Faculty marks management requires a faculty-specific marks API.";
    }
}

facultyAttendanceButton?.addEventListener("click", () => {
    handleFacultyShortcut("attendance");
});

facultyMarksButton?.addEventListener("click", () => {
    handleFacultyShortcut("marks");
});

/* ---------- Restore existing session ---------- */

async function restoreSession() {
    try {
        const user = await api("/api/auth/me");
        openDashboard(user);
    } catch (_error) {
        closeDashboard("Please sign in to access your academic records.");
    }
}

restoreSession();
