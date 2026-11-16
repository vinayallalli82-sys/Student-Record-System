import { ArrowUpRight, BookOpenCheck, CalendarDays, UsersRound } from "lucide-react";
import Card from "../components/common/Card.jsx";
import DataTable from "../components/common/DataTable.jsx";
import { useAuth } from "../context/useAuth.js";

const roleContent = {
  Administrator: {
    eyebrow: "ADMINISTRATOR WORKSPACE",
    title: "Institution overview",
    description: "Your administrative workspace is ready.",
    cards: [
      { label: "User management", detail: "Account administration" },
      { label: "Academic setup", detail: "Semesters and subjects" },
      { label: "Course assignments", detail: "Faculty and student allocation" },
    ],
  },
  Faculty: {
    eyebrow: "FACULTY WORKSPACE",
    title: "Teaching overview",
    description: "Your faculty workspace is ready.",
    cards: [
      { label: "Assigned subjects", detail: "Subject workspace" },
      { label: "Attendance", detail: "Class records" },
      { label: "Assessments", detail: "Marks and performance" },
    ],
  },
  Student: {
    eyebrow: "STUDENT WORKSPACE",
    title: "Academic overview",
    description: "Your student workspace is ready.",
    cards: [
      { label: "Attendance", detail: "Attendance overview" },
      { label: "Academic records", detail: "Subjects and assessments" },
      { label: "Notifications", detail: "Academic updates" },
    ],
  },
};

const icons = [UsersRound, CalendarDays, BookOpenCheck];

export default function RoleDashboard({ role }) {
  const { user } = useAuth();
  const content = roleContent[role];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-brand-700">
            {content.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {content.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {content.description} Welcome, {user?.email}.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Signed in
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {content.cards.map((item, index) => {
          const Icon = icons[index];
          return (
            <Card className="group transition hover:-translate-y-0.5 hover:shadow-float" key={item.label}>
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-800">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <ArrowUpRight aria-hidden="true" className="text-slate-300 transition group-hover:text-brand-700" size={18} />
              </div>
              <h2 className="mt-6 font-semibold text-slate-900">{item.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
                Feature pages will be added in the next phase.
              </p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Activity will appear here when the role pages are connected to the existing APIs.
            </p>
          </div>
          <DataTable
            columns={[
              { key: "activity", label: "Activity" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status" },
            ]}
            emptyDescription="No activity is loaded in the foundation phase."
            emptyTitle="No recent activity"
            rows={[]}
          />
        </section>

        <Card className="flex flex-col justify-between bg-brand-950 text-white">
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-blue-200">
              YOUR WORKSPACE
            </p>
            <h2 className="mt-3 text-xl font-semibold">Built around your role</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100/70">
              Your account is authenticated by the existing Student Record
              System session.
            </p>
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-sm text-blue-100">
            <BookOpenCheck aria-hidden="true" size={17} />
            <span>{role}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
