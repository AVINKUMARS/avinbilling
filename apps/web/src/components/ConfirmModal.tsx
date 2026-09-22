import { useRef, useEffect } from "react";
import { X } from "lucide-react";

export function ConfirmModal({
  action,
  onClose,
}: {
  action: { message: string; onConfirm: () => void } | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!action) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [action]);

  if (!action) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm Action"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
          if (event.key !== "Tab") return;
          const controls = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled)"
            ) ?? []
          ).filter((el) => el.getAttribute("type") !== "hidden");
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="w-full max-w-md rounded-3xl bg-white/60 dark:bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl border border-white/40 dark:border-white/10"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Confirm Action</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
          >
            <X size={19} />
          </button>
        </div>
        <div className="mt-6">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {action.message}
          </p>
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-100 dark:bg-white/10 px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
            >
              No, Cancel
            </button>
            <button
              onClick={() => {
                action.onConfirm();
                onClose();
              }}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
            >
              Yes, Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
