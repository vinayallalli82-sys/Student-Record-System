import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Save, Users, X } from "lucide-react";
import { facultyApi } from "../../api/faculty.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function studentKey(studentId) {
  return String(studentId);
}

export default function FacultyAttendancePage() {
  const { setNotice } = useAuth();
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(localDate);
  const [roster, setRoster] = useState([]);
  const [records, setRecords] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loadError, setLoadError] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState(null);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedSubject = useMemo(
    () => (subjects || []).find((subject) => String(subject.subject_id) === subjectId),
    [subjects, subjectId],
  );
  const recordByStudentId = useMemo(
    () => new Map(records.map((record) => [studentKey(record.student_id), record])),
    [records],
  );
  const counts = useMemo(() => {
    const present = roster.filter((student) => statuses[studentKey(student.student_id)] === "Present").length;
    const absent = roster.filter((student) => statuses[studentKey(student.student_id)] === "Absent").length;
    return { total: roster.length, present, absent };
  }, [roster, statuses]);
  const pendingChanges = useMemo(() => roster.reduce(
    (changes, student) => {
      const currentStatus = statuses[studentKey(student.student_id)];
      const existing = recordByStudentId.get(studentKey(student.student_id));
      if (!existing) changes.create += 1;
      else if (existing.status !== currentStatus) changes.update += 1;
      return changes;
    },
    { create: 0, update: 0 },
  ), [recordByStudentId, roster, statuses]);

  const loadRoster = useCallback(async () => {
    if (!subjectId || !date) {
      setRoster([]);
      setRecords([]);
      setStatuses({});
      setSubmissionMessage(null);
      return true;
    }

    setIsLoadingRoster(true);
    setLoadError("");
    setSubmissionMessage(null);
    try {
      const [students, attendance] = await Promise.all([
        facultyApi.subjectStudents(subjectId, date),
        facultyApi.attendance({ subject_id: subjectId, date }),
      ]);
      if (!Array.isArray(students) || !Array.isArray(attendance)) {
        throw new Error("The attendance API returned an unexpected response.");
      }

      const attendanceByStudent = new Map(
        attendance.map((record) => [studentKey(record.student_id), record]),
      );
      const unmatchedSavedStatus = students.find((student) => {
        const status = student.attendance_status;
        return (status === "Present" || status === "Absent")
          && !attendanceByStudent.has(studentKey(student.student_id));
      });
      if (unmatchedSavedStatus) {
        throw new Error(`Saved attendance for ${unmatchedSavedStatus.registration_number} could not be matched to its record. Reload the attendance list before submitting.`);
      }

      setRoster(students);
      setRecords(attendance);
      setStatuses(Object.fromEntries(students.map((student) => {
        const key = studentKey(student.student_id);
        const existing = attendanceByStudent.get(key);
        const savedStatus = existing?.status ?? student.attendance_status;
        return [key, savedStatus === "Present" || savedStatus === "Absent" ? savedStatus : "Present"];
      })));
      return true;
    } catch (requestError) {
      setLoadError(requestError.message);
      setRoster([]);
      setRecords([]);
      setStatuses({});
      return false;
    } finally {
      setIsLoadingRoster(false);
    }
  }, [subjectId, date]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  function toggleStatus(studentId) {
    const key = studentKey(studentId);
    setStatuses((current) => ({
      ...current,
      [key]: current[key] === "Present" ? "Absent" : "Present",
    }));
    setSubmissionMessage(null);
  }

  function requestSubmit() {
    if (roster.some((student) => !["Present", "Absent"].includes(statuses[studentKey(student.student_id)]))) {
      const message = "Set every student's status to Present or Absent before submitting.";
      setSubmissionMessage({ type: "error", text: message });
      setNotice({ type: "error", message });
      return;
    }
    setSubmissionMessage(null);
    setConfirmOpen(true);
  }

  async function submitAttendance() {
    setIsSubmitting(true);
    const failures = [];
    let savedCount = 0;

    try {
      for (const student of roster) {
        const key = studentKey(student.student_id);
        const status = statuses[key];
        const existing = recordByStudentId.get(key);
        if (existing?.status === status) continue;

        try {
          if (existing) {
            await facultyApi.updateAttendance(existing.attendance_id, status);
          } else {
            await facultyApi.saveAttendance({
              student_id: student.student_id,
              subject_id: Number(subjectId),
              attendance_date: date,
              status,
            });
          }
          savedCount += 1;
        } catch (saveError) {
          failures.push({
            name: `${student.first_name} ${student.last_name}`.trim() || student.registration_number,
            message: saveError.message,
          });
        }
      }

      const refreshed = await loadRoster();
      if (failures.length > 0) {
        const details = failures
          .slice(0, 3)
          .map((failure) => `${failure.name}: ${failure.message}`)
          .join("; ");
        const remaining = failures.length > 3 ? `; and ${failures.length - 3} more` : "";
        const refreshNote = refreshed ? "" : " Attendance data could not be refreshed; reload before verifying.";
        const message = `Attendance was saved for ${savedCount} student${savedCount === 1 ? "" : "s"}, but ${failures.length} failed. ${details}${remaining}.${refreshNote}`;
        setSubmissionMessage({ type: "error", text: message });
        setNotice({ type: "error", message });
      } else if (!refreshed) {
        const message = "Attendance requests completed, but the saved data could not be refreshed. Reload the attendance list before continuing.";
        setSubmissionMessage({ type: "error", text: message });
        setNotice({ type: "error", message });
      } else {
        const message = savedCount
          ? `Attendance submitted for ${savedCount} student${savedCount === 1 ? "" : "s"}.`
          : "Attendance is up to date; no records needed changes.";
        setSubmissionMessage({ type: "success", text: message });
        setNotice({ type: "success", message });
      }
    } catch (submitError) {
      setSubmissionMessage({ type: "error", text: submitError.message });
      setNotice({ type: "error", message: submitError.message });
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  }

  if (isLoading) return <LoadingState label="Loading assigned subjects..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const columns = [
    {
      key: "registration_number",
      label: "Student",
      render: (student) => (
        <div>
          <p className="font-semibold text-slate-800">{student.first_name} {student.last_name}</p>
          <p className="text-xs text-slate-400">{student.registration_number}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Attendance status",
      render: (student) => {
        const status = statuses[studentKey(student.student_id)];
        const isPresent = status === "Present";
        const StatusIcon = isPresent ? Check : X;
        return (
          <button
            aria-label={`${student.first_name} ${student.last_name}: ${status}. Double-click or press Enter to toggle.`}
            aria-pressed={isPresent}
            className={`inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 ${
              isPresent
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus-visible:ring-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 focus-visible:ring-rose-100"
            }`}
            onDoubleClick={() => toggleStatus(student.student_id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleStatus(student.student_id);
              }
            }}
            disabled={isSubmitting}
            title="Double-click or focus and press Enter to toggle attendance"
            type="button"
          >
            <StatusIcon aria-hidden="true" size={18} strokeWidth={3} />
            {status}
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        description="Set attendance for all enrolled students, then submit the class record in one step."
        eyebrow="CLASSROOM"
        title="Attendance"
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="attendance-subject"
            label="Assigned subject"
            onChange={(value) => {
              setSubjectId(value);
              setSubmissionMessage(null);
            }}
            disabled={isSubmitting}
            options={(subjects || []).map((subject) => ({
              value: String(subject.subject_id),
              label: `${subject.subject_code} · ${subject.subject_name}`,
            }))}
            required
            value={subjectId}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="attendance-date">Attendance date</label>
            <input
              className="form-control"
              id="attendance-date"
              onChange={(event) => {
                setDate(event.target.value);
                setSubmissionMessage(null);
              }}
              disabled={isSubmitting}
              required
              type="date"
              value={date}
            />
          </div>
        </div>
        {selectedSubject && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {selectedSubject.subject_code} · {selectedSubject.students.length} enrolled students
          </p>
        )}
      </Card>

      {loadError && <ErrorState message={loadError} onRetry={loadRoster} />}
      {!loadError && isLoadingRoster && <LoadingState label="Loading enrolled students and saved attendance..." />}
      {!loadError && !isLoadingRoster && subjectId && (
        <>
          <div aria-live="polite" className="grid gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Users aria-hidden="true" size={20} /></span>
              <div><p className="text-2xl font-semibold text-slate-950">{counts.total}</p><p className="text-sm text-slate-500">Total students</p></div>
            </Card>
            <Card className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check aria-hidden="true" size={20} strokeWidth={3} /></span>
              <div><p className="text-2xl font-semibold text-slate-950">{counts.present}</p><p className="text-sm text-slate-500">Present</p></div>
            </Card>
            <Card className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-700"><X aria-hidden="true" size={20} strokeWidth={3} /></span>
              <div><p className="text-2xl font-semibold text-slate-950">{counts.absent}</p><p className="text-sm text-slate-500">Absent</p></div>
            </Card>
          </div>

          <section aria-label="Enrolled student attendance" className="space-y-4">
            <DataTable
              columns={columns}
              emptyDescription="Choose a subject with enrolled students."
              emptyTitle="No enrolled students"
              getRowKey={(student) => student.student_id}
              rows={roster}
            />
            {submissionMessage && (
              <Card
                aria-live="polite"
                className={submissionMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900"}
                role="status"
              >
                <p className="text-sm font-medium">{submissionMessage.text}</p>
              </Card>
            )}
            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-500">
                Double-click a status to toggle it. New records start as Present; existing saved statuses are preserved.
              </p>
              <Button
                className="shrink-0"
                disabled={isSubmitting || isLoadingRoster || roster.length === 0}
                onClick={requestSubmit}
              >
                <Save aria-hidden="true" size={16} />
                Submit Attendance
              </Button>
            </div>
          </section>
        </>
      )}

      {confirmOpen && (
        <ConfirmDialog
          confirmLabel="Submit attendance"
          isBusy={isSubmitting}
          message={`${pendingChanges.create} new record${pendingChanges.create === 1 ? "" : "s"} will be created and ${pendingChanges.update} changed record${pendingChanges.update === 1 ? "" : "s"} will be updated for ${selectedSubject?.subject_code || "this subject"} on ${date}. Existing unchanged records will be left as they are.`}
          onCancel={() => {
            if (!isSubmitting) setConfirmOpen(false);
          }}
          onConfirm={() => void submitAttendance()}
          title="Confirm attendance submission"
        />
      )}
    </div>
  );
}
