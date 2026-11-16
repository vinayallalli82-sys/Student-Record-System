import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { studentApi } from "../../api/student.js";
import Notification from "../common/Notification.jsx";
import { useAuth } from "../../context/useAuth.js";
import StudentNotificationModal from "../common/StudentNotificationModal.jsx";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";

const notificationRequests = new Map();

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(null);
  const { user, loginSessionId, notice, clearNotice, setNotice } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "Student" || !loginSessionId) return undefined;

    const storageKey = `student-notifications-checked:${loginSessionId}`;
    if (sessionStorage.getItem(storageKey) === "complete") return undefined;

    let active = true;
    let request = notificationRequests.get(loginSessionId);
    if (!request) {
      request = studentApi.notifications().then((items) => {
        if (!Array.isArray(items)) {
          throw new Error("The notifications API returned an unexpected response.");
        }
        return items;
      });
      notificationRequests.set(loginSessionId, request);
    }

    request
      .then((items) => {
        sessionStorage.setItem(storageKey, "complete");
        if (active && items.length) setLoginNotifications(items);
      })
      .catch((error) => {
        sessionStorage.setItem(storageKey, "complete");
        if (active) {
          setNotice({
            type: "error",
            message: error.message || "Unable to load your notifications.",
          });
        }
      })
      .finally(() => {
        if (notificationRequests.get(loginSessionId) === request) {
          notificationRequests.delete(loginSessionId);
        }
      });

    return () => {
      active = false;
    };
  }, [loginSessionId, setNotice, user?.role]);

  return (
    <div className="min-h-screen bg-canvas text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          open={sidebarOpen}
        />
        <div className="min-w-0 flex-1">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
            <Outlet />
          </main>
        </div>
      </div>
      <Notification notice={notice} onDismiss={clearNotice} />
      {loginNotifications && (
        <StudentNotificationModal
          notifications={loginNotifications}
          onClose={() => setLoginNotifications(null)}
          onViewAll={() => {
            setLoginNotifications(null);
            navigate("/student/notifications");
          }}
        />
      )}
    </div>
  );
}
