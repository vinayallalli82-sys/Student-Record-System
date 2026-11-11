import { useCallback, useMemo, useState } from "react";
import { Eye, GraduationCap } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import FormField from "../../components/common/FormField.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

export default function StudentsPage() {
  const query = useCallback(async () => {
    const [students, orphanAccounts] = await Promise.all([
      adminApi.students(),
      adminApi.orphanStudentAccounts(),
    ]);
    if (!Array.isArray(students) || !Array.isArray(orphanAccounts)) {
      throw new Error("The students API returned an unexpected response.");
    }
    return { students, orphanAccounts };
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const students = data?.students ?? [];
  const orphanAccounts = data?.orphanAccounts ?? [];
  const { setNotice } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [reconcilingAccount, setReconcilingAccount] = useState(null);
  const [profileForm, setProfileForm] = useState({
    registration_number: "", first_name: "", last_name: "", course: "", admission_year: "",
  });
  const [profileError, setProfileError] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students.filter((student) => [
      student.registration_number,
      student.first_name,
      student.last_name,
      student.student_id,
      student.email,
      student.course,
    ].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [students, search]);

  async function viewDetails(student) {
    setSelectedStudent(student);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await adminApi.student(student.student_id));
    } catch (loadError) {
      setDetailError(loadError.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function reconcileProfile(event) {
    event.preventDefault();
    if (!reconcilingAccount) return;
    setProfileError("");
    setIsReconciling(true);
    try {
      await adminApi.createStudentProfile(reconcilingAccount.user_id, {
        registration_number: profileForm.registration_number.trim(),
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        course: profileForm.course.trim(),
        admission_year: Number(profileForm.admission_year),
      });
      setNotice({ type: "success", message: `Student profile created for ${reconcilingAccount.email}.` });
      setReconcilingAccount(null);
      setProfileForm({ registration_number: "", first_name: "", last_name: "", course: "", admission_year: "" });
      reload();
    } catch (saveError) {
      setProfileError(saveError.message);
    } finally {
      setIsReconciling(false);
    }
  }

  const columns = [
    {
      key: "registration_number",
      label: "Student",
      render: (student) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-violet-50 text-violet-700">
            <GraduationCap aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{student.first_name} {student.last_name}</p>
            <p className="text-xs text-slate-400">{student.registration_number}</p>
          </div>
        </div>
      ),
    },
    { key: "email", label: "Email" },
    { key: "course", label: "Course / department" },
    { key: "admission_year", label: "Admission year" },
    {
      key: "actions",
      label: "",
      render: (student) => (
        <Button className="px-3 py-1.5" onClick={() => viewDetails(student)} variant="secondary">
          <Eye aria-hidden="true" size={15} />
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        description="Browse student profiles and safely complete profiles for existing Student accounts that are missing one."
        eyebrow="ACADEMIC RECORDS"
        title="Student management"
      />
      {isLoading && <LoadingState label="Loading student records..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput onChange={setSearch} placeholder="Search name, registration number, email, course or ID" value={search} />
              <span className="shrink-0 text-sm text-slate-500">{filteredStudents.length} students</span>
            </div>
          </Card>
          <DataTable
            columns={columns}
            emptyDescription={students.length ? "Try a different search term." : "Student profile records will appear here."}
            emptyTitle={students.length ? "No matching students" : "No students found"}
            getRowKey={(student) => student.student_id}
            rows={filteredStudents}
          />
          {orphanAccounts.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Student accounts needing profiles</h2>
                <p className="mt-1 text-sm text-slate-500">These existing accounts have no linked student profile. Enter verified information to reconcile each account; no profile data is generated automatically.</p>
              </div>
              <DataTable
                columns={[
                  { key: "email", label: "Student account" },
                  { key: "is_active", label: "Account status", render: (account) => account.is_active ? "Active" : "Inactive" },
                  {
                    key: "action",
                    label: "",
                    render: (account) => (
                      <Button
                        onClick={() => {
                          setProfileError("");
                          setProfileForm({ registration_number: "", first_name: "", last_name: "", course: "", admission_year: "" });
                          setReconcilingAccount(account);
                        }}
                        variant="secondary"
                      >
                        Complete profile
                      </Button>
                    ),
                  },
                ]}
                emptyDescription="All Student accounts have linked profiles."
                emptyTitle="No orphan Student accounts"
                getRowKey={(account) => account.user_id}
                rows={orphanAccounts}
              />
            </section>
          )}
        </>
      )}

      {selectedStudent && (
        <Modal
          description={`Profile information for ${selectedStudent.registration_number}.`}
          onClose={() => setSelectedStudent(null)}
          title="Student details"
        >
          {detailLoading && <div className="grid min-h-32 place-items-center"><p className="text-sm text-slate-500">Loading student details...</p></div>}
          {detailError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{detailError}</p>}
          {detail && (
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {[
                ["Registration number", detail.registration_number],
                ["First name", detail.first_name],
                ["Last name", detail.last_name],
                ["Email", detail.email],
                ["Course", detail.course],
                ["Admission year", detail.admission_year],
                ["Date of birth", detail.date_of_birth],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Modal>
      )}
      {reconcilingAccount && (
        <Modal
          description={`Provide verified profile details for the existing account ${reconcilingAccount.email}.`}
          onClose={() => !isReconciling && setReconcilingAccount(null)}
          title="Complete Student profile"
        >
          <form className="space-y-4" onSubmit={reconcileProfile}>
            <FormField id="reconcile-registration" label="Registration number" onChange={(event) => setProfileForm((value) => ({ ...value, registration_number: event.target.value }))} required value={profileForm.registration_number} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="reconcile-first-name" label="First name" onChange={(event) => setProfileForm((value) => ({ ...value, first_name: event.target.value }))} required value={profileForm.first_name} />
              <FormField id="reconcile-last-name" label="Last name" onChange={(event) => setProfileForm((value) => ({ ...value, last_name: event.target.value }))} value={profileForm.last_name} />
            </div>
            <FormField id="reconcile-course" label="Course / department" onChange={(event) => setProfileForm((value) => ({ ...value, course: event.target.value }))} required value={profileForm.course} />
            <FormField id="reconcile-admission-year" label="Admission year" max="9999" min="1" onChange={(event) => setProfileForm((value) => ({ ...value, admission_year: event.target.value }))} required type="number" value={profileForm.admission_year} />
            <p className="text-xs leading-5 text-slate-500">The existing schema has Course and Admission year fields, but no separate Department field. Registration number must be unique.</p>
            {profileError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{profileError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isReconciling} onClick={() => setReconcilingAccount(null)} type="button" variant="secondary">Cancel</Button>
              <Button disabled={isReconciling} type="submit">{isReconciling ? "Saving profile..." : "Create profile"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
