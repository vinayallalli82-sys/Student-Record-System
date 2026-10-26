
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type");
  const data = contentType?.includes("application/json")
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

function getAttendancePercentage(subject) {
  return subject.attendance?.percentage ?? null;
}

function formatAttendance(subject) {
  const percentage = getAttendancePercentage(subject);

  return percentage !== null
    ? `${Number(percentage).toFixed(2)}%`
    : "No records yet";
}

function formatPercentage(value) {
  return value !== null && value !== undefined
    ? `${Number(value).toFixed(2)}%`
    : "—";
}

function formatName(student) {
  return (
    [student?.first_name, student?.last_name]
      .filter(Boolean)
      .join(" ") || "Student"
  );
}

function SummaryCard({ label, value, description }) {
  return (
    <div className="summary-card">
      <p>{label}</p>
      <h3>{value ?? "—"}</h3>
      {description && <span>{description}</span>}
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

function DataTable({ headers, children }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function StudentApp() {
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("All");
  const [selectedSemester, setSelectedSemester] = useState("All");


  const loadCsrf = useCallback(async () => {
    const data = await apiRequest("/api/auth/csrf");
    const token = data.csrf_token || data.token;

    if (!token) {
      throw new Error("Could not retrieve the security token. Refresh and try again.");
    }

    setCsrfToken(token);
    return token;
  }, []);

  const loadDashboard = useCallback(async () => {
    setDataError("");

    try {
      const data = await apiRequest("/api/student/dashboard");
      setDashboard(data);
    } catch (error) {
      setDataError(error.message);
    }
  }, []);

  const checkSession = useCallback(async () => {
    setLoading(true);

    try {
      await loadCsrf();

      // /api/auth/me returns user fields directly, not inside { user: ... }.
      const data = await apiRequest("/api/auth/me");
      const currentUser = data.user || data;

      setUser(currentUser);

      if (currentUser.role === "Student") {
        await loadDashboard();
      }
    } catch {
      setUser(null);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [loadCsrf, loadDashboard]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      // Fetch a fresh CSRF token and keep the same session cookies.
      const token = await loadCsrf();

      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        headers: {
          "X-CSRFToken": token,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const loggedInUser = data.user || data;

      setUser(loggedInUser);
      setPassword("");

      if (loggedInUser.role === "Student") {
        await loadDashboard();
      }
    } catch (error) {
      setLoginError(error.message || "Login failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    try {
      const token = await loadCsrf();

      await apiRequest("/api/auth/logout", {
        method: "POST",
        headers: {
          "X-CSRFToken": token,
        },
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setUser(null);
      setDashboard(null);
      setPage("Dashboard");
      setEmail("");
      setPassword("");
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <p>Loading CampusConnect...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>CampusConnect</h1>
          <p>Sign in to access your student portal.</p>

          {loginError && (
            <div className="error-message">{loginError}</div>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            className="login-button"
            disabled={loginLoading}
          >
            {loginLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  const student = dashboard?.student || {};
  const summary = dashboard?.summary || {};
  const subjects = dashboard?.subjects || [];
  const marks = dashboard?.marks || [];

  const navItems = [
    { label: "Dashboard", icon: "⌂" },
    { label: "Attendance", icon: "◷" },
    { label: "Marks", icon: "▤" },
    { label: "Subjects", icon: "▣" },
    { label: "Academic Reports", icon: "▥" },
    { label: "My Profile", icon: "♙" },
  ];

  function renderDashboard() {
    return (
      <>
        <h1>Dashboard</h1>

        <section className="content-card">
          <h2>
            Welcome back, {student.first_name || user.first_name || "Student"}!
          </h2>
          <p className="muted">
            Here is an overview of your academic information.
          </p>

          <div className="summary-grid">
            {/* Overall Attendance intentionally removed. */}

            <SummaryCard
              label="Enrolled Subjects"
              value={summary.subject_count ?? subjects.length}
            />
            <SummaryCard
              label="Assessments"
              value={summary.assessment_count ?? marks.length}
            />
          </div>
        </section>

        <section className="content-card">
          <h2>Subject Progress</h2>
          <p className="muted">Your attendance by subject.</p>

          {subjects.length === 0 ? (
            <EmptyState message="No subjects are assigned to your account yet." />
          ) : (
            <DataTable
              headers={[
                "Subject Code",
                "Subject",
                "Classes Attended",
                "Total Classes",
                "Attendance",
              ]}
            >
              {subjects.map((subject) => (
                <tr key={subject.subject_id}>
                  <td>{subject.subject_code}</td>
                  <td>{subject.subject_name}</td>
                  <td>{subject.attendance?.classes_attended ?? 0}</td>
                  <td>{subject.attendance?.total_classes ?? 0}</td>
                  <td>{formatAttendance(subject)}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <section className="content-card">
          <h2>Account Information</h2>
          <div className="profile-details-grid">
            <div>
              <span>Student Name</span>
              <strong>{formatName(student)}</strong>
            </div>
            <div>
              <span>Registration Number</span>
              <strong>{student.registration_number || "—"}</strong>
            </div>
            <div>
              <span>Course</span>
              <strong>{student.course || "—"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{student.email || user.email || "—"}</strong>
            </div>
          </div>
        </section>
      </>
    );
  }


function renderAttendance() {
  const semesters = [
    ...new Set(
      subjects
        .map((subject) => subject.semester_number)
        .filter((semester) => semester !== null && semester !== undefined)
    ),
  ].sort((a, b) => a - b);

  const filteredSubjects =
    selectedSemester === "All"
      ? subjects
      : subjects.filter(
          (subject) => String(subject.semester_number) === selectedSemester
        );

  return (
    <>
      <h1>Attendance</h1>

      <section className="content-card">
        <h2>Attendance</h2>
        <p className="muted">View attendance semester-wise.</p>

        <div className="assessment-filter">
          <label htmlFor="attendanceSemester">Select Semester</label>
          <select
            id="attendanceSemester"
            value={selectedSemester}
            onChange={(event) => setSelectedSemester(event.target.value)}
          >
            <option value="All">All Semesters</option>
            {semesters.map((semester) => (
              <option key={semester} value={String(semester)}>
                Semester {semester}
              </option>
            ))}
          </select>
        </div>

        {filteredSubjects.length === 0 ? (
          <EmptyState message="No subjects found for this semester." />
        ) : (
          <DataTable
            headers={[
              "Subject Code",
              "Subject",
              "Classes Attended",
              "Total Classes",
              "Attendance",
            ]}
          >
            {filteredSubjects.map((subject) => (
              <tr key={subject.subject_id}>
                <td>{subject.subject_code}</td>
                <td>{subject.subject_name}</td>
                <td>{subject.attendance?.classes_attended ?? 0}</td>
                <td>{subject.attendance?.total_classes ?? 0}</td>
                <td>{formatAttendance(subject)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}



function renderMarks() {
  const semesters = [
    ...new Set(
      subjects
        .map((subject) => subject.semester_number)
        .filter((semester) => semester !== null && semester !== undefined)
    ),
  ].sort((a, b) => a - b);

  const [unused] = [null]; // No additional state is required here.

  const subjectIdsForSemester =
    selectedSemester === "All"
      ? subjects.map((subject) => subject.subject_id)
      : subjects
          .filter(
            (subject) => String(subject.semester_number) === selectedSemester
          )
          .map((subject) => subject.subject_id);

  const filteredMarks = marks.filter((mark) => {
    const matchesSemester = subjectIdsForSemester.includes(mark.subject_id);
    const matchesAssessment =
      assessmentFilter === "All" ||
      mark.assessment_name.toLowerCase() === assessmentFilter.toLowerCase();

    return matchesSemester && matchesAssessment;
  });

  return (
    <>
      <h1>Marks</h1>

      <section className="content-card">
        <h2>Assessment Results</h2>
        <p className="muted">
          View your marks by semester and assessment.
        </p>

        <div className="assessment-filter">
          <label htmlFor="marksSemester">Select Semester</label>
          <select
            id="marksSemester"
            value={selectedSemester}
            onChange={(event) => setSelectedSemester(event.target.value)}
          >
            <option value="All">All Semesters</option>
            {semesters.map((semester) => (
              <option key={semester} value={String(semester)}>
                Semester {semester}
              </option>
            ))}
          </select>
        </div>

        <div className="assessment-filter">
          <label htmlFor="marksAssessment">Select Assessment</label>
          <select
            id="marksAssessment"
            value={assessmentFilter}
            onChange={(event) => setAssessmentFilter(event.target.value)}
          >
            <option value="All">All Assessments</option>
            <option value="ISA 1">ISA 1</option>
            <option value="ISA 2">ISA 2</option>
            <option value="ESA">ESA</option>
          </select>
        </div>

        {filteredMarks.length === 0 ? (
          <EmptyState message="No marks found for the selected semester and assessment." />
        ) : (
          <DataTable
            headers={[
              "Subject Code",
              "Subject",
              "Assessment",
              "Marks Obtained",
              "Maximum Marks",
              "Percentage",
            ]}
          >
            {filteredMarks.map((mark) => (
              <tr key={mark.mark_id}>
                <td>{mark.subject_code}</td>
                <td>{mark.subject_name}</td>
                <td>{mark.assessment_name}</td>
                <td>{mark.marks_obtained}</td>
                <td>{mark.max_marks}</td>
                <td>{formatPercentage(mark.percentage)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}




function renderSubjects() {
  const semesters = [
    ...new Set(
      subjects.map((subject) => subject.semester_number).filter(
        (semester) => semester !== null && semester !== undefined
      )
    ),
  ].sort((a, b) => a - b);

  const filteredSubjects =
    selectedSemester === "All"
      ? subjects
      : subjects.filter(
          (subject) =>
            String(subject.semester_number) === selectedSemester
        );

  return (
    <>
      <h1>Subjects</h1>

      <section className="content-card">
        <h2>My Subjects</h2>
        <p className="muted">
          View your subjects semester-wise.
        </p>

        <div className="assessment-filter">
          <label htmlFor="semesterFilter">Select Semester</label>
          <select
            id="semesterFilter"
            value={selectedSemester}
            onChange={(event) => setSelectedSemester(event.target.value)}
          >
            <option value="All">All Semesters</option>
            {semesters.map((semester) => (
              <option key={semester} value={String(semester)}>
                Semester {semester}
              </option>
            ))}
          </select>
        </div>

        {filteredSubjects.length === 0 ? (
          <EmptyState message="No subjects found for this semester." />
        ) : (
          <DataTable
            headers={[
              "Subject Code",
              "Subject Name",
              "Semester",
              "Credits",
              "Attendance",
              "Assessments",
            ]}
          >
            {filteredSubjects.map((subject) => (
              <tr key={subject.subject_id}>
                <td>{subject.subject_code}</td>
                <td>{subject.subject_name}</td>
                <td>{subject.semester_number}</td>
                <td>{subject.credits ?? "—"}</td>
                <td>{formatAttendance(subject)}</td>
                <td>{subject.assessment_count ?? 0}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </>
  );
}



function renderReports() {
  const semesters = [
    ...new Set(
      subjects
        .map((subject) => subject.semester_number)
        .filter((semester) => semester !== null && semester !== undefined)
    ),
  ].sort((a, b) => a - b);

  const reportSubjects =
    selectedSemester === "All"
      ? subjects
      : subjects.filter(
          (subject) =>
            String(subject.semester_number) === selectedSemester
        );

  const reportSubjectIds = reportSubjects.map(
    (subject) => subject.subject_id
  );

  const reportMarks = marks.filter((mark) =>
    reportSubjectIds.includes(mark.subject_id)
  );

  const totalObtained = reportMarks.reduce(
    (sum, mark) => sum + Number(mark.marks_obtained || 0),
    0
  );

  const totalMaximum = reportMarks.reduce(
    (sum, mark) => sum + Number(mark.max_marks || 0),
    0
  );

  const overallPercentage =
    totalMaximum > 0
      ? (totalObtained / totalMaximum) * 100
      : null;

  const subjectPerformance = reportSubjects.map((subject) => {
    const subjectMarks = reportMarks.filter(
      (mark) => mark.subject_id === subject.subject_id
    );

    const obtained = subjectMarks.reduce(
      (sum, mark) => sum + Number(mark.marks_obtained || 0),
      0
    );

    const maximum = subjectMarks.reduce(
      (sum, mark) => sum + Number(mark.max_marks || 0),
      0
    );

    return {
      ...subject,
      obtained,
      maximum,
      percentage:
        maximum > 0 ? (obtained / maximum) * 100 : null,
      recordedAssessments: subjectMarks.length,
      assessmentNames: subjectMarks.map((mark) =>
        mark.assessment_name.trim().toLowerCase()
      ),
    };
  });

  const assessedSubjects = subjectPerformance.filter(
    (subject) => subject.maximum > 0
  );

  const rankedSubjects = [...assessedSubjects].sort(
    (a, b) => b.percentage - a.percentage
  );

  const highestSubject = rankedSubjects[0];
  const lowestSubject = rankedSubjects[rankedSubjects.length - 1];

  const assessmentTypes = [
    { label: "ISA 1", key: "isa 1" },
    { label: "ISA 2", key: "isa 2" },
    { label: "ESA", key: "esa" },
  ];

  const assessmentTrend = assessmentTypes.map((assessment) => {
    const assessmentMarks = reportMarks.filter(
      (mark) =>
        mark.assessment_name.trim().toLowerCase() === assessment.key
    );

    const obtained = assessmentMarks.reduce(
      (sum, mark) => sum + Number(mark.marks_obtained || 0),
      0
    );

    const maximum = assessmentMarks.reduce(
      (sum, mark) => sum + Number(mark.max_marks || 0),
      0
    );

    return {
      ...assessment,
      count: assessmentMarks.length,
      percentage:
        maximum > 0 ? (obtained / maximum) * 100 : null,
    };
  });

  const missingAssessments = subjectPerformance.map((subject) => {
    const missing = assessmentTypes
      .filter(
        (assessment) =>
          !subject.assessmentNames.includes(assessment.key)
      )
      .map((assessment) => assessment.label);

    return { ...subject, missing };
  }).filter((subject) => subject.missing.length > 0);

  const formatMarks = (value) =>
    Number(value).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

  const formatReportPercentage = (value) =>
    value === null || value === undefined
      ? "—"
      : `${value.toFixed(2)}%`;

  return (
    <>
      <h1>Academic Reports</h1>

      <section className="content-card report-no-print">
        <div className="report-heading-row">
          <div>
            <h2>Semester Performance Analysis</h2>
            <p className="muted">
              Understand your academic performance and identify
              opportunities to improve.
            </p>
          </div>

          <button
            type="button"
            className="report-download-button"
            onClick={() => window.print()}
          >
            Download / Print PDF
          </button>
        </div>

        <div className="assessment-filter">
          <label htmlFor="reportSemester">
            Select Semester
          </label>

          <select
            id="reportSemester"
            value={selectedSemester}
            onChange={(event) =>
              setSelectedSemester(event.target.value)
            }
          >
            <option value="All">All Semesters</option>

            {semesters.map((semester) => (
              <option key={semester} value={String(semester)}>
                Semester {semester}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="content-card">
        <h2>Performance Overview</h2>
        <p className="muted">
          Based on assessments currently recorded in the system.
        </p>

        <div className="summary-grid report-summary-grid">
          <SummaryCard
            label="Subjects Assessed"
            value={`${assessedSubjects.length} / ${reportSubjects.length}`}
          />

          <SummaryCard
            label="Total Marks Obtained"
            value={formatMarks(totalObtained)}
          />

          <SummaryCard
            label="Maximum Marks Recorded"
            value={formatMarks(totalMaximum)}
          />

          <SummaryCard
            label="Overall Percentage"
            value={formatReportPercentage(overallPercentage)}
          />
        </div>

        <p className="report-note">
          Percentages use only recorded assessments. Subjects or
          assessments without marks are not treated as zero marks.
        </p>
      </section>

      <section className="content-card">
        <h2>Subject Performance Comparison</h2>
        <p className="muted">
          Compare percentages calculated from each subject's recorded marks.
        </p>

        {assessedSubjects.length === 0 ? (
          <EmptyState message="No assessment marks are available for this semester yet." />
        ) : (
          <div className="report-chart">
            {subjectPerformance.map((subject) => (
              <div
                className="report-chart-row"
                key={subject.subject_id}
              >
                <div className="report-chart-label">
                  <strong>{subject.subject_code}</strong>
                  <span>{subject.subject_name}</span>
                </div>

                <div
                  className="report-chart-track"
                  role="img"
                  aria-label={`${subject.subject_code}: ${formatReportPercentage(subject.percentage)}`}
                >
                  <div
                    className="report-chart-bar"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(subject.percentage ?? 0, 100)
                      )}%`,
                    }}
                  />
                </div>

                <strong className="report-chart-value">
                  {formatReportPercentage(subject.percentage)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="content-card">
        <h2>Assessment Performance Trend</h2>
        <p className="muted">
          Compare recorded ISA 1, ISA 2 and ESA results.
        </p>

        <div className="report-trend-grid">
          {assessmentTrend.map((assessment) => (
            <div
              className="report-trend-card"
              key={assessment.key}
            >
              <span>{assessment.label}</span>

              <strong>
                {formatReportPercentage(assessment.percentage)}
              </strong>

              <small>
                {assessment.count} recorded{" "}
                {assessment.count === 1 ? "result" : "results"}
              </small>
            </div>
          ))}
        </div>

        <p className="report-note">
          Each percentage is calculated from the marks and maximum
          marks recorded for that assessment type. Compare only
          assessments with comparable maximum marks.
        </p>
      </section>

      <section className="content-card">
        <h2>Subject Performance Summary</h2>

        {reportSubjects.length === 0 ? (
          <EmptyState message="No subjects are assigned to this semester." />
        ) : (
          <DataTable
            headers={[
              "Subject Code",
              "Subject",
              "Marks Obtained",
              "Maximum Marks",
              "Percentage",
              "Assessments",
            ]}
          >
            {subjectPerformance.map((subject) => (
              <tr key={subject.subject_id}>
                <td>{subject.subject_code}</td>
                <td>{subject.subject_name}</td>
                <td>
                  {subject.recordedAssessments > 0
                    ? formatMarks(subject.obtained)
                    : "—"}
                </td>
                <td>
                  {subject.recordedAssessments > 0
                    ? formatMarks(subject.maximum)
                    : "—"}
                </td>
                <td>
                  {formatReportPercentage(subject.percentage)}
                </td>
                <td>{subject.recordedAssessments}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section className="content-card">
        <h2>Performance Insights</h2>

        {assessedSubjects.length === 0 ? (
          <EmptyState message="Insights will appear when marks are recorded." />
        ) : (
          <div className="report-insights">
            {highestSubject && (
              <div className="report-insight">
                <span className="report-insight-label">
                  Highest-performing subject
                </span>
                <strong>
                  {highestSubject.subject_code} —{" "}
                  {highestSubject.subject_name}
                </strong>
                <p>
                  {formatReportPercentage(highestSubject.percentage)}
                  {" "}across recorded assessments.
                </p>
              </div>
            )}

            {lowestSubject && (
              <div className="report-insight">
                <span className="report-insight-label">
                  Subject to focus on
                </span>
                <strong>
                  {lowestSubject.subject_code} —{" "}
                  {lowestSubject.subject_name}
                </strong>
                <p>
                  {formatReportPercentage(lowestSubject.percentage)}
                  {" "}across recorded assessments.
                </p>
              </div>
            )}

            <div className="report-insight">
              <span className="report-insight-label">
                Missing assessment records
              </span>
              <strong>
                {missingAssessments.length}{" "}
                {missingAssessments.length === 1
                  ? "subject"
                  : "subjects"}
              </strong>
              <p>
                {missingAssessments.length === 0
                  ? "All three assessment types have records for every subject."
                  : missingAssessments
                      .map(
                        (subject) =>
                          `${subject.subject_code}: ${subject.missing.join(", ")}`
                      )
                      .join(" • ")}
              </p>
            </div>
          </div>
        )}
      </section>

      <p className="report-footer">
        Academic report generated on {new Date().toLocaleDateString()}.
        Results reflect records currently available in CampusConnect.
      </p>
    </>
  );
}




  function renderProfile() {
    return (
      <>
        <h1>My Profile</h1>

        <section className="content-card">
          <h2>Student Information</h2>
          <p className="muted">Your registered account details.</p>

          <div className="profile-details-grid">
            <div>
              <span>Full Name</span>
              <strong>{formatName(student)}</strong>
            </div>
            <div>
              <span>Email Address</span>
              <strong>{student.email || user.email || "—"}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user.role || "Student"}</strong>
            </div>
            <div>
              <span>Registration Number</span>
              <strong>{student.registration_number || "—"}</strong>
            </div>
            <div>
              <span>Course</span>
              <strong>{student.course || "—"}</strong>
            </div>
            <div>
              <span>Admission Year</span>
              <strong>{student.admission_year || "—"}</strong>
            </div>
            <div>
              <span>Account Status</span>
              <strong className="active-text">
                {user.is_active === false || user.is_active === 0
                  ? "Inactive"
                  : "Active"}
              </strong>
            </div>
          </div>
        </section>
      </>
    );
  }

  const pageRenderers = {
    Dashboard: renderDashboard,
    Attendance: renderAttendance,
    Marks: renderMarks,
    Subjects: renderSubjects,
    "Academic Reports": renderReports,
    "My Profile": renderProfile,
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">C</div>
          <div>
            <h2>CampusConnect</h2>
            <span>Student Portal</span>
          </div>
        </div>

        <p className="sidebar-label">MENU</p>

        <nav>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`nav-button ${page === item.label ? "active" : ""}`}
              onClick={() => setPage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-card">
            <strong>Secure Portal</strong>
            <p>Your academic information in one place.</p>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <span>↪</span> Sign Out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-subtitle">STUDENT PORTAL</span>
          </div>

          <div className="user-chip">
            <div className="avatar">
              {(student.first_name || user.first_name || "S")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <strong>
                {student.first_name || user.first_name || "Student"}
              </strong>
              <span>{user.role || "Student"}</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          {dataError && (
            <div className="error-message">
              {dataError}
              <button type="button" onClick={loadDashboard}>
                Retry
              </button>
            </div>
          )}

          {(pageRenderers[page] || renderDashboard)()}
        </div>
      </main>
    </div>
  );
}

export default StudentApp;
