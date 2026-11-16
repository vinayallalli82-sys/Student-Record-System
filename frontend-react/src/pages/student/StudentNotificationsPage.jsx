import { useCallback } from "react";
import { studentApi } from "../../api/student.js";
import DataTable from "../../components/common/DataTable.jsx";
import { ErrorState, LoadingState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import useAdminQuery from "../../hooks/useAdminQuery.js";

export default function StudentNotificationsPage() {
  const query = useCallback(async () => {
    const notifications = await studentApi.notifications();
    if (!Array.isArray(notifications)) throw new Error("The notifications API returned an unexpected response.");
    return notifications;
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);

  if (isLoading) return <LoadingState label="Loading your notifications..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-7">
      <PageHeader description="Notifications returned for your authenticated student account." eyebrow="STUDENT WORKSPACE" title="Notifications" />
      <DataTable
        columns={[
          { key: "message", label: "Notification" },
          {
            key: "subject_name",
            label: "Subject",
            render: (item) => `${item.subject_code} · ${item.subject_name}`,
          },
          { key: "attendance_percentage", label: "Attendance" , render: (item) => `${item.attendance_percentage}%` },
          { key: "created_at", label: "Received", render: (item) => new Date(item.created_at).toLocaleString() },
        ]}
        emptyDescription="There are no notifications for your account."
        emptyTitle="You are all caught up"
        getRowKey={(item) => item.notification_id}
        rows={data || []}
      />
    </div>
  );
}
