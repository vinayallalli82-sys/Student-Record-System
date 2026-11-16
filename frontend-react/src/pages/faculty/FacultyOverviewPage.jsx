import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, GraduationCap, NotebookPen, Users } from "lucide-react";
import { facultyApi } from "../../api/faculty.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

export default function FacultyOverviewPage() {
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [records, setRecords] = useState(null);
  const [recordsError, setRecordsError] = useState("");
  const [recordsRevision, setRecordsRevision] = useState(0);

  useEffect(() => {
    if (!subjects) return undefined;
    let active = true;
    setRecords(null);
    setRecordsError("");
    Promise.all([facultyApi.attendance(), facultyApi.marks()])
      .then(([attendance, marks]) => {
        if (!Array.isArray(attendance) || !Array.isArray(marks)) {
          throw new Error("An academic records API returned an unexpected response.");
        }
        if (active) setRecords({ attendance, marks });
      })
      .catch((loadError) => {
        if (active) setRecordsError(loadError.message);
      });
    return () => { active = false; };
  }, [subjects, recordsRevision]);

  const studentCount = useMemo(
    () => new Set((subjects || []).flatMap((subject) => subject.students.map((student) => student.student_id))).size,
    [subjects],
  );
  const attendanceTotals = useMemo(() => {
    const data = records?.attendance || [];
    return {
      present: data.filter((item) => item.status === "Present").length,
      absent: data.filter((item) => item.status === "Absent").length,
    };
  }, [records]);
  const averageMarkPercent = useMemo(() => {
    const marks = records?.marks || [];
    if (!marks.length) return null;
    return marks.reduce((sum, item) => sum + (item.marks_obtained / item.max_marks) * 100, 0) / marks.length;
  }, [records]);
  const recentMarks = useMemo(
    () => [...(records?.marks || [])]
      .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
      .slice(0, 5),
    [records],
  );

  if (isLoading) return <LoadingState label="Loading your assigned subjects..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const metrics = [
    { label: "Assigned subjects", value: subjects.length, icon: NotebookPen, tone: "bg-blue-50 text-blue-700" },
    { label: "Enrolled students", value: studentCount, icon: GraduationCap, tone: "bg-violet-50 text-violet-700" },
    { label: "Attendance records", value: records ? records.attendance.length : "—", icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Marks entered", value: records ? records.marks.length : "—", icon: Users, tone: "bg-amber-50 text-amber-700" },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        description="A live snapshot of your assigned teaching workload and available academic records."
        eyebrow="FACULTY WORKSPACE"
        title="Teaching overview"
      />
      {recordsError && <ErrorState message={recordsError} onRetry={() => setRecordsRevision((value) => value + 1)} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <span className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon aria-hidden="true" size={19} /></span>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm text-slate-500">{label}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recently updated marks</h2>
            <p className="mt-1 text-sm text-slate-500">Most recently available mark records for your assigned subjects.</p>
          </div>
          {!records && !recordsError
            ? <LoadingState label="Loading academic records..." />
            : <DataTable
                columns={[
                  { key: "registration_number", label: "Student" },
                  { key: "subject_code", label: "Subject" },
                  { key: "assessment_name", label: "Assessment" },
                  { key: "score", label: "Score", render: (item) => `${item.marks_obtained} / ${item.max_marks}` },
                  { key: "updated_at", label: "Updated", render: (item) => item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "—" },
                ]}
                emptyDescription="Marks entered for your assigned subjects will appear here."
                emptyTitle="No marks available"
                getRowKey={(item) => item.mark_id}
                rows={recentMarks}
              />}
        </section>
        <Card>
          <h2 className="font-semibold text-slate-900">Attendance overview</h2>
          <p className="mt-1 text-sm text-slate-500">Totals from authorized attendance records.</p>
          {!records && !recordsError ? (
            <div className="grid min-h-36 place-items-center"><p className="text-sm text-slate-500">Loading attendance...</p></div>
          ) : records ? (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700">Present</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-900">{attendanceTotals.present}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-4">
                <p className="text-xs font-semibold text-rose-700">Absent</p>
                <p className="mt-2 text-2xl font-semibold text-rose-900">{attendanceTotals.absent}</p>
              </div>
              <div className="col-span-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                Marks average: {averageMarkPercent === null ? "No marks available" : `${averageMarkPercent.toFixed(1)}% of assessment maximum`}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
