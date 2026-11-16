import { useCallback } from "react";
import { studentApi } from "../../api/student.js";
import { ApiError } from "../../api/client.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import useAdminQuery from "../../hooks/useAdminQuery.js";

export default function StudentGpaPage() {
  const query = useCallback(async () => {
    const profile = await studentApi.profile();
    if (!profile?.student_id || !Array.isArray(profile.subjects)) {
      throw new Error("The student profile API returned an unexpected response.");
    }

    const semesterNumbers = [...new Set(profile.subjects.map((subject) => subject.semester_number))].sort((a, b) => a - b);
    const [cgpaResult, semesterResults] = await Promise.all([
      studentApi.cgpa(profile.student_id).then((result) => {
        if (result?.status !== "success" || !Array.isArray(result.subjects)) {
          throw new Error(result?.message || "The CGPA API returned an unexpected response.");
        }
        return { result };
      }).catch((requestError) => {
        if (
          requestError instanceof ApiError
          && requestError.status === 404
          && requestError.message === "No marks available to calculate CGPA"
        ) {
          return { unavailable: true };
        }
        throw requestError;
      }),
      Promise.all(semesterNumbers.map(async (semesterNumber) => {
        const result = await studentApi.academicRecords(semesterNumber);
        if (result?.status !== "success" || !Array.isArray(result.subjects)) {
          throw new Error(result?.message || `Semester ${semesterNumber} GPA could not be loaded.`);
        }
        return {
          semester: result.semester,
          academic_year: result.academic_year,
          gpa: result.gpa,
          subjects_without_marks: result.subjects_without_marks,
        };
      })),
    ]);

    return {
      cgpa: cgpaResult.result || null,
      cgpaUnavailable: cgpaResult.unavailable || false,
      semesters: semesterResults,
    };
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);

  if (isLoading) return <LoadingState label="Loading your GPA and CGPA..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-7">
      <PageHeader description="GPA and CGPA use the existing server-side grading and credit calculation rules; this page does not calculate grades in the browser." eyebrow="STUDENT WORKSPACE" title="GPA and CGPA" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CGPA</p><p className="mt-3 text-3xl font-semibold text-brand-800">{data.cgpa ? data.cgpa.cgpa : "—"}</p><p className="mt-1 text-sm text-slate-500">{data.cgpa ? `${data.cgpa.total_credits} credits counted` : data.cgpaUnavailable ? "Unavailable until marks are recorded" : "No marked subjects returned"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semester GPAs available</p><p className="mt-3 text-3xl font-semibold text-slate-900">{data.semesters.filter((item) => item.gpa).length}</p><p className="mt-1 text-sm text-slate-500">Based on your allocated semesters and recorded marks</p></Card>
      </div>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Semester GPA</h2>
        <DataTable
          columns={[
            { key: "semester", label: "Semester", render: (item) => `Semester ${item.semester}` },
            { key: "academic_year", label: "Academic year" },
            { key: "gpa", label: "GPA", render: (item) => item.gpa ? item.gpa.gpa : "—" },
            { key: "credits", label: "Credits counted", render: (item) => item.gpa ? item.gpa.total_credits : "—" },
            { key: "missing", label: "Subjects without marks", render: (item) => item.subjects_without_marks.length ? item.subjects_without_marks.join(", ") : "None" },
          ]}
          emptyDescription="Semester GPA will appear when semester subjects are allocated."
          emptyTitle="No allocated semesters"
          getRowKey={(item) => `${item.semester}-${item.academic_year}`}
          rows={data.semesters}
        />
      </section>
      {data.cgpa && (
        <DataTable
          columns={[
            { key: "code", label: "Subject code" },
            { key: "credits", label: "Credits" },
          ]}
          emptyDescription="Subject credit details will appear when marks are available."
          emptyTitle="No CGPA subject details"
          getRowKey={(item) => item.code}
          rows={data.cgpa.subjects}
        />
      )}
      <Card className="text-sm leading-6 text-slate-600">
        Missing assessment results are handled by the existing GPA services: recorded assessment marks are aggregated per subject, and subjects with no marks are excluded from GPA rather than assigned an invented grade. Historical assessment records remain part of the existing calculation.
      </Card>
    </div>
  );
}
