import { useCallback, useMemo, useState } from "react";
import { Plus, UserRoundCog } from "lucide-react";
import { adminApi } from "../../api/admin.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import FormField from "../../components/common/FormField.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import Modal from "../../components/common/Modal.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import SearchInput from "../../components/common/SearchInput.jsx";
import SelectField from "../../components/common/SelectField.jsx";
import { useAuth } from "../../context/useAuth.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const roles = ["Student", "Faculty", "Administrator"];

function currentDateInputValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function AccountStatus({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function UsersPage() {
  const { user: currentUser, setNotice } = useAuth();
  const query = useCallback(async () => {
    const users = await adminApi.users();
    if (!Array.isArray(users)) {
      throw new Error("The users API returned an unexpected response.");
    }
    return users;
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const users = data ?? [];
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    role: "Student",
    registration_number: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    course: "",
    admission_year: "",
  });
  const [formError, setFormError] = useState("");
  const [dateOfBirthError, setDateOfBirthError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [pendingUpdate, setPendingUpdate] = useState(null);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch = !needle ||
        item.email.toLowerCase().includes(needle) ||
        String(item.user_id).includes(needle);
      const matchesRole = !roleFilter || item.role === roleFilter;
      const matchesStatus = !statusFilter ||
        String(item.is_active) === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  async function createAccount(event) {
    event.preventDefault();
    setFormError("");
    setDateOfBirthError("");
    if (newAccount.password.length < 8) {
      setFormError("Password must contain at least 8 characters.");
      return;
    }
    if (newAccount.password !== newAccount.confirmPassword) {
      setFormError("The password entries do not match.");
      return;
    }
    if (newAccount.role === "Student") {
      if (!newAccount.date_of_birth) {
        setDateOfBirthError("Date of birth is required.");
        return;
      }
      if (newAccount.date_of_birth > currentDateInputValue()) {
        setDateOfBirthError("Date of birth cannot be in the future.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await adminApi.createUser({
        email: newAccount.email.trim(),
        password: newAccount.password,
        role: newAccount.role,
        ...(newAccount.role === "Student" && {
          student_profile: {
            registration_number: newAccount.registration_number.trim(),
            first_name: newAccount.first_name.trim(),
            last_name: newAccount.last_name.trim(),
            date_of_birth: newAccount.date_of_birth,
            course: newAccount.course.trim(),
            admission_year: Number(newAccount.admission_year),
          },
        }),
      });
      setCreateOpen(false);
      setNewAccount({
        email: "", password: "", confirmPassword: "", role: "Student",
        registration_number: "", first_name: "", last_name: "", date_of_birth: "", course: "", admission_year: "",
      });
      setNotice({
        type: "success",
        message: newAccount.role === "Student"
          ? "Student account and profile created successfully."
          : "User account created successfully.",
      });
      reload();
    } catch (saveError) {
      if (saveError.message.toLowerCase().includes("date of birth")) {
        setDateOfBirthError(saveError.message);
      } else {
        setFormError(saveError.message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function saveUserUpdate() {
    if (!pendingUpdate) return;
    setIsSaving(true);
    try {
      await adminApi.updateUser(pendingUpdate.user.user_id, {
        role: pendingUpdate.role,
        is_active: pendingUpdate.is_active,
      });
      setNotice({ type: "success", message: `Updated ${pendingUpdate.user.email}.` });
      setPendingUpdate(null);
      setEditingUser(null);
      reload();
    } catch (saveError) {
      setNotice({ type: "error", message: saveError.message });
      setPendingUpdate(null);
    } finally {
      setIsSaving(false);
    }
  }

  const columns = [
    {
      key: "email",
      label: "Account",
      render: (item) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-brand-50 text-brand-800">
            <UserRoundCog aria-hidden="true" size={17} />
          </span>
          <div>
            <p className="font-semibold text-slate-800">{item.email}</p>
            <p className="text-xs text-slate-400">ID {item.user_id}</p>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Role", render: (item) => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.role}</span> },
    { key: "is_active", label: "Status", render: (item) => <AccountStatus active={item.is_active} /> },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <Button
          className="px-3 py-1.5"
          onClick={() => setEditingUser({ ...item })}
          variant="secondary"
        >
          Manage
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        actions={
          <Button onClick={() => {
            setFormError("");
            setDateOfBirthError("");
            setCreateOpen(true);
          }}>
            <Plus aria-hidden="true" size={17} />
            Create user
          </Button>
        }
        description="Create accounts, manage roles, and control account access."
        eyebrow="ADMINISTRATION"
        title="User management"
      />

      {isLoading && <LoadingState label="Loading user accounts..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}
      {!isLoading && !error && (
        <>
          <Card className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_190px_180px]">
              <SearchInput onChange={setSearch} placeholder="Search by email or user ID" value={search} />
              <select aria-label="Filter by role" className="form-control" onChange={(event) => setRoleFilter(event.target.value)} value={roleFilter}>
                <option value="">All roles</option>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <select aria-label="Filter by account status" className="form-control" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>{filteredUsers.length} of {users.length} accounts</span>
              <span>{users.filter((item) => item.is_active).length} active accounts</span>
            </div>
          </Card>
          <DataTable
            columns={columns}
            emptyDescription="Try changing your search or filters."
            emptyTitle={users.length ? "No matching accounts" : "No users found"}
            getRowKey={(item) => item.user_id}
            rows={filteredUsers}
          />
        </>
      )}

      {createOpen && (
        <Modal
          description="Student accounts are created together with their required student profile."
          onClose={() => !isSaving && setCreateOpen(false)}
          title="Create user account"
        >
          <form className="space-y-4" onSubmit={createAccount}>
            <FormField
              autoComplete="email"
              id="new-user-email"
              label="Email address"
              onChange={(event) => setNewAccount((value) => ({ ...value, email: event.target.value }))}
              required
              type="email"
              value={newAccount.email}
            />
            <SelectField
              id="new-user-role"
              label="Role"
              onChange={(role) => setNewAccount((value) => ({ ...value, role }))}
              options={roles.map((role) => ({ value: role, label: role }))}
              required
              value={newAccount.role}
            />
            <FormField
              autoComplete="new-password"
              id="new-user-password"
              label="Temporary password"
              minLength={8}
              onChange={(event) => setNewAccount((value) => ({ ...value, password: event.target.value }))}
              required
              type="password"
              value={newAccount.password}
            />
            <FormField
              autoComplete="new-password"
              id="confirm-user-password"
              label="Confirm password"
              onChange={(event) => setNewAccount((value) => ({ ...value, confirmPassword: event.target.value }))}
              required
              type="password"
              value={newAccount.confirmPassword}
            />
            {newAccount.role === "Student" && (
              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Required student profile</p>
                <FormField id="new-student-registration" label="Registration number" onChange={(event) => setNewAccount((value) => ({ ...value, registration_number: event.target.value }))} required value={newAccount.registration_number} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="new-student-first-name" label="First name" onChange={(event) => setNewAccount((value) => ({ ...value, first_name: event.target.value }))} required value={newAccount.first_name} />
                  <FormField id="new-student-last-name" label="Last name" onChange={(event) => setNewAccount((value) => ({ ...value, last_name: event.target.value }))} required value={newAccount.last_name} />
                </div>
                <FormField
                  error={dateOfBirthError}
                  id="new-student-date-of-birth"
                  label="Date of Birth"
                  max={currentDateInputValue()}
                  onChange={(event) => {
                    setNewAccount((value) => ({ ...value, date_of_birth: event.target.value }));
                    setDateOfBirthError("");
                  }}
                  required
                  type="date"
                  value={newAccount.date_of_birth}
                />
                <FormField id="new-student-course" label="Course / department" onChange={(event) => setNewAccount((value) => ({ ...value, course: event.target.value }))} required value={newAccount.course} />
                <FormField id="new-student-admission-year" label="Admission year" max="9999" min="1" onChange={(event) => setNewAccount((value) => ({ ...value, admission_year: event.target.value }))} required type="number" value={newAccount.admission_year} />
                <p className="text-xs leading-5 text-slate-500">The existing schema stores this as Course and Admission year; it has no separate Department field.</p>
              </div>
            )}
            {formError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button disabled={isSaving} onClick={() => setCreateOpen(false)} type="button" variant="secondary">Cancel</Button>
              <Button disabled={isSaving} type="submit">{isSaving ? "Creating..." : "Create account"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal
          description={`Update role or access for ${editingUser.email}.`}
          onClose={() => setEditingUser(null)}
          title="Manage account"
        >
          <div className="space-y-4">
            <SelectField
              id="edit-user-role"
              label="Role"
              onChange={(role) => setEditingUser((value) => ({ ...value, role }))}
              options={roles.map((role) => ({ value: role, label: role }))}
              value={editingUser.role}
            />
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
              <input
                checked={editingUser.is_active}
                className="size-4 accent-[#1d4f9a]"
                onChange={(event) => setEditingUser((value) => ({ ...value, is_active: event.target.checked }))}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">Account active</span>
                <span className="mt-0.5 block text-xs text-slate-500">Inactive accounts cannot sign in.</span>
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditingUser(null)} variant="secondary">Cancel</Button>
              <Button
                onClick={() => setPendingUpdate({
                  user: editingUser,
                  role: editingUser.role,
                  is_active: editingUser.is_active,
                })}
              >
                Save changes
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {pendingUpdate && (
        <ConfirmDialog
          confirmLabel="Confirm update"
          isBusy={isSaving}
          isDangerous={pendingUpdate.user.is_active && !pendingUpdate.is_active}
          message={
            pendingUpdate.user.user_id === currentUser?.user_id && !pendingUpdate.is_active
              ? "You cannot deactivate your own Administrator account. The server will reject this change."
              : `Update ${pendingUpdate.user.email} to ${pendingUpdate.role} and ${pendingUpdate.is_active ? "active" : "inactive"} status?`
          }
          onCancel={() => setPendingUpdate(null)}
          onConfirm={saveUserUpdate}
          title="Confirm account changes"
        />
      )}
    </div>
  );
}
