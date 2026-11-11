import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SemesterSelect from "../../components/common/SemesterSelect.jsx";
import useStudentProfile from "../../hooks/useStudentProfile.js";
import useStudentSemesters from "../../hooks/useStudentSemesters.js";

export default function StudentSubjectsPage() {
  const semesterSelection = useStudentSemesters();
  const {
    data: profile,
    error: profileError,
    isLoading: isLoadingProfile,
    reload: reloadProfile,
  } = useStudentProfile(semesterSelection.selectedSemesterId);

  if (semesterSelection.isLoading) return <LoadingState label="Loading your semesters..." />;
  if (semesterSelection.error) {
    return <ErrorState message={semesterSelection.error} onRetry={semesterSelection.reload} />;
  }
  const profileMatchesSelection = (
    profile?.selectedSemesterId === semesterSelection.selectedSemesterId
  );

  return (
    <div className="space-y-7">
      <PageHeader
        description="View subjects allocated to your account for the selected semester."
        eyebrow="STUDENT WORKSPACE"
        title="My subjects"
      />
      <SemesterSelect
        semesters={semesterSelection.semesters}
        value={semesterSelection.selectedSemesterId}
        onChange={semesterSelection.setSelectedSemesterId}
      />
      {profileError ? (
        <ErrorState message={profileError} onRetry={reloadProfile} />
      ) : isLoadingProfile || !profileMatchesSelection ? (
        <LoadingState label="Loading your allocated subjects..." />
      ) : (
        <DataTable
          columns={[
            { key: "subject_code", label: "Subject code" },
            { key: "subject_name", label: "Subject" },
            { key: "credits", label: "Credits" },
            { key: "semester_number", label: "Semester" },
            { key: "academic_year", label: "Academic year" },
          ]}
          emptyDescription="There are no subjects allocated to you in this semester."
          emptyTitle="No subjects for this semester"
          getRowKey={(subject) => subject.subject_id}
          rows={profile?.subjects || []}
        />
      )}
    </div>
  );
}
