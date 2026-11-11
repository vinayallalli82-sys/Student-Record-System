import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import useStudentProfile from "../../hooks/useStudentProfile.js";

export default function StudentProfilePage() {
  const { data: profile, error, isLoading, reload } = useStudentProfile();

  if (isLoading) return <LoadingState label="Loading your profile..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-7">
      <PageHeader
        description="Your student profile and allocated subjects, resolved from your authenticated account."
        eyebrow="STUDENT WORKSPACE"
        title="My profile"
      />
      <Card>
        <h2 className="font-semibold text-slate-900">Account information</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student name</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.first_name} {profile.last_name || ""}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registration number</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.registration_number}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.email}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.course}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date of birth</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.date_of_birth || "Not recorded"}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admission year</dt><dd className="mt-1 text-sm font-medium text-slate-900">{profile.admission_year}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocated semesters</dt><dd className="mt-1 text-sm font-medium text-slate-900">{[...new Set(profile.subjects.map((subject) => `Semester ${subject.semester_number} · ${subject.academic_year}`))].join(", ") || "No subject allocations"}</dd></div>
        </dl>
      </Card>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Allocated subjects</h2>
        <DataTable
          columns={[
            { key: "subject_code", label: "Code" },
            { key: "subject_name", label: "Subject" },
            { key: "credits", label: "Credits" },
            { key: "semester_number", label: "Semester" },
            { key: "academic_year", label: "Academic year" },
          ]}
          emptyDescription="Subject allocations for your account will appear here."
          emptyTitle="No allocated subjects"
          getRowKey={(subject) => subject.subject_id}
          rows={profile.subjects}
        />
      </section>
    </div>
  );
}
