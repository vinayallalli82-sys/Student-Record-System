import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import Button from "./Button.jsx";

export default function Modal({ title, description, onClose, children, size = "max-w-xl" }) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`my-auto w-full ${size} rounded-2xl bg-white shadow-float`}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            )}
          </div>
          <Button aria-label="Close dialog" className="-mr-2 -mt-1 px-2" onClick={onClose} variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </header>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
