import { Bell } from "lucide-react";
import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

export default function StudentNotificationModal({ notifications, onClose, onViewAll }) {
  return (
    <Modal
      description="You have new notifications."
      onClose={onClose}
      size="max-w-2xl"
      title="Notifications"
    >
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {notifications.map((item) => (
          <article
            className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4"
            key={item.notification_id}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-brand-700 ring-1 ring-brand-100">
              <Bell aria-hidden="true" size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-6 text-slate-900">{item.message}</p>
              <p className="mt-1 text-xs text-slate-600">
                {item.subject_code} · {item.subject_name}
              </p>
              {item.attendance_percentage != null && (
                <p className="mt-1 text-xs font-medium text-brand-800">
                  Attendance: {item.attendance_percentage}%
                </p>
              )}
              <time className="mt-2 block text-xs text-slate-500" dateTime={item.created_at}>
                {new Date(item.created_at).toLocaleString()}
              </time>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Button onClick={onClose} variant="secondary">Close</Button>
        <Button onClick={onViewAll}>View All Notifications</Button>
      </div>
    </Modal>
  );
}
