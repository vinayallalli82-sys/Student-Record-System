import { useState } from "react";
import { studentApi } from "../../api/student.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SelectField from "../../components/common/SelectField.jsx";

const ASSESSMENTS = ["ISA 1", "ISA 2", "ESA"];
const ASSESSMENT_FILTERS = [
  { value: "all", label: "All Examinations" },
  ...ASSESSMENTS.map((name) => ({ value: name, label: name })),
  { value: "historical", label: "Historical assessments" },
];
const matchesAssessment = (assessment, filter) => filter === "all"
  || (filter === "historical" ? !ASSESSMENTS.includes(assessment.assessment_name) : assessment.assessment_name === filter);

export default function StudentAcademicRecordsPage() {
  const [semester, setSemester] = useState("");
  const [assessmentFilter, setAssessmentFilter] = useState("all");
  const [records, setRecords] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadRecords(event) {
    event.preventDefault();
    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
      setError("Enter a semester number from 1 to 12.");
      setRecords(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setRecords(null);
    try {
      const result = await studentApi.academicRecords(semesterNumber);
      if (result?.status !== "success" || !Array.isArray(result.subjects)) {
        throw new Error("The academic records API returned an unexpected response.");
      }
      setRecords(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  const assessments = (records?.subjects || []).flatMap((subject) =>
    subject.assessments.map((assessment) => ({
      ...assessment,
      subject_id: subject.subject_id,
      subject_code: subject.subject_code,
      subject_name: subject.subject_name,
    })),
  ).filter((assessment) => matchesAssessment(assessment, assessmentFilter));

  return (
    <div className="space-y-7">
      <PageHeader
        description="Assessment results and subject totals provided by the student-only academic records API."
        eyebrow="STUDENT WORKSPACE"
        title="Academic records"
      />
      <Card>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={loadRecords}>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="academic-semester">Semester number</label>
            <input
              className="form-control"
              id="academic-semester"
              max="12"
              min="1"
              onChange={(event) => setSemester(event.target.value)}
              required
              type="number"
              value={semester}
            />
          </div>
          <Button disabled={isLoading} type="submit">{isLoading ? "Loading..." : "Load academic records"}</Button>
        </form>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          The backend requires a semester number but does not provide students with an available-semesters or current-semester endpoint.
        </p>
      </Card>
      {error && <ErrorState message={error} />}
      {isLoading && <LoadingState label="Loading semester records..." />}
      {records && !isLoading && (
        <>
          <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900">Semester {records.semester} · {records.academic_year}</p>
              <p className="mt-1 text-sm text-slate-500">{records.message}</p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>{records.subjects.length} subject records</p>
              <p className="mt-1 font-semibold text-brand-800">Semester GPA: {records.gpa ? records.gpa.gpa : "Not available"}</p>
            </div>
          </Card>
          <section className="space-y-3">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div><h2 className="text-base font-semibold text-slate-900">Assessment results</h2><p className="mt-1 text-sm text-slate-500">Subject totals below continue to include all saved assessment categories.</p></div>
              <div className="w-full sm:max-w-xs">
                <SelectField id="student-examination-filter" label="Filter examinations" onChange={setAssessmentFilter} options={ASSESSMENT_FILTERS} value={assessmentFilter} />
              </div>
            </div>
            <DataTable
              columns={[
                { key: "subject_code", label: "Subject" },
                { key: "assessment_name", label: "Assessment" },
                { key: "score", label: "Score", render: (item) => `${item.marks_obtained} / ${item.max_marks}` },
                { key: "percentage", label: "Percentage", render: (item) => `${item.percentage}%` },
                { key: "grade", label: "Grade" },
                { key: "grade_point", label: "Grade point" },
              ]}
              emptyDescription={assessmentFilter === "historical" ? "No historical assessment records were returned for this semester." : assessmentFilter === "all" ? "No assessment marks have been recorded for this semester." : `No ${assessmentFilter} marks have been recorded for this semester.`}
              emptyTitle="No matching assessment results"
              getRowKey={(item) => `${item.subject_id}-${item.assessment_name}`}
              rows={assessments}
            />
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Subject records</h2>
            <DataTable
              columns={[
                { key: "subject_code", label: "Code" },
                { key: "subject_name", label: "Subject" },
                { key: "credits", label: "Credits" },
                { key: "total_marks_obtained", label: "Marks obtained" },
                { key: "total_max_marks", label: "Maximum marks" },
                { key: "percentage", label: "Percentage", render: (item) => item.percentage === null ? "—" : `${item.percentage}%` },
                { key: "attendance", label: "Attendance", render: (item) => `${item.attendance.percentage}% (${item.attendance.classes_attended}/${item.attendance.total_classes})` },
              ]}
              emptyDescription="No subjects were returned for this semester."
              emptyTitle="No subject records"
              getRowKey={(item) => item.subject_id}
              rows={records.subjects}
            />
          </section>
          {records.subjects_without_marks.length > 0 && (
            <Card className="text-sm leading-6 text-slate-600">
              No marks recorded for: {records.subjects_without_marks.join(", ")}. These subjects are not assigned a grade or included in the semester GPA.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
