import { useCallback, useMemo, useState } from "react";
import { BookOpenCheck, Pencil, Plus } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import FormField from "../../components/common/FormField.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const emptyForm = {
  subject_code: "",
  subject_name: "",
  credits: "",
  semester_id: "",
};

export default function SubjectsPage() {
  const { setNotice } = useAuth();
  const query = useCallback(async () => {
    const [subjects, semesters] = await Promise.all([
      adminApi.subjects(),
      adminApi.semesters(),
    ]);
    return { subjects, semesters };
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const [search, setSearch] = useState("");
  const [editingSubject, setEditingSubject] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const subjects = data?.subjects ?? [];
  const semesters = data?.semesters ?? [];
  const semesterById = useMemo(
    () => new Map(semesters.map((semester) => [semester.semester_id, semester])),
    [semesters],
  );
  const filteredSubjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return subjects.filter((subject) =>
      [subject.subject_code, subject.subject_name, subject.subject_id]
        .some((value) => String(value ?? "").toLowerCase().includes(needle)),
    );
  }, [subjects, search]);

  function openCreate() {
    setEditingSubject(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(subject) {
    setEditingSubject(subject);
    setFormOpen(true);
    setForm({
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
      credits: String(subject.credits),
      semester_id: String(subject.semester_id),
    });
    setFormError("");
  }

  async function saveSubject(event) {
    event.preventDefault();
    setFormError("");
    const credits = Number(form.credits);
    const semesterId = Number(form.semester_id);
    if (!Number.isFinite(credits) || credits <= 0 || credits > 999.9 || Math.round(credits * 10) !== credits * 10) {
      setFormError("Credits must be greater than 0 and no more than 999.9, with at most one decimal place.");
      return;
    }
    if (!Number.isInteger(semesterId) || semesterId <= 0) {
      setFormError("Choose a valid semester.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        subject_code: form.subject_code.trim(),
        subject_name: form.subject_name.trim(),
        credits,
        semester_id: semesterId,
      };
      if (editingSubject) {
        await adminApi.updateSubject(editingSubject.subject_id, payload);
      } else {
        await adminApi.createSubject(payload);
      }
      setEditingSubject(null);
      setFormOpen(false);
      setNotice({
        type: "success",
        message: editingSubject ? "Subject details updated." : "Subject created successfully.",
      });
      reload();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const columns = [
    {
      key: "subject_code",
      label: "Subject",
      render: (subject) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-50 text-cyan-800">
            <BookOpenCheck aria-hidden="true" size={17} />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{subject.subject_name}</p>
            <p className="text-xs text-slate-400">{subject.subject_code}</p>
          </div>
        </div>
      ),
    },
    { key: "credits", label: "Credits" },
    {
      key: "semester_id",
      label: "Semester",
      render: (subject) => {
        const semester = semesterById.get(subject.semester_id);
        return semester
          ? `Semester ${semester.semester_number} · ${semester.academic_year}`
          : `Semester ID ${subject.semester_id}`;
      },
    },
    {
      key: "actions",
      label: "",
      render: (subject) => (
        <Button className="px-3 py-1.5" onClick={() => openEdit(subject)} variant="secondary">
          <Pencil aria-hidden="true" size={15} />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" size={17} />
            Create subject
          </Button>
        }
        description="Maintain the subject catalog and semester association."
        eyebrow="ACADEMIC STRUCTURE"
        title="Subject management"
      />
      {isLoading && <LoadingState label="Loading subjects and semesters..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput onChange={setSearch} placeholder="Search subject code or name" value={search} />
            <span className="shrink-0 text-sm text-slate-500">{filteredSubjects.length} subjects</span>
          </Card>
          <DataTable
            columns={columns}
            emptyDescription={subjects.length ? "Try another subject search." : "No subjects have been added."}
            emptyTitle={subjects.length ? "No matching subjects" : "Subject catalog is empty"}
            getRowKey={(subject) => subject.subject_id}
            rows={filteredSubjects}
          />
        </>
      )}

      {formOpen && (
        <Modal
          description="Subject codes and names must be unique and valid for an existing semester."
          onClose={() => {
            if (!isSaving) {
              setEditingSubject(null);
              setForm(emptyForm);
              setFormOpen(false);
            }
          }}
          title={editingSubject ? "Edit subject" : "Create subject"}
        >
          <form className="space-y-4" onSubmit={saveSubject}>
            <FormField
              id="subject-code"
              label="Subject code"
              maxLength={20}
              onChange={(event) => setForm((value) => ({ ...value, subject_code: event.target.value }))}
              required
              value={form.subject_code}
            />
            <FormField
              id="subject-name"
              label="Subject name"
              maxLength={150}
              onChange={(event) => setForm((value) => ({ ...value, subject_name: event.target.value }))}
              required
              value={form.subject_name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="subject-credits"
                label="Credits"
                max="999.9"
                min="0.1"
                onChange={(event) => setForm((value) => ({ ...value, credits: event.target.value }))}
                required
                step="0.1"
                type="number"
                value={form.credits}
              />
              <SelectField
                id="subject-semester"
                label="Semester"
                onChange={(semester_id) => setForm((value) => ({ ...value, semester_id }))}
                options={semesters.map((semester) => ({
                  value: String(semester.semester_id),
                  label: `Semester ${semester.semester_number} · ${semester.academic_year}`,
                }))}
                required
                value={form.semester_id}
              />
            </div>
            {formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isSaving} onClick={() => { setEditingSubject(null); setForm(emptyForm); setFormOpen(false); }} type="button" variant="secondary">Cancel</Button>
              <Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : editingSubject ? "Save changes" : "Create subject"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
