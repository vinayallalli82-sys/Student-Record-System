import { useMemo } from "react";
import { Activity, Bell, BookOpenCheck, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import { useAuth } from "../../context/useAuth.js";
import useStudentOverview from "../../hooks/useStudentOverview.js";

function attendanceSummary(records) {
  const present = records.filter((record) => record.status === "Present").length;
  const absent = records.filter((record) => record.status === "Absent").length;
  return {
    present,
    absent,
    total: records.length,
    percentage: records.length ? (present / records.length) * 100 : null,
  };
}

export default function StudentOverviewPage() {
  const { user } = useAuth();
  const { data, error, isLoading, reload } = useStudentOverview();
  const summary = useMemo(
    () => attendanceSummary(data?.attendance?.data || []),
    [data],
  );
  const recentNotifications = (data?.notifications?.data || []).slice(0, 4);
  const failures = [
    data?.profile?.error && `Profile: ${data.profile.error}`,
    data?.attendance?.error && `Attendance: ${data.attendance.error}`,
    data?.notifications?.error && `Notifications: ${data.notifications.error}`,
    data?.cgpa?.error && data.cgpa.error.includes("No marks available")
      ? "CGPA is unavailable until marks have been recorded."
      : data?.cgpa?.error,
  ].filter(Boolean);

  if (isLoading) return <LoadingState label="Loading your academic overview..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const metrics = [
    {
      label: "Attendance percentage",
      value: summary.percentage === null ? "—" : `${summary.percentage.toFixed(1)}%`,
      icon: Activity,
      detail: `${summary.present} present · ${summary.absent} absent`,
    },
    {
      label: "Allocated subjects",
      value: data.profile.data?.subjects.length ?? "—",
      icon: BookOpenCheck,
      detail: data.profile.data?.subjects.length ? "From your subject allocations" : "No allocations recorded",
    },
    {
      label: "CGPA",
      value: data.cgpa.data?.cgpa ?? "—",
      icon: GraduationCap,
      detail: data.cgpa.data ? `${data.cgpa.data.total_credits} credits` : "Not currently available",
    },
    {
      label: "Notifications",
      value: data.notifications.data.length,
      icon: Bell,
      detail: "Available to your account",
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        description={`Welcome back. Here is the information currently available for ${user?.email || "your student account"}.`}
        eyebrow="STUDENT WORKSPACE"
        title="Academic overview"
      />
      {failures.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          {failures.map((failure) => <p key={failure}>{failure}</p>)}
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, detail }) => (
          <Card key={label}>
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-800"><Icon aria-hidden="true" size={19} /></span>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </Card>
        ))}
      </div>
      <Card className="border-blue-100 bg-blue-50/60">
        <h2 className="font-semibold text-slate-900">Profile and enrollment information</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {data.profile.data
            ? `${data.profile.data.first_name} ${data.profile.data.last_name || ""} · ${data.profile.data.registration_number} · ${data.profile.data.course}. You have ${data.profile.data.subjects.length} allocated subjects across ${new Set(data.profile.data.subjects.map((subject) => subject.semester_number)).size} semester${new Set(data.profile.data.subjects.map((subject) => subject.semester_number)).size === 1 ? "" : "s"}.`
            : "Your profile and enrollment details are unavailable."}
        </p>
        <Link className="mt-3 inline-flex text-sm font-semibold text-brand-800 hover:text-brand-950" to="/student/subjects">
          View allocated subjects
        </Link>
      </Card>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent notifications</h2>
            <p className="mt-1 text-sm text-slate-500">Latest notifications available to your student account.</p>
          </div>
          <Link className="text-sm font-semibold text-brand-800 hover:text-brand-950" to="/student/notifications">View all</Link>
        </div>
        <DataTable
          columns={[
            { key: "message", label: "Notification" },
            { key: "attendance_percentage", label: "Attendance", render: (item) => `${item.attendance_percentage}%` },
            { key: "created_at", label: "Received", render: (item) => new Date(item.created_at).toLocaleString() },
          ]}
          emptyDescription="New notifications will appear here."
          emptyTitle="No notifications"
          getRowKey={(item) => item.notification_id}
          rows={recentNotifications}
        />
      </section>
    </div>
  );
}
