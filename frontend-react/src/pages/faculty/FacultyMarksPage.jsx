import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import { facultyApi } from "../../api/faculty.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import FormField from "../../components/common/FormField.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

const ASSESSMENTS = ["ISA 1", "ISA 2", "ESA"];
const ASSESSMENT_FILTERS = [
  { value: "all", label: "All examinations" },
  ...ASSESSMENTS.map((name) => ({ value: name, label: name })),
  { value: "historical", label: "Historical assessments" },
];
const isCanonicalAssessment = (name) => ASSESSMENTS.includes(name);
const blankForm = { student_id: "", assessment_name: "", marks_obtained: "", max_marks: "" };

export default function FacultyMarksPage() {
  const { setNotice } = useAuth();
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [subjectId, setSubjectId] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [marks, setMarks] = useState([]);
  const [marksError, setMarksError] = useState("");
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [editingMark, setEditingMark] = useState(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  const selectedSubject = useMemo(
    () => (subjects || []).find((subject) => String(subject.subject_id) === subjectId),
    [subjects, subjectId],
  );
  const visibleMarks = useMemo(() => marks.filter((mark) => {
    if (assessmentFilter === "all") return true;
    if (assessmentFilter === "historical") return !isCanonicalAssessment(mark.assessment_name);
    return mark.assessment_name === assessmentFilter;
  }), [assessmentFilter, marks]);
  const loadMarks = useCallback(async () => {
    if (!subjectId) {
      setMarks([]);
      return;
    }
    setIsLoadingMarks(true);
    setMarksError("");
    try {
      const result = await facultyApi.marks({ subject_id: subjectId });
      if (!Array.isArray(result)) throw new Error("The marks API returned an unexpected response.");
      setMarks(result);
    } catch (loadError) {
      setMarksError(loadError.message);
      setMarks([]);
    } finally {
      setIsLoadingMarks(false);
    }
  }, [subjectId]);

  useEffect(() => { void loadMarks(); }, [loadMarks]);

  function editMark(mark) {
    setEditingMark(mark);
    setForm({
      student_id: String(mark.student_id),
      assessment_name: mark.assessment_name,
      marks_obtained: String(mark.marks_obtained),
      max_marks: String(mark.max_marks),
    });
    setFormError("");
  }

  function beginCreate() {
    setEditingMark(null);
    setForm(blankForm);
    setFormError("");
  }

  async function saveMark() {
    setFormError("");
    const obtained = Number(form.marks_obtained);
    const maximum = Number(form.max_marks);
    if (!form.student_id || !ASSESSMENTS.includes(form.assessment_name)) {
      setFormError("Select an enrolled student and one of ISA 1, ISA 2, or ESA.");
      return;
    }
    if (!Number.isFinite(obtained) || !Number.isFinite(maximum) ||
        obtained < 0 || maximum <= 0 || obtained > maximum ||
        obtained >= 10000 || maximum >= 10000 ||
        Math.round(obtained * 100) !== obtained * 100 ||
        Math.round(maximum * 100) !== maximum * 100) {
      setFormError("Enter valid marks: obtained must be 0 to maximum, maximum greater than 0, both below 10000 and at most two decimals.");
      return;
    }
    const duplicate = marks.find((mark) =>
      mark.mark_id !== editingMark?.mark_id
      && mark.student_id === Number(form.student_id)
      && mark.subject_id === Number(subjectId)
      && mark.assessment_name === form.assessment_name,
    );
    if (duplicate) {
      setFormError("A mark already exists for this student and examination. Edit that record instead.");
      return;
    }

    setIsSaving(true);
    const payload = {
      student_id: Number(form.student_id),
      subject_id: Number(subjectId),
      assessment_name: form.assessment_name,
      marks_obtained: obtained,
      max_marks: maximum,
    };
    try {
      if (editingMark) await facultyApi.updateMark(editingMark.mark_id, payload);
      else await facultyApi.saveMark(payload);
      setNotice({ type: "success", message: editingMark ? "Marks updated." : "Marks saved." });
      setConfirmSave(false);
      beginCreate();
      await loadMarks();
    } catch (saveError) {
      setFormError(saveError.message);
      setConfirmSave(false);
    } finally {
      setIsSaving(false);
    }
  }

  const columns = [
    { key: "registration_number", label: "Student", render: (mark) => <div><p className="font-semibold text-slate-800">{mark.first_name} {mark.last_name}</p><p className="text-xs text-slate-400">{mark.registration_number}</p></div> },
    { key: "assessment_name", label: "Assessment" },
    { key: "marks", label: "Score", render: (mark) => <span className="font-semibold">{mark.marks_obtained} / {mark.max_marks}</span> },
    { key: "updated_at", label: "Updated", render: (mark) => mark.updated_at ? new Date(mark.updated_at).toLocaleDateString() : "—" },
    { key: "actions", label: "", render: (mark) => isCanonicalAssessment(mark.assessment_name)
      ? <Button className="px-3 py-1.5" onClick={() => editMark(mark)} variant="secondary"><Pencil aria-hidden="true" size={15} />Edit</Button>
      : <span className="text-xs text-slate-400">Historical · read only</span> },
  ];

  if (isLoading) return <LoadingState label="Loading assigned subjects..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-7">
      <PageHeader
        actions={<Button disabled={!selectedSubject} onClick={beginCreate}><Plus aria-hidden="true" size={17} />Enter marks</Button>}
        description="Enter marks for ISA 1, ISA 2, or ESA. Historical assessment records remain visible and unchanged."
        eyebrow="ASSESSMENTS"
        title="Marks management"
      />
      <Card><div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="marks-subject" label="Assigned subject" onChange={(value) => { setSubjectId(value); beginCreate(); }} options={(subjects || []).map((subject) => ({ value: String(subject.subject_id), label: `${subject.subject_code} · ${subject.subject_name}` }))} required value={subjectId} />
        <SelectField id="marks-examination-filter" label="Filter examinations" onChange={setAssessmentFilter} options={ASSESSMENT_FILTERS} value={assessmentFilter} />
      </div></Card>
      {selectedSubject && <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section className="space-y-3">
          <div><h2 className="text-base font-semibold text-slate-900">Saved marks</h2><p className="mt-1 text-sm text-slate-500">{selectedSubject.subject_code} · {visibleMarks.length} records shown</p></div>
          {isLoadingMarks && <LoadingState label="Loading marks..." />}
          {!isLoadingMarks && marksError && <ErrorState message={marksError} onRetry={loadMarks} />}
          {!isLoadingMarks && !marksError && <DataTable columns={columns} emptyDescription={assessmentFilter === "historical" ? "No historical assessment records exist for this subject." : assessmentFilter === "all" ? "Marks entered for this subject will appear here." : `No ${assessmentFilter} marks have been recorded for this subject.`} emptyTitle="No marks recorded" getRowKey={(mark) => mark.mark_id} rows={visibleMarks} />}
        </section>
        <Card>
          <h2 className="font-semibold text-slate-900">{editingMark ? "Update assessment marks" : "Enter assessment marks"}</h2>
          <p className="mt-1 text-sm text-slate-500">Only students enrolled in this assigned subject are selectable.</p>
          <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); setFormError(""); setConfirmSave(true); }}>
            <SelectField id="marks-student" label="Enrolled student" onChange={(student_id) => setForm((value) => ({ ...value, student_id }))} options={selectedSubject.students.map((student) => ({ value: String(student.student_id), label: `${student.registration_number} · ${student.first_name} ${student.last_name}` }))} required value={form.student_id} />
            <SelectField id="assessment-name" label="Examination" onChange={(assessment_name) => setForm((value) => ({ ...value, assessment_name }))} options={ASSESSMENTS.map((name) => ({ value: name, label: name }))} placeholder="Select examination" required value={form.assessment_name} />
            <div className="grid grid-cols-2 gap-3">
              <FormField id="marks-obtained" label="Marks obtained" max="9999.99" min="0" onChange={(event) => setForm((value) => ({ ...value, marks_obtained: event.target.value }))} required step="0.01" type="number" value={form.marks_obtained} />
              <FormField id="marks-maximum" label="Maximum marks" max="9999.99" min="0.01" onChange={(event) => setForm((value) => ({ ...value, max_marks: event.target.value }))} required step="0.01" type="number" value={form.max_marks} />
            </div>
            {formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2">
              {editingMark && <Button onClick={beginCreate} type="button" variant="secondary">Cancel edit</Button>}
              <Button disabled={isSaving || !selectedSubject.students.length} type="submit"><Save aria-hidden="true" size={15} />Review save</Button>
            </div>
          </form>
        </Card>
      </div>}
      {confirmSave && <ConfirmDialog confirmLabel={editingMark ? "Update marks" : "Save marks"} isBusy={isSaving} message={`${editingMark ? "Update" : "Save"} ${form.assessment_name.trim()} for ${selectedSubject?.students.find((student) => String(student.student_id) === form.student_id)?.registration_number || "the selected student"} as ${form.marks_obtained} / ${form.max_marks}?`} onCancel={() => !isSaving && setConfirmSave(false)} onConfirm={saveMark} title={editingMark ? "Confirm marks update" : "Confirm marks entry"} />}
    </div>
  );
}
