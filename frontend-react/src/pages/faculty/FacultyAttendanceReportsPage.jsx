import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { facultyApi } from "../../api/faculty.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

function reportCount(value, field) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`The attendance report returned an invalid ${field} count.`);
  }
  return count;
}

export default function FacultyAttendanceReportsPage() {
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [subjectId, setSubjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [reportError, setReportError] = useState("");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const requestId = useRef(0);

  const loadReport = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    if (!subjectId) {
      setReport(null);
      setHistory([]);
      setReportError("");
      setIsLoadingReport(false);
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setReportError("Start date must not be after end date.");
      setReport(null);
      setHistory([]);
      setIsLoadingReport(false);
      return;
    }
    setIsLoadingReport(true);
    setReportError("");
    try {
      const filters = {
        subject_id: subjectId,
        start_date: startDate,
        end_date: endDate,
      };
      const [classReport, records] = await Promise.all([
        facultyApi.classAttendanceReport(filters),
        facultyApi.attendance(filters),
      ]);
      if (!Array.isArray(classReport.students) || !Array.isArray(records)) {
        throw new Error("The attendance report API returned an unexpected response.");
      }
      const students = classReport.students.map((student) => ({
        ...student,
        present: reportCount(student.present, "present"),
        absent: reportCount(student.absent, "absent"),
        total_classes: reportCount(student.total_classes, "total classes"),
      }));
      if (currentRequestId === requestId.current) {
        setReport({ ...classReport, total_students: students.length, students });
        setHistory(records);
      }
    } catch (loadError) {
      if (currentRequestId === requestId.current) {
        setReportError(loadError.message);
        setReport(null);
        setHistory([]);
      }
    } finally {
      if (currentRequestId === requestId.current) setIsLoadingReport(false);
    }
  }, [subjectId, startDate, endDate]);

  const totals = useMemo(() => ({
    enrolled: report?.students.length ?? 0,
    present: (report?.students ?? []).reduce((sum, student) => sum + student.present, 0),
    absent: (report?.students ?? []).reduce((sum, student) => sum + student.absent, 0),
  }), [report]);

  useEffect(() => {
    void loadReport();
  }, [subjectId, loadReport]);

  if (isLoading) return <LoadingState label="Loading assigned subjects..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-7">
      <PageHeader description="Attendance calculations are produced by the existing subject-authorized report endpoint." eyebrow="CLASSROOM" title="Attendance reports" />
      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField id="report-subject" label="Assigned subject" onChange={setSubjectId} options={(subjects || []).map((subject) => ({ value: String(subject.subject_id), label: `${subject.subject_code} · ${subject.subject_name}` }))} required value={subjectId} />
          <div className="space-y-1.5"><label className="block text-sm font-medium text-slate-700" htmlFor="report-start">Start date</label><input className="form-control" id="report-start" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></div>
          <div className="space-y-1.5"><label className="block text-sm font-medium text-slate-700" htmlFor="report-end">End date</label><input className="form-control" id="report-end" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} /></div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Leave dates blank to include the full attendance history for this subject.</p>
      </Card>
      {reportError && <ErrorState message={reportError} onRetry={loadReport} />}
      {isLoadingReport && <LoadingState label="Calculating attendance report..." />}
      {report && !isLoadingReport && <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrolled students</p><p className="mt-3 text-2xl font-semibold">{totals.enrolled}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present records</p><p className="mt-3 text-2xl font-semibold text-emerald-700">{totals.present}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent records</p><p className="mt-3 text-2xl font-semibold text-rose-700">{totals.absent}</p></Card>
        </div>
        <section className="space-y-3">
          <div><h2 className="text-base font-semibold text-slate-900">Student attendance summary</h2><p className="mt-1 text-sm text-slate-500">{report.subject_code} · {report.subject_name}</p></div>
          <DataTable
            columns={[
              { key: "registration_number", label: "Student", render: (student) => <div><p className="font-semibold">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-400">{student.registration_number}</p></div> },
              { key: "present", label: "Present" },
              { key: "absent", label: "Absent" },
              { key: "total_classes", label: "Classes" },
              { key: "attendance_percentage", label: "Attendance", render: (student) => `${student.attendance_percentage}%` },
            ]}
            emptyDescription="No students are enrolled in this subject."
            emptyTitle="No report data"
            getRowKey={(student) => student.student_id}
            rows={report.students}
          />
        </section>
        <section className="space-y-3">
          <div><h2 className="text-base font-semibold text-slate-900">Attendance history</h2><p className="mt-1 text-sm text-slate-500">Individual records within the selected date range.</p></div>
          <DataTable
            columns={[
              { key: "attendance_date", label: "Date" },
              { key: "registration_number", label: "Student", render: (record) => {
                const student = report.students.find((item) => item.student_id === record.student_id);
                return student
                  ? `${student.first_name} ${student.last_name || ""} · ${student.registration_number}`
                  : `Student ${record.student_id}`;
              } },
              { key: "status", label: "Status", render: (record) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "Present" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{record.status}</span> },
            ]}
            emptyDescription="No attendance records match this subject and date range."
            emptyTitle="No attendance history"
            getRowKey={(record) => record.attendance_id}
            rows={history}
          />
        </section>
      </>}
    </div>
  );
}
