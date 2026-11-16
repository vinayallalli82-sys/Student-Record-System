import {
  BookOpenCheck,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  LayoutDashboard,
  Link2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  UsersRound,
  UserRound,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import Button from "../common/Button.jsx";

const roleTitles = {
  Administrator: "Administration",
  Faculty: "Faculty workspace",
  Student: "Student workspace",
};

const adminNavigation = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "User Management", to: "/admin/users", icon: Users },
  { label: "Student Management", to: "/admin/students", icon: GraduationCap },
  { label: "Subject Management", to: "/admin/subjects", icon: BookOpenCheck },
  { label: "Faculty Assignments", to: "/admin/faculty-assignments", icon: Link2 },
  { label: "Student Allocations", to: "/admin/student-allocations", icon: UsersRound },
  { label: "Semester Overview", to: "/admin/semesters", icon: CalendarDays },
];

const facultyNavigation = [
  { label: "Overview", to: "/faculty", icon: LayoutDashboard, end: true },
  { label: "My Subjects", to: "/faculty/subjects", icon: BookOpenCheck },
  { label: "Students", to: "/faculty/students", icon: GraduationCap },
  { label: "Attendance", to: "/faculty/attendance", icon: ClipboardCheck },
  { label: "Attendance Reports", to: "/faculty/attendance-reports", icon: CalendarDays },
  { label: "Marks Management", to: "/faculty/marks", icon: NotebookPen },
  { label: "Marks Summary", to: "/faculty/marks-summary", icon: ChartNoAxesCombined },
];

const studentNavigation = [
  { label: "Overview", to: "/student", icon: LayoutDashboard, end: true },
  { label: "My Profile", to: "/student/profile", icon: UserRound },
  { label: "My Subjects", to: "/student/subjects", icon: BookOpenCheck },
  { label: "Attendance", to: "/student/attendance", icon: ClipboardCheck },
  { label: "Academic Records", to: "/student/academic-records", icon: NotebookPen },
  { label: "GPA and CGPA", to: "/student/gpa", icon: ChartNoAxesCombined },
  { label: "Notifications", to: "/student/notifications", icon: Bell },
  { label: "Download Reports", to: "/student/reports", icon: FileDown },
];

export default function Sidebar({
  open,
  onClose,
  collapsed = false,
  onToggleCollapse,
}) {
  const { user } = useAuth();
  const navigation = user?.role === "Administrator"
    ? adminNavigation
    : user?.role === "Faculty"
      ? facultyNavigation
      : user?.role === "Student"
        ? studentNavigation
        : [];

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:static lg:z-auto lg:translate-x-0 ${collapsed ? "lg:w-[82px]" : "lg:w-[272px]"} ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex h-[76px] items-center justify-between border-b border-slate-100 px-6 ${collapsed ? "lg:justify-center lg:px-3" : ""}`}>
          <NavLink
            aria-label="Student Record System home"
            className={`flex items-center ${collapsed ? "gap-3 lg:gap-0" : "gap-3"}`}
            onClick={onClose}
            to="/"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-brand-700 text-white shadow-sm">
              <BookOpenCheck aria-hidden="true" size={21} />
            </span>
            <span className={collapsed ? "lg:hidden" : ""}>
              <span className="block text-sm font-bold tracking-tight text-slate-900">
                Campus
              </span>
              <span className="block text-xs text-slate-500">Record system</span>
            </span>
          </NavLink>
          <Button
            aria-label="Close navigation"
            className="lg:hidden"
            onClick={onClose}
            variant="ghost"
          >
            <X aria-hidden="true" size={19} />
          </Button>
        </div>

        <nav aria-label="Main navigation" className={`flex-1 overflow-y-auto pt-7 ${collapsed ? "px-5 lg:px-3" : "px-5"}`}>
          <p className={`px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}>
            Workspace
          </p>
          <div className={`space-y-1 ${collapsed ? "mt-3 lg:mt-0" : "mt-3"}`}>
            {navigation.map(({ label, to, icon: Icon, end }) => (
              <NavLink
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-xl py-2.5 text-sm font-semibold transition ${collapsed ? "gap-3 px-3 lg:justify-center lg:gap-0 lg:px-0" : "gap-3 px-3"} ${isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`
                }
                end={end}
                key={to}
                onClick={onClose}
                title={collapsed ? label : undefined}
                to={to}
              >
                <Icon aria-hidden="true" size={18} />
                <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className={`border-t border-slate-100 ${collapsed ? "p-5 lg:p-3" : "p-5"}`}>
          <div className={`rounded-2xl bg-slate-50 p-4 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="text-xs font-semibold text-slate-500">Signed in as</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {user?.email}
            </p>
            <span className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-slate-200">
              {roleTitles[user?.role] || user?.role}
            </span>
          </div>
          <Button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`mt-3 hidden w-full lg:flex ${collapsed ? "justify-center px-0" : "justify-start"}`}
            onClick={onToggleCollapse}
            variant="ghost"
          >
            {collapsed
              ? <PanelLeftOpen aria-hidden="true" size={18} />
              : <PanelLeftClose aria-hidden="true" size={18} />}
            {!collapsed && <span>Collapse menu</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
