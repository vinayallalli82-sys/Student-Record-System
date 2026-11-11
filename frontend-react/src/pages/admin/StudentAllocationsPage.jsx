import { useCallback, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Trash2, UsersRound } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const blankForm = { student_id: "", semester_id: "", subject_id: "" };

export default function StudentAllocationsPage() {
  const { setNotice } = useAuth();
  const [filters, setFilters] = useState({ student_id: "", subject_id: "", semester_id: "" });
  const query = useCallback(async () => {
    const [students, subjects, semesters, allocations, allAllocations] = await Promise.all([
      adminApi.students(),
      adminApi.subjects(),
      adminApi.semesters(),
      adminApi.studentAllocations(filters),
      adminApi.studentAllocations(),
    ]);
    return { students, subjects, semesters, allocations, allAllocations };
  }, [filters]);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newSubjects, setNewSubjects] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const students = data?.students ?? [];
  const subjects = data?.subjects ?? [];
  const semesters = data?.semesters ?? [];
  const allocations = data?.allocations ?? [];
  const allAllocations = data?.allAllocations ?? [];
  const allocatedStudentIds = new Set(allAllocations.map((allocation) => allocation.student_id));
  const unallocatedStudents = students.filter((student) => !allocatedStudentIds.has(student.student_id));
  const formSubjects = useMemo(
    () => subjects.filter((subject) => String(subject.semester_id) === form.semester_id),
    [subjects, form.semester_id],
  );

  function openAllocation(studentId = "") {
    setFormError("");
    setForm({ ...blankForm, student_id: String(studentId) });
    setFormOpen(true);
  }

  async function allocateStudent(event) {
    event.preventDefault();
    setFormError("");
    if (!form.student_id || !form.semester_id || !form.subject_id) {
      setFormError("Select a student, semester, and subject.");
      return;
    }
    setIsSaving(true);
    try {
      await adminApi.allocateStudent({
        student_id: Number(form.student_id),
        semester_id: Number(form.semester_id),
        subject_id: Number(form.subject_id),
      });
      setFormOpen(false);
      setForm(blankForm);
      setNotice({ type: "success", message: "Student allocated to subject." });
      reload();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function reassignStudent(action) {
    setIsSaving(true);
    try {
      await adminApi.reassignStudent(
        action.allocation.student_id,
        action.allocation.subject_id,
        {
          new_subject_id: Number(action.newSubjectId),
          semester_id: action.allocation.semester_id,
        },
      );
      setNotice({ type: "success", message: "Student allocation reassigned." });
      setNewSubjects((value) => ({ ...value, [action.key]: "" }));
      reload();
    } catch (saveError) {
      setNotice({ type: "error", message: saveError.message });
    } finally {
      setConfirmAction(null);
      setIsSaving(false);
    }
  }

  async function removeAllocation(allocation) {
    setIsSaving(true);
    try {
      await adminApi.removeStudent(allocation.student_id, allocation.subject_id);
      setNotice({ type: "success", message: "Student allocation removed. Existing academic records are preserved." });
      reload();
    } catch (saveError) {
      setNotice({ type: "error", message: saveError.message });
    } finally {
      setConfirmAction(null);
      setIsSaving(false);
    }
  }

  const columns = [
    {
      key: "registration_number",
      label: "Student",
      render: (allocation) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
            <UsersRound aria-hidden="true" size={17} />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{allocation.first_name} {allocation.last_name}</p>
            <p className="text-xs text-slate-400">{allocation.registration_number}</p>
          </div>
        </div>
      ),
    },
    {
      key: "subject_code",
      label: "Subject",
      render: (allocation) => (
        <div>
          <p className="font-semibold text-slate-800">{allocation.subject_code}</p>
          <p className="text-xs text-slate-400">{allocation.subject_name}</p>
        </div>
      ),
    },
    {
      key: "semester_number",
      label: "Semester",
      render: (allocation) => `Semester ${allocation.semester_number} · ${allocation.academic_year}`,
    },
    {
      key: "faculty",
      label: "Assigned faculty",
      render: (allocation) => allocation.faculty?.length
        ? allocation.faculty.map((person) => person.faculty_email).join(", ")
        : "Unassigned",
    },
    {
      key: "reassign",
      label: "Reassign",
      render: (allocation) => {
        const key = `${allocation.student_id}-${allocation.subject_id}`;
        const available = subjects.filter((subject) =>
          subject.semester_id === allocation.semester_id &&
          subject.subject_id !== allocation.subject_id,
        );
        return (
          <div className="flex min-w-56 items-center gap-2">
            <select
              aria-label={`New subject for ${allocation.registration_number}`}
              className="form-control min-h-9 py-1.5 text-xs"
              onChange={(event) => setNewSubjects((value) => ({ ...value, [key]: event.target.value }))}
              value={newSubjects[key] || ""}
            >
              <option value="">Select subject</option>
              {available.map((subject) => (
                <option key={subject.subject_id} value={subject.subject_id}>
                  {subject.subject_code} · {subject.subject_name}
                </option>
              ))}
            </select>
            <Button
              aria-label={`Reassign ${allocation.registration_number}`}
              className="min-h-9 px-2.5"
              disabled={!newSubjects[key]}
              onClick={() => setConfirmAction({
                type: "reassign",
                allocation,
                key,
                newSubjectId: newSubjects[key],
              })}
              variant="secondary"
            >
              <ArrowRightLeft aria-hidden="true" size={15} />
            </Button>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (allocation) => (
        <Button
          aria-label={`Remove ${allocation.registration_number} from ${allocation.subject_code}`}
          className="min-h-9 px-2.5 text-rose-700 hover:bg-rose-50"
          onClick={() => setConfirmAction({ type: "remove", allocation })}
          variant="ghost"
        >
          <Trash2 aria-hidden="true" size={16} />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        actions={
          <Button onClick={() => openAllocation()}>
            <Plus aria-hidden="true" size={17} />
            Allocate student
          </Button>
        }
        description="Enroll students in subjects, with assigned faculty displayed when available."
        eyebrow="ACADEMIC STRUCTURE"
        title="Student allocations"
      />
      {isLoading && <LoadingState label="Loading student allocations..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <Card>
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField
                id="allocation-filter-student"
                label="Filter by student"
                onChange={(student_id) => setFilters((value) => ({ ...value, student_id }))}
                options={students.map((student) => ({
                  value: String(student.student_id),
                  label: `${student.registration_number} · ${student.first_name} ${student.last_name}`,
                }))}
                placeholder="All students"
                value={filters.student_id}
              />
              <SelectField
                id="allocation-filter-semester"
                label="Filter by semester"
                onChange={(semester_id) => setFilters((value) => ({ ...value, semester_id, subject_id: "" }))}
                options={semesters.map((semester) => ({
                  value: String(semester.semester_id),
                  label: `Semester ${semester.semester_number} · ${semester.academic_year}`,
                }))}
                placeholder="All semesters"
                value={filters.semester_id}
              />
              <SelectField
                id="allocation-filter-subject"
                label="Filter by subject"
                onChange={(subject_id) => setFilters((value) => ({ ...value, subject_id }))}
                options={subjects
                  .filter((subject) => !filters.semester_id || String(subject.semester_id) === filters.semester_id)
                  .map((subject) => ({ value: String(subject.subject_id), label: `${subject.subject_code} · ${subject.subject_name}` }))}
                placeholder="All subjects"
                value={filters.subject_id}
              />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {allocations.length} allocations shown
            </div>
          </Card>
          <DataTable
            columns={columns}
            emptyDescription="Adjust the filters or add a new student-subject allocation."
            emptyTitle={allocations.length ? "No matching allocations" : "No allocations found"}
            getRowKey={(allocation) => `${allocation.student_id}-${allocation.subject_id}`}
            rows={allocations}
          />
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Students without subject allocations</h2>
              <p className="mt-1 text-sm text-slate-500">This list is sourced from Student profiles, independently of attendance or marks history.</p>
            </div>
            <DataTable
              columns={[
                { key: "registration_number", label: "Registration number" },
                { key: "name", label: "Student", render: (student) => `${student.first_name} ${student.last_name || ""}` },
                { key: "email", label: "Email", render: (student) => student.email || "—" },
                { key: "course", label: "Course / department" },
                {
                  key: "action",
                  label: "",
                  render: (student) => (
                    <Button onClick={() => openAllocation(student.student_id)} variant="secondary">
                      Allocate subject
                    </Button>
                  ),
                },
              ]}
              emptyDescription={students.length ? "All student profiles have at least one subject allocation." : "Create or reconcile a Student profile before allocating subjects."}
              emptyTitle={students.length ? "No unallocated students" : "No student profiles"}
              getRowKey={(student) => student.student_id}
              rows={unallocatedStudents}
            />
          </section>
        </>
      )}

      {formOpen && (
        <Modal
          description="The selected subject must have an active faculty assignment before allocation."
          onClose={() => !isSaving && setFormOpen(false)}
          title="Allocate student to subject"
        >
          <form className="space-y-4" onSubmit={allocateStudent}>
            <SelectField
              id="allocate-student"
              label="Student"
              onChange={(student_id) => setForm((value) => ({ ...value, student_id }))}
              options={students.map((student) => ({
                value: String(student.student_id),
                label: `${student.registration_number} · ${student.first_name} ${student.last_name}`,
              }))}
              required
              value={form.student_id}
            />
            <SelectField
              id="allocate-semester"
              label="Semester"
              onChange={(semester_id) => setForm((value) => ({ ...value, semester_id, subject_id: "" }))}
              options={semesters.map((semester) => ({
                value: String(semester.semester_id),
                label: `Semester ${semester.semester_number} · ${semester.academic_year}`,
              }))}
              required
              value={form.semester_id}
            />
            <SelectField
              disabled={!form.semester_id}
              id="allocate-subject"
              label="Subject"
              onChange={(subject_id) => setForm((value) => ({ ...value, subject_id }))}
              options={formSubjects.map((subject) => ({
                value: String(subject.subject_id),
                label: `${subject.subject_code} · ${subject.subject_name}`,
              }))}
              required
              value={form.subject_id}
            />
            {formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isSaving} onClick={() => setFormOpen(false)} type="button" variant="secondary">Cancel</Button>
              <Button disabled={isSaving} type="submit">{isSaving ? "Allocating..." : "Allocate student"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && (
        <ConfirmDialog
          confirmLabel={confirmAction.type === "remove" ? "Remove allocation" : "Confirm reassignment"}
          isBusy={isSaving}
          isDangerous={confirmAction.type === "remove"}
          message={
            confirmAction.type === "remove"
              ? `Remove ${confirmAction.allocation.registration_number} from ${confirmAction.allocation.subject_code}? Existing academic records will be preserved.`
              : `Move ${confirmAction.allocation.registration_number} from ${confirmAction.allocation.subject_code} to ${subjects.find((subject) => String(subject.subject_id) === confirmAction.newSubjectId)?.subject_code}?`
          }
          onCancel={() => !isSaving && setConfirmAction(null)}
          onConfirm={() => confirmAction.type === "remove"
            ? removeAllocation(confirmAction.allocation)
            : reassignStudent(confirmAction)}
          title={confirmAction.type === "remove" ? "Remove student allocation" : "Reassign student"}
        />
      )}
    </div>
  );
}
