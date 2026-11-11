import { AlertTriangle } from "lucide-react";
import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  isDangerous = false,
  isBusy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel} size="max-w-md">
      <div className="flex gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${isDangerous ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
          <AlertTriangle aria-hidden="true" size={19} />
        </span>
        <p className="text-sm leading-6 text-slate-600">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button disabled={isBusy} onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          className={isDangerous ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-400" : ""}
          disabled={isBusy}
          onClick={onConfirm}
        >
          {isBusy ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
