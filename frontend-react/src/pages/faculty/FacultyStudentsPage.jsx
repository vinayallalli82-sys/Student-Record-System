import { useMemo, useState } from "react";
import { Eye, GraduationCap } from "lucide-react";
import { facultyApi } from "../../api/faculty.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

export default function FacultyStudentsPage() {
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [selection, setSelection] = useState(null);
  const [profile, setProfile] = useState(null);
  const [academic, setAcademic] = useState([]);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const rows = useMemo(() => {
    const byId = new Map();
    (subjects || []).forEach((subject) => {
      if (subjectFilter && String(subject.subject_id) !== subjectFilter) return;
      subject.students.forEach((student) => {
        const existing = byId.get(student.student_id) || { ...student, subjects: [] };
        existing.subjects.push(subject);
        byId.set(student.student_id, existing);
      });
    });
    const needle = search.trim().toLowerCase();
    return [...byId.values()].filter((student) =>
      [
        student.first_name,
        student.last_name,
        student.registration_number,
        student.student_id,
        ...student.subjects.map((subject) => subject.subject_code),
      ].some((value) => String(value ?? "").toLowerCase().includes(needle)),
    );
  }, [subjects, subjectFilter, search]);

  async function loadProfile(student) {
    setSelection(student);
    setProfile(null);
    setAcademic([]);
    setDetailError("");
    setDetailLoading(true);
    try {
      const details = await facultyApi.studentProfile(student.student_id);
      const subjectResults = await Promise.all(student.subjects.map(async (subject) => {
        const [attendance, marks] = await Promise.all([
          facultyApi.attendancePercentage(student.student_id, subject.subject_id),
          facultyApi.marks({ subject_id: subject.subject_id, student_id: student.student_id }),
        ]);
        if (!Array.isArray(marks)) {
          throw new Error("The marks API returned an unexpected response.");
        }
        return { subject, attendance, marks };
      }));
      setProfile(details);
      setAcademic(subjectResults);
    } catch (loadError) {
      setDetailError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader description="Students are sourced only from rosters returned for subjects you are authorized to manage." eyebrow="TEACHING" title="Students" />
      {isLoading && <LoadingState label="Loading authorized student rosters..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && <>
        <Card>
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_280px]">
            <SearchInput onChange={setSearch} placeholder="Search name, registration, ID, or subject" value={search} />
            <select aria-label="Filter by assigned subject" className="form-control" onChange={(event) => setSubjectFilter(event.target.value)} value={subjectFilter}>
              <option value="">All assigned subjects</option>
              {(subjects || []).map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_code} · {subject.subject_name}</option>)}
            </select>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{rows.length} students in the selected authorized rosters</p>
        </Card>
        <DataTable
          columns={[
            { key: "registration_number", label: "Student", render: (student) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-violet-50 text-violet-700"><GraduationCap aria-hidden="true" size={18} /></span><div><p className="font-semibold text-slate-800">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-400">{student.registration_number}</p></div></div> },
            { key: "student_id", label: "Student ID" },
            { key: "subjects", label: "Assigned subjects", render: (student) => student.subjects.map((subject) => subject.subject_code).join(", ") },
            { key: "actions", label: "", render: (student) => <Button className="px-3 py-1.5" onClick={() => loadProfile(student)} variant="secondary"><Eye aria-hidden="true" size={15} />Profile</Button> },
          ]}
          emptyDescription="No students are enrolled in the selected assigned subjects."
          emptyTitle="No enrolled students"
          getRowKey={(student) => student.student_id}
          rows={rows}
        />
      </>}

      {selection && (
        <Modal
          description="Profile, attendance percentage, and marks are loaded only for authorized assigned subjects."
          onClose={() => setSelection(null)}
          size="max-w-3xl"
          title={profile ? `${profile.first_name} ${profile.last_name || ""}` : "Student profile"}
        >
          {detailLoading && <LoadingState label="Loading student academic information..." />}
          {detailError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{detailError}</p>}
          {profile && !detailLoading && <>
            <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
              <div><dt className="text-xs text-slate-500">Registration</dt><dd className="mt-1 text-sm font-semibold">{profile.registration_number}</dd></div>
              <div><dt className="text-xs text-slate-500">Course</dt><dd className="mt-1 text-sm font-semibold">{profile.course}</dd></div>
              <div><dt className="text-xs text-slate-500">Admission year</dt><dd className="mt-1 text-sm font-semibold">{profile.admission_year}</dd></div>
            </dl>
            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Subject performance</h3>
              {academic.map(({ subject, attendance, marks }) => (
                <section className="rounded-xl border border-slate-200 p-4" key={subject.subject_id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="font-semibold text-slate-800">{subject.subject_code} · {subject.subject_name}</p><p className="mt-1 text-xs text-slate-500">Attendance: {attendance.classes_attended}/{attendance.total_classes} · {attendance.attendance_percentage}%</p></div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{marks.length} assessments</span>
                  </div>
                  {marks.length > 0 && <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">{marks.map((mark) => <div className="flex items-center justify-between gap-3 text-sm" key={mark.mark_id}><span className="text-slate-600">{mark.assessment_name}</span><span className="font-medium text-slate-800">{mark.marks_obtained} / {mark.max_marks}</span></div>)}</div>}
                </section>
              ))}
            </div>
          </>}
        </Modal>
      )}
    </div>
  );
}
