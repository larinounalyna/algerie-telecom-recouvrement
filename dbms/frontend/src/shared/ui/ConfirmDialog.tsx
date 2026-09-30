import { ReactNode, useEffect } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" = red confirm button (irreversible actions). */
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small modal asking the user to confirm an action. Escape / click outside / "Annuler" cancel it. */
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = "Annuler", tone = "default", busy = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, busy]);

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg text-[#1C2235]">{title}</h3>
        <div className="text-sm text-gray-600 space-y-2">{children}</div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className={`px-4 py-2 rounded-xl text-sm text-white transition-colors disabled:opacity-60 ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {busy ? "Patientez…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
