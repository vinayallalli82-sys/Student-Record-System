import { useCallback } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Link2,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { adminApi } from "../../api/admin.js";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import useAdminQuery from "../../hooks/useAdminQuery.js";

const metricCards = [
  { key: "users", label: "Total users", icon: Users, tone: "blue", href: "/admin/users" },
  { key: "students", label: "Total students", icon: GraduationCap, tone: "violet", href: "/admin/students" },
  { key: "facultyAssignments", label: "Faculty assignments", icon: Link2, tone: "cyan", href: "/admin/faculty-assignments" },
  { key: "studentAllocations", label: "Student allocations", icon: BookOpen, tone: "amber", href: "/admin/student-allocations" },
  { key: "semesters", label: "Semesters", icon: CalendarDays, tone: "emerald", href: "/admin/semesters" },
];

const iconTones = {
  blue: "bg-blue-50 text-blue-700",
  violet: "bg-violet-50 text-violet-700",
  cyan: "bg-cyan-50 text-cyan-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
};

export default function AdminOverviewPage() {
  const loadOverview = useCallback(async () => {
    const [users, students, facultyAssignments, studentAllocations, semesters] =
      await Promise.all([
        adminApi.users(),
        adminApi.students(),
        adminApi.facultyAssignments(),
        adminApi.studentAllocations(),
        adminApi.semesters(),
      ]);

    return {
      users,
      students,
      facultyAssignments,
      studentAllocations,
      semesters,
    };
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(loadOverview);

  return (
    <div className="space-y-8">
      <PageHeader
        description="A real-time summary of accounts and academic organization."
        eyebrow="ADMINISTRATOR WORKSPACE"
        title="Institution overview"
      />

      {isLoading && <LoadingState label="Loading institution metrics..." />}
      {!isLoading && error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metricCards.map(({ key, label, icon: Icon, tone, href }) => (
              <Link className="group min-w-0" key={key} to={href}>
                <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:shadow-float">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTones[tone]}`}>
                      <Icon aria-hidden="true" size={19} />
                    </span>
                    <ArrowUpRight aria-hidden="true" className="text-slate-300 transition group-hover:text-brand-700" size={17} />
                  </div>
                  <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                    {data[key].length.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Semester timeline</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current academic terms available in the system.
                </p>
              </div>
              <DataTable
                columns={[
                  { key: "semester_number", label: "Semester", render: (semester) => `Semester ${semester.semester_number}` },
                  { key: "academic_year", label: "Academic year" },
                  { key: "start_date", label: "Starts", render: (semester) => semester.start_date || "—" },
                  { key: "end_date", label: "Ends", render: (semester) => semester.end_date || "—" },
                ]}
                emptyDescription="No semester records are available."
                emptyTitle="No semesters yet"
                getRowKey={(semester) => semester.semester_id}
                rows={data.semesters.slice(0, 5)}
              />
            </section>

            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">Account mix</h2>
                  <p className="mt-1 text-sm text-slate-500">Accounts grouped by assigned role.</p>
                </div>
                <Users aria-hidden="true" className="text-slate-400" size={19} />
              </div>
              <div className="mt-6 space-y-5">
                {["Administrator", "Faculty", "Student"].map((role) => {
                  const count = data.users.filter((user) => user.role === role).length;
                  const percentage = data.users.length
                    ? Math.round((count / data.users.length) * 100)
                    : 0;
                  return (
                    <div key={role}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{role}</span>
                        <span className="text-slate-500">
                          {count} <span className="text-slate-400">({percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-700 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
                Summary values are calculated from the existing administrator APIs.
              </p>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active accounts</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {data.users.filter((user) => user.is_active).length.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Of {data.users.length.toLocaleString()} total users</p>
            </Card>
            <Card className="sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distinct subjects with faculty</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {new Set(data.facultyAssignments.map((item) => item.subject_id)).size.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Based on current faculty assignments</p>
            </Card>
            <Card className="sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Allocated students</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {new Set(data.studentAllocations.map((item) => item.student_id)).size.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Students with at least one subject allocation</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
