import { useEffect } from "react";
import FactureSheet from "./FactureSheet";
import type { FactureData } from "../../types";

// Re-exported so existing `import FactureModal, { FactureData } from "./FactureModal"`
// call sites keep working, while the actual type now lives in the central
// domain types file (src/types) instead of inside a component file.
export type { FactureData } from "../../types";

interface Props {
  data: FactureData;
  onClose: () => void;
}

export default function FactureModal({ data, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isReceipt = !!data.isReceipt;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface rounded-t-lg flex-shrink-0 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted">{data.numFacture}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                isReceipt
                  ? "bg-blue-100 text-blue-700"
                  : data.billType === "globale"
                    ? "bg-success/20 text-success"
                    : "bg-warning/20 text-warning"
              }`}
            >
              {isReceipt ? "REÇU VALIDÉ" : data.billType === "globale" ? "PAIEMENT GLOBAL" : "PAIEMENT PARTIEL"}
            </span>
            <span className="text-xs text-dim">{data.dbLabel}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:opacity-80 transition-opacity"
            >
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-surface2 border border-border text-muted rounded hover:text-[#1C2235] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* Scrollable document */}
        <div className="overflow-auto flex-1 bg-[#d5dae5] p-5">
          <div className="print-area shadow-lg">
            <FactureSheet data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
