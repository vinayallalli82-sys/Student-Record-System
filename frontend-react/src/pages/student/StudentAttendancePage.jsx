import { useCallback } from "react";
import { studentApi } from "../../api/student.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SemesterSelect from "../../components/common/SemesterSelect.jsx";
import useAdminQuery from "../../hooks/useAdminQuery.js";
import useStudentProfile from "../../hooks/useStudentProfile.js";
import useStudentSemesters from "../../hooks/useStudentSemesters.js";

export default function StudentAttendancePage() {
  const semesterSelection = useStudentSemesters();
  const {
    data: profile,
    error: profileError,
    isLoading: profileLoading,
    reload: reloadProfile,
  } = useStudentProfile(semesterSelection.selectedSemesterId);
  const query = useCallback(async () => {
    if (!semesterSelection.selectedSemesterId) {
      return { semesterId: "", records: [] };
    }
    const records = await studentApi.attendance(semesterSelection.selectedSemesterId);
    if (!Array.isArray(records)) throw new Error("The attendance API returned an unexpected response.");
    return { semesterId: semesterSelection.selectedSemesterId, records };
  }, [semesterSelection.selectedSemesterId]);
  const { data: attendanceData, error, isLoading, reload } = useAdminQuery(query);

  if (semesterSelection.isLoading) return <LoadingState label="Loading your semesters..." />;
  if (semesterSelection.error) {
    return <ErrorState message={semesterSelection.error} onRetry={semesterSelection.reload} />;
  }

  const attendanceMatchesSelection = (
    attendanceData?.semesterId === semesterSelection.selectedSemesterId
  );
  const profileMatchesSelection = (
    profile?.selectedSemesterId === semesterSelection.selectedSemesterId
  );
  const selectedRecords = attendanceMatchesSelection ? attendanceData.records : [];
  const subjects = profile?.subjects || [];
  const present = selectedRecords.filter((record) => record.status === "Present").length;
  const absent = selectedRecords.filter((record) => record.status === "Absent").length;
  const overallPercentage = selectedRecords.length
    ? (present / selectedRecords.length) * 100
    : null;
  const summaries = subjects.map((subject) => {
    const subjectRecords = selectedRecords.filter(
      (record) => record.subject_id === subject.subject_id,
    );
    const subjectPresent = subjectRecords.filter((record) => record.status === "Present").length;
    const subjectAbsent = subjectRecords.filter((record) => record.status === "Absent").length;
    return {
      ...subject,
      present: subjectPresent,
      absent: subjectAbsent,
      total: subjectRecords.length,
      percentage: subjectRecords.length ? (subjectPresent / subjectRecords.length) * 100 : null,
    };
  });

  return (
    <div className="space-y-7">
      <PageHeader
        description="Review your attendance totals and subject-wise summaries for the selected semester."
        eyebrow="STUDENT WORKSPACE"
        title="My attendance"
      />
      <SemesterSelect
        semesters={semesterSelection.semesters}
        value={semesterSelection.selectedSemesterId}
        onChange={semesterSelection.setSelectedSemesterId}
      />
      {profileError ? (
        <ErrorState message={profileError} onRetry={reloadProfile} />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : profileLoading || isLoading || !profileMatchesSelection || !attendanceMatchesSelection ? (
        <LoadingState label="Updating attendance for this semester..." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall attendance</p>
              <p className="mt-3 text-2xl font-semibold text-brand-800">
                {overallPercentage === null ? "—" : `${overallPercentage.toFixed(1)}%`}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present classes</p>
              <p className="mt-3 text-2xl font-semibold text-emerald-700">{present}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent classes</p>
              <p className="mt-3 text-2xl font-semibold text-rose-700">{absent}</p>
            </Card>
          </div>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Subject-wise attendance</h2>
            <DataTable
              columns={[
                { key: "subject_code", label: "Code" },
                { key: "subject_name", label: "Subject" },
                { key: "credits", label: "Credits" },
                { key: "semester_number", label: "Semester" },
                { key: "total", label: "Total classes" },
                { key: "present", label: "Present" },
                { key: "absent", label: "Absent" },
                {
                  key: "percentage",
                  label: "Attendance",
                  render: (item) => item.total ? `${item.percentage.toFixed(1)}%` : "—",
                },
              ]}
              emptyDescription="There are no subjects allocated to you in this semester."
              emptyTitle="No subjects for this semester"
              getRowKey={(item) => item.subject_id}
              rows={summaries}
            />
          </section>
        </>
      )}
    </div>
  );
}
