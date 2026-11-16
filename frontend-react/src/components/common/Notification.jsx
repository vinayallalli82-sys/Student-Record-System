import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import Button from "./Button.jsx";

export default function Notification({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;

  const isError = notice.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border p-4 shadow-float ${isError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
      role={isError ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
      <p className="flex-1 text-sm font-medium">{notice.message}</p>
      <Button
        aria-label="Dismiss notification"
        className="min-h-6 px-1 py-0"
        onClick={onDismiss}
        variant="ghost"
      >
        <X aria-hidden="true" size={16} />
      </Button>
    </div>
  );
}
