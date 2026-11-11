import { useCallback, useMemo, useState } from "react";
import { ArrowRightLeft, Link2, Plus, Trash2 } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const initialForm = { faculty_id: "", semester_id: "", subject_id: "" };

export default function FacultyAssignmentsPage() {
  const { setNotice } = useAuth();
  const query = useCallback(async () => {
    const [users, subjects, semesters, assignments] = await Promise.all([
      adminApi.users(),
      adminApi.subjects(),
      adminApi.semesters(),
      adminApi.facultyAssignments(),
    ]);
    return { users, subjects, semesters, assignments };
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [replacementFaculty, setReplacementFaculty] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const users = data?.users ?? [];
  const subjects = data?.subjects ?? [];
  const semesters = data?.semesters ?? [];
  const assignments = data?.assignments ?? [];
  const activeFaculty = useMemo(
    () => users.filter((user) => user.role === "Faculty" && user.is_active),
    [users],
  );
  const availableSubjects = useMemo(
    () => subjects.filter((subject) => String(subject.semester_id) === form.semester_id),
    [subjects, form.semester_id],
  );
  const filteredAssignments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return assignments.filter((assignment) =>
      [
        assignment.faculty_email,
        assignment.subject_code,
        assignment.subject_name,
        assignment.academic_year,
        assignment.semester_number,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle)),
    );
  }, [assignments, search]);

  async function assignFaculty(event) {
    event.preventDefault();
    setFormError("");
    if (!form.faculty_id || !form.semester_id || !form.subject_id) {
      setFormError("Select an active faculty member, semester, and subject.");
      return;
    }

    setIsSaving(true);
    try {
      await adminApi.assignFaculty({
        faculty_id: Number(form.faculty_id),
        semester_id: Number(form.semester_id),
        subject_id: Number(form.subject_id),
      });
      setFormOpen(false);
      setForm(initialForm);
      setNotice({ type: "success", message: "Faculty assigned to the subject." });
      reload();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function reassign(action) {
    setIsSaving(true);
    try {
      await adminApi.reassignFaculty(action.assignment.faculty_id, action.assignment.subject_id, {
        faculty_id: Number(action.newFacultyId),
        semester_id: action.assignment.semester_id,
      });
      setNotice({ type: "success", message: "Faculty assignment updated." });
      setReplacementFaculty((value) => ({ ...value, [action.key]: "" }));
      reload();
    } catch (saveError) {
      setNotice({ type: "error", message: saveError.message });
    } finally {
      setConfirmAction(null);
      setIsSaving(false);
    }
  }

  async function removeAssignment(assignment) {
    setIsSaving(true);
    try {
      await adminApi.removeFaculty(assignment.faculty_id, assignment.subject_id);
      setNotice({ type: "success", message: "Faculty assignment removed." });
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
      key: "faculty_email",
      label: "Faculty",
      render: (assignment) => (
        <div>
          <p className="font-semibold text-slate-800">{assignment.faculty_email}</p>
          <p className="text-xs text-slate-400">Faculty ID {assignment.faculty_id}</p>
        </div>
      ),
    },
    {
      key: "subject_code",
      label: "Assigned subject",
      render: (assignment) => (
        <div>
          <p className="font-semibold text-slate-800">{assignment.subject_code}</p>
          <p className="text-xs text-slate-400">{assignment.subject_name}</p>
        </div>
      ),
    },
    {
      key: "semester_number",
      label: "Semester",
      render: (assignment) => `Semester ${assignment.semester_number} · ${assignment.academic_year}`,
    },
    {
      key: "reassign",
      label: "Change faculty",
      render: (assignment) => {
        const key = `${assignment.faculty_id}-${assignment.subject_id}`;
        const replacements = activeFaculty.filter((person) => person.user_id !== assignment.faculty_id);
        return (
          <div className="flex min-w-56 items-center gap-2">
            <select
              aria-label={`Replacement faculty for ${assignment.subject_code}`}
              className="form-control min-h-9 py-1.5 text-xs"
              onChange={(event) => setReplacementFaculty((value) => ({ ...value, [key]: event.target.value }))}
              value={replacementFaculty[key] || ""}
            >
              <option value="">Select faculty</option>
              {replacements.map((person) => <option key={person.user_id} value={person.user_id}>{person.email}</option>)}
            </select>
            <Button
              aria-label={`Reassign ${assignment.subject_code}`}
              className="min-h-9 px-2.5"
              disabled={!replacementFaculty[key]}
              onClick={() => setConfirmAction({
                type: "reassign",
                assignment,
                key,
                newFacultyId: replacementFaculty[key],
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
      render: (assignment) => (
        <Button
          aria-label={`Remove ${assignment.faculty_email} from ${assignment.subject_code}`}
          className="min-h-9 px-2.5 text-rose-700 hover:bg-rose-50"
          onClick={() => setConfirmAction({ type: "remove", assignment })}
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
          <Button onClick={() => { setFormError(""); setForm(initialForm); setFormOpen(true); }}>
            <Plus aria-hidden="true" size={17} />
            Assign faculty
          </Button>
        }
        description="Assign active faculty accounts to subjects and keep teaching ownership current."
        eyebrow="ACADEMIC STRUCTURE"
        title="Faculty assignments"
      />
      {isLoading && <LoadingState label="Loading assignment data..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput onChange={setSearch} placeholder="Search faculty, subject or academic year" value={search} />
            <span className="shrink-0 text-sm text-slate-500">{filteredAssignments.length} assignments</span>
          </Card>
          <DataTable
            columns={columns}
            emptyDescription={assignments.length ? "Try a different search term." : "Create the first faculty-subject assignment."}
            emptyTitle={assignments.length ? "No matching assignments" : "No assignments yet"}
            getRowKey={(assignment) => `${assignment.faculty_id}-${assignment.subject_id}`}
            rows={filteredAssignments}
          />
        </>
      )}

      {formOpen && (
        <Modal
          description="The subject must belong to the selected semester. Only active Faculty accounts are available."
          onClose={() => !isSaving && setFormOpen(false)}
          title="Assign faculty to subject"
        >
          <form className="space-y-4" onSubmit={assignFaculty}>
            <SelectField
              id="assignment-faculty"
              label="Faculty account"
              onChange={(faculty_id) => setForm((value) => ({ ...value, faculty_id }))}
              options={activeFaculty.map((person) => ({ value: String(person.user_id), label: person.email }))}
              required
              value={form.faculty_id}
            />
            <SelectField
              id="assignment-semester"
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
              id="assignment-subject"
              label="Subject"
              onChange={(subject_id) => setForm((value) => ({ ...value, subject_id }))}
              options={availableSubjects.map((subject) => ({
                value: String(subject.subject_id),
                label: `${subject.subject_code} · ${subject.subject_name}`,
              }))}
              required
              value={form.subject_id}
            />
            {formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isSaving} onClick={() => setFormOpen(false)} type="button" variant="secondary">Cancel</Button>
              <Button disabled={isSaving || activeFaculty.length === 0} type="submit">{isSaving ? "Assigning..." : "Assign faculty"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {confirmAction && (
        <ConfirmDialog
          confirmLabel={confirmAction.type === "remove" ? "Remove assignment" : "Confirm reassignment"}
          isBusy={isSaving}
          isDangerous={confirmAction.type === "remove"}
          message={
            confirmAction.type === "remove"
              ? `Remove ${confirmAction.assignment.faculty_email} from ${confirmAction.assignment.subject_code}? The server may reject removal if this is the last faculty assignment for an enrolled subject.`
              : `Reassign ${confirmAction.assignment.subject_code} from ${confirmAction.assignment.faculty_email} to ${activeFaculty.find((person) => String(person.user_id) === confirmAction.newFacultyId)?.email}?`
          }
          onCancel={() => !isSaving && setConfirmAction(null)}
          onConfirm={() => confirmAction.type === "remove"
            ? removeAssignment(confirmAction.assignment)
            : reassign(confirmAction)}
          title={confirmAction.type === "remove" ? "Remove faculty assignment" : "Reassign faculty"}
        />
      )}
    </div>
  );
}
