import { useMemo, useState } from "react";
import { BookOpenCheck } from "lucide-react";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import useFacultyWorkspace from "../../hooks/useFacultyWorkspace.js";

export default function FacultySubjectsPage() {
  const { data: subjects, error, isLoading, reload } = useFacultyWorkspace();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (subjects || []).filter((subject) =>
      [subject.subject_code, subject.subject_name, subject.semester_id]
        .some((value) => String(value ?? "").toLowerCase().includes(needle)),
    );
  }, [subjects, search]);

  return (
    <div className="space-y-7">
      <PageHeader description="Subjects are included only after the backend confirms your faculty access." eyebrow="TEACHING" title="My subjects" />
      {isLoading && <LoadingState label="Checking your subject assignments..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && <>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput onChange={setSearch} placeholder="Search subject code, name, or semester ID" value={search} />
          <span className="text-sm text-slate-500">{filtered.length} assigned subjects</span>
        </Card>
        <DataTable
          columns={[
            { key: "subject_code", label: "Subject", render: (subject) => <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-brand-700"><BookOpenCheck aria-hidden="true" size={17} /></span><div><p className="font-semibold text-slate-800">{subject.subject_code}</p><p className="text-xs text-slate-400">{subject.subject_name}</p></div></div> },
            { key: "credits", label: "Credits" },
            { key: "semester_id", label: "Semester", render: (subject) => `Semester record ID ${subject.semester_id}` },
            { key: "students", label: "Enrolled students", render: (subject) => subject.students.length },
          ]}
          emptyDescription="No subjects are assigned to your account, or no subjects are available."
          emptyTitle="No assigned subjects"
          getRowKey={(subject) => subject.subject_id}
          rows={filtered}
        />
      </>}
    </div>
  );
}
