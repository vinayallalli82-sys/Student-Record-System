import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { studentApi } from "../../api/student.js";
import { useAuth } from "../../context/useAuth.js";
import Button from "../common/Button.jsx";

const breadcrumbLabels = {
  admin: "Overview",
  "admin/users": "User Management",
  "admin/students": "Student Management",
  "admin/subjects": "Subject Management",
  "admin/faculty-assignments": "Faculty Assignments",
  "admin/student-allocations": "Student Allocations",
  "admin/semesters": "Semester Overview",
  faculty: "Faculty workspace",
  "faculty/subjects": "My Subjects",
  "faculty/students": "Students",
  "faculty/attendance": "Attendance",
  "faculty/attendance-reports": "Attendance Reports",
  "faculty/marks": "Marks Management",
  "faculty/marks-summary": "Marks Summary",
  student: "Student workspace",
  "student/profile": "My Profile",
  "student/subjects": "My Subjects",
  "student/attendance": "Attendance",
  "student/academic-records": "Academic Records",
  "student/gpa": "GPA and CGPA",
  "student/notifications": "Notifications",
  "student/reports": "Download Reports",
};

export default function Header({ onMenuClick }) {
  const { user, logout, setNotice } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const key = parts.length > 1 ? `${parts[0]}/${parts.at(-1)}` : parts[0] || "admin";
    return breadcrumbLabels[key] || "Workspace";
  }, [location.pathname]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      setNotice({ type: "error", message: error.message });
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function loadNotifications() {
    setIsLoadingNotifications(true);
    setNotificationError("");
    try {
      const result = await studentApi.notifications();
      if (!Array.isArray(result)) {
        throw new Error("The notifications API returned an unexpected response.");
      }
      setNotifications(result);
    } catch (error) {
      setNotificationError(error.message || "Unable to load your notifications.");
      setNotice({ type: "error", message: error.message || "Unable to load your notifications." });
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-7 lg:px-9">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          aria-label="Open navigation"
          className="lg:hidden"
          onClick={onMenuClick}
          variant="ghost"
        >
          <Menu aria-hidden="true" size={21} />
        </Button>
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-400 sm:inline">Workspace</span>
            <span aria-hidden="true" className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-semibold text-slate-900">{currentPage}</span>
          </nav>
          <p className="hidden text-xs text-slate-500 sm:block">Student Record System</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {user?.role === "Student" && (
          <div className="relative">
            <button
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              aria-label="Open notifications"
              className="grid size-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              onClick={() => {
                const nextOpen = !notificationsOpen;
                setNotificationsOpen(nextOpen);
                if (nextOpen) void loadNotifications();
              }}
              type="button"
            >
              <Bell aria-hidden="true" size={19} />
            </button>
            {notificationsOpen && (
              <section
                aria-label="Recent notifications"
                className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-float"
                role="dialog"
              >
                <div className="flex items-center justify-between gap-3 px-2 py-1">
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                  <button
                    className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate("/student/notifications");
                    }}
                    type="button"
                  >
                    View all
                  </button>
                </div>
                {isLoadingNotifications ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">Loading notifications...</p>
                ) : notificationError ? (
                  <div className="px-2 py-5 text-center">
                    <p className="text-sm text-rose-700">{notificationError}</p>
                    <button
                      className="mt-2 text-xs font-semibold text-brand-700"
                      onClick={() => void loadNotifications()}
                      type="button"
                    >
                      Try again
                    </button>
                  </div>
                ) : notifications.length ? (
                  <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                    {notifications.map((item) => (
                      <button
                        className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
                        key={item.notification_id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate("/student/notifications");
                        }}
                        type="button"
                      >
                        <span className="block line-clamp-2 text-sm font-medium text-slate-800">
                          {item.message}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {item.subject_code} · {item.subject_name}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-slate-500">You are all caught up.</p>
                )}
              </section>
            )}
          </div>
        )}
        <div className="relative">
          <button
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl p-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            onClick={() => setProfileOpen((value) => !value)}
            type="button"
          >
            <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
              {user?.email?.slice(0, 1).toUpperCase() || "U"}
            </span>
            <span className="hidden max-w-36 truncate text-sm font-semibold text-slate-700 md:block">
              {user?.email}
            </span>
            <ChevronDown aria-hidden="true" className="hidden text-slate-400 md:block" size={16} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-float" role="menu">
              <div className="border-b border-slate-100 px-3 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.email}</p>
                <p className="mt-1 text-xs text-slate-500">{user?.role}</p>
              </div>
              <button
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={isLoggingOut}
                onClick={async () => {
                  setProfileOpen(false);
                  await handleLogout();
                }}
                role="menuitem"
                type="button"
              >
                <LogOut aria-hidden="true" size={16} />
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
