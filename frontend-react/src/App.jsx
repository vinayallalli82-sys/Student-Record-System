import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/useAuth.js";
import AppLayout from "./components/layout/AppLayout.jsx";
import Spinner from "./components/common/Spinner.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import RoleLandingRedirect from "./routes/RoleLandingRedirect.jsx";
import AdminDashboardLayout from "./pages/admin/AdminDashboardLayout.jsx";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage.jsx";
import UsersPage from "./pages/admin/UsersPage.jsx";
import StudentsPage from "./pages/admin/StudentsPage.jsx";
import SubjectsPage from "./pages/admin/SubjectsPage.jsx";
import FacultyAssignmentsPage from "./pages/admin/FacultyAssignmentsPage.jsx";
import StudentAllocationsPage from "./pages/admin/StudentAllocationsPage.jsx";
import SemestersPage from "./pages/admin/SemestersPage.jsx";
import FacultyDashboardLayout from "./pages/faculty/FacultyDashboardLayout.jsx";
import FacultyOverviewPage from "./pages/faculty/FacultyOverviewPage.jsx";
import FacultySubjectsPage from "./pages/faculty/FacultySubjectsPage.jsx";
import FacultyStudentsPage from "./pages/faculty/FacultyStudentsPage.jsx";
import FacultyAttendancePage from "./pages/faculty/FacultyAttendancePage.jsx";
import FacultyAttendanceReportsPage from "./pages/faculty/FacultyAttendanceReportsPage.jsx";
import FacultyMarksPage from "./pages/faculty/FacultyMarksPage.jsx";
import FacultyMarksSummaryPage from "./pages/faculty/FacultyMarksSummaryPage.jsx";
import StudentDashboardLayout from "./pages/student/StudentDashboardLayout.jsx";
import StudentOverviewPage from "./pages/student/StudentOverviewPage.jsx";
import StudentProfilePage from "./pages/student/StudentProfilePage.jsx";
import StudentSubjectsPage from "./pages/student/StudentSubjectsPage.jsx";
import StudentAttendancePage from "./pages/student/StudentAttendancePage.jsx";
import StudentAcademicRecordsPage from "./pages/student/StudentAcademicRecordsPage.jsx";
import StudentGpaPage from "./pages/student/StudentGpaPage.jsx";
import StudentNotificationsPage from "./pages/student/StudentNotificationsPage.jsx";
import StudentReportsPage from "./pages/student/StudentReportsPage.jsx";

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <Spinner label="Restoring your session" />
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<RoleLandingRedirect />} />
          <Route element={<ProtectedRoute allowedRoles={["Administrator"]} />}>
            <Route path="/admin" element={<AdminDashboardLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="faculty-assignments" element={<FacultyAssignmentsPage />} />
              <Route path="student-allocations" element={<StudentAllocationsPage />} />
              <Route path="semesters" element={<SemestersPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["Faculty"]} />}>
            <Route path="/faculty" element={<FacultyDashboardLayout />}>
              <Route index element={<FacultyOverviewPage />} />
              <Route path="subjects" element={<FacultySubjectsPage />} />
              <Route path="students" element={<FacultyStudentsPage />} />
              <Route path="attendance" element={<FacultyAttendancePage />} />
              <Route path="attendance-reports" element={<FacultyAttendanceReportsPage />} />
              <Route path="marks" element={<FacultyMarksPage />} />
              <Route path="marks-summary" element={<FacultyMarksSummaryPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["Student"]} />}>
            <Route path="/student" element={<StudentDashboardLayout />}>
              <Route index element={<StudentOverviewPage />} />
              <Route path="profile" element={<StudentProfilePage />} />
              <Route path="subjects" element={<StudentSubjectsPage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="academic-records" element={<StudentAcademicRecordsPage />} />
              <Route path="gpa" element={<StudentGpaPage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
              <Route path="reports" element={<StudentReportsPage />} />
            </Route>
          </Route>
          <Route path="/unauthorized" element={<NotFoundPage unauthorized />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
