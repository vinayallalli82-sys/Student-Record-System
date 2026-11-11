import { useCallback, useEffect, useMemo, useState } from "react";
import { facultyApi } from "../../api/faculty.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

const ASSESSMENTS = ["ISA 1", "ISA 2", "ESA"];
const ASSESSMENT_FILTERS = [
  { value: "all", label: "All examinations" },
  ...ASSESSMENTS.map((name) => ({ value: name, label: name })),
  { value: "historical", label: "Historical assessments" },
];
const matchesAssessment = (assessment, filter) => filter === "all"
  || (filter === "historical" ? !ASSESSMENTS.includes(assessment.assessment_name) : assessment.assessment_name === filter);

export default function FacultyMarksSummaryPage() {
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [subjectId, setSubjectId] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!subjectId) {
      setSummary(null);
      return;
    }
    setIsLoadingSummary(true);
    setSummaryError("");
    try {
      const result = await facultyApi.marksSummary(subjectId);
      if (!result || !Array.isArray(result.students)) {
        throw new Error("The marks summary API returned an unexpected response.");
      }
      setSummary(result);
    } catch (loadError) {
      setSummaryError(loadError.message);
      setSummary(null);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [subjectId]);

  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const filteredAssessments = useMemo(
    () => (summary?.students || []).flatMap((student) =>
      student.assessments.filter((assessment) => matchesAssessment(assessment, assessmentFilter))),
    [assessmentFilter, summary],
  );
  const rows = useMemo(() => (summary?.students || []).flatMap((student) => {
    const assessmentsForFilter = student.assessments.filter((assessment) =>
      matchesAssessment(assessment, assessmentFilter));
    if (!assessmentsForFilter.length) {
      return [{
        key: `${student.student_id}-none-${assessmentFilter}`,
        registration_number: student.registration_number,
        name: `${student.first_name} ${student.last_name || ""}`.trim(),
        assessment_name: assessmentFilter === "all" ? "No marks recorded"
          : assessmentFilter === "historical" ? "No historical marks recorded"
            : `No ${assessmentFilter} marks recorded`,
        score: "—",
        percentage: "—",
      }];
    }
    return assessmentsForFilter.map((assessment) => ({
      key: `${student.student_id}-${assessment.assessment_name}`,
      registration_number: student.registration_number,
      name: `${student.first_name} ${student.last_name || ""}`.trim(),
      assessment_name: assessment.assessment_name,
      score: `${assessment.marks_obtained} / ${assessment.max_marks}`,
      percentage: `${((assessment.marks_obtained / assessment.max_marks) * 100).toFixed(1)}%`,
    }));
  }), [assessmentFilter, summary]);

  if (isLoading) return <LoadingState label="Loading assigned subjects..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const average = filteredAssessments.length
    ? filteredAssessments.reduce((sum, item) => sum + (item.marks_obtained / item.max_marks) * 100, 0) / filteredAssessments.length
    : null;

  return (
    <div className="space-y-7">
      <PageHeader description="Assessment-level results and derived score percentages from the authorized subject summary." eyebrow="ASSESSMENTS" title="Marks summary" />
      <Card><div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="summary-subject" label="Assigned subject" onChange={setSubjectId} options={(subjects || []).map((subject) => ({ value: String(subject.subject_id), label: `${subject.subject_code} · ${subject.subject_name}` }))} required value={subjectId} />
        <SelectField id="summary-examination-filter" label="Filter examinations" onChange={setAssessmentFilter} options={ASSESSMENT_FILTERS} value={assessmentFilter} />
      </div></Card>
      {summaryError && <ErrorState message={summaryError} onRetry={loadSummary} />}
      {isLoadingSummary && <LoadingState label="Loading marks summary..." />}
      {summary && !isLoadingSummary && <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enrolled students</p><p className="mt-3 text-2xl font-semibold">{summary.students.length}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessment records</p><p className="mt-3 text-2xl font-semibold">{filteredAssessments.length}</p></Card>
          <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average percentage</p><p className="mt-3 text-2xl font-semibold">{average === null ? "—" : `${average.toFixed(1)}%`}</p><p className="mt-1 text-xs text-slate-500">Mean of actual assessment percentages</p></Card>
        </div>
        <section className="space-y-3">
          <div><h2 className="text-base font-semibold text-slate-900">{summary.subject.subject_code} · {summary.subject.subject_name}</h2><p className="mt-1 text-sm text-slate-500">{summary.message} · {assessmentFilter === "all" ? "All examinations" : assessmentFilter === "historical" ? "Historical assessments" : assessmentFilter}</p></div>
          <DataTable columns={[
            { key: "registration_number", label: "Student", render: (row) => <div><p className="font-semibold">{row.name}</p><p className="text-xs text-slate-400">{row.registration_number}</p></div> },
            { key: "assessment_name", label: "Assessment" },
            { key: "score", label: "Score" },
            { key: "percentage", label: "Percentage" },
          ]} emptyDescription="No enrolled students were returned for this subject." emptyTitle="No summary rows" getRowKey={(row) => row.key} rows={rows} />
        </section>
      </>}
    </div>
  );
}
