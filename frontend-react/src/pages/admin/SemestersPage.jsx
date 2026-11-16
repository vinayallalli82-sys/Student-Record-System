import { useCallback, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import FormField from "../../components/common/FormField.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const emptyForm = {
  semester_number: "",
  academic_year: "",
  start_date: "",
  end_date: "",
};

function validateForm(form, semesters) {
  const errors = {};
  const semesterNumber = Number(form.semester_number);
  if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
    errors.semester_number = "Enter a whole number from 1 to 12.";
  } else if (semesters.some((item) => item.semester_number === semesterNumber)) {
    errors.semester_number = `Semester ${semesterNumber} is already configured.`;
  }
  if (!/^\d{4}-\d{4}$/.test(form.academic_year)) {
    errors.academic_year = "Enter the academic year in YYYY-YYYY format.";
  }
  if (form.start_date && form.end_date && form.end_date <= form.start_date) {
    errors.end_date = "End date must be later than start date.";
  }
  return errors;
}

export default function SemestersPage() {
  const { setNotice } = useAuth();
  const query = useCallback(() => adminApi.semesters(), []);
  const { data: semesters = [], error, isLoading, reload } = useAdminQuery(query);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function openCreateForm() {
    setForm(emptyForm);
    setFieldErrors({});
    setFormError("");
    setFormOpen(true);
  }

  async function createSemester(event) {
    event.preventDefault();
    setFormError("");
    const errors = validateForm(form, semesters);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSaving(true);
    try {
      await adminApi.createSemester({
        semester_number: Number(form.semester_number),
        academic_year: form.academic_year,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      setFormOpen(false);
      setForm(emptyForm);
      setNotice({ type: "success", message: "Semester created successfully." });
      reload();
    } catch (saveError) {
      setFormError(saveError.message || "Unable to create the semester.");
      setNotice({ type: "error", message: saveError.message || "Unable to create the semester." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        actions={
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" size={17} />
            Add Semester
          </Button>
        }
        description="Review and manage the configured academic terms and their date ranges."
        eyebrow="ACADEMIC STRUCTURE"
        title="Semester overview"
      />
      {isLoading && <LoadingState label="Loading semester records..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
                <CalendarDays aria-hidden="true" size={19} />
              </span>
              <p className="mt-4 text-2xl font-semibold text-slate-950">{semesters.length}</p>
              <p className="mt-1 text-sm text-slate-500">Configured semesters</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Academic years</p>
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {new Set(semesters.map((semester) => semester.academic_year)).size}
              </p>
              <p className="mt-1 text-sm text-slate-500">Distinct academic year labels</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date coverage</p>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {semesters.filter((semester) => semester.start_date || semester.end_date).length} / {semesters.length}
              </p>
              <p className="mt-1 text-sm text-slate-500">Terms with date information</p>
            </Card>
          </div>
          <DataTable
            columns={[
              { key: "semester_number", label: "Semester", render: (semester) => <span className="font-semibold text-slate-800">Semester {semester.semester_number}</span> },
              { key: "academic_year", label: "Academic year" },
              { key: "start_date", label: "Start date", render: (semester) => semester.start_date || "Not set" },
              { key: "end_date", label: "End date", render: (semester) => semester.end_date || "Not set" },
            ]}
            emptyDescription="Add a semester to make it available across academic management tools."
            emptyTitle="No semesters configured"
            getRowKey={(semester) => semester.semester_id}
            rows={semesters}
          />
        </>
      )}

      {formOpen && (
        <Modal
          description="Add an academic term to the shared semester catalog."
          onClose={() => !isSaving && setFormOpen(false)}
          title="Add Semester"
        >
          <form className="space-y-4" onSubmit={createSemester}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={fieldErrors.semester_number}
                id="semester-number"
                label="Semester Number"
                max="12"
                min="1"
                onChange={(event) => setForm((value) => ({ ...value, semester_number: event.target.value }))}
                required
                step="1"
                type="number"
                value={form.semester_number}
              />
              <FormField
                error={fieldErrors.academic_year}
                id="semester-academic-year"
                label="Academic Year"
                maxLength={9}
                onChange={(event) => setForm((value) => ({ ...value, academic_year: event.target.value }))}
                pattern="[0-9]{4}-[0-9]{4}"
                placeholder="2026-2027"
                required
                title="Use YYYY-YYYY format."
                value={form.academic_year}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                error={fieldErrors.start_date}
                id="semester-start-date"
                label="Start Date (optional)"
                onChange={(event) => setForm((value) => ({ ...value, start_date: event.target.value }))}
                type="date"
                value={form.start_date}
              />
              <FormField
                error={fieldErrors.end_date}
                id="semester-end-date"
                label="End Date (optional)"
                min={form.start_date || undefined}
                onChange={(event) => setForm((value) => ({ ...value, end_date: event.target.value }))}
                type="date"
                value={form.end_date}
              />
            </div>
            {formError && (
              <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isSaving} onClick={() => setFormOpen(false)} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save Semester"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
