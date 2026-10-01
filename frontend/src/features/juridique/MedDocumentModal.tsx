import { useEffect, useState } from "react";
import { AccentTheme, ApresGaiaMedRow, DebtorView } from "../../types";
import { fmtDate } from "../../shared/lib/format";
import { MedDocType, DocLang } from "./medDocuments";
import MedSheet from "./MedSheet";
import ConfirmDialog from "../../shared/ui/ConfirmDialog";

interface Props {
  client: DebtorView;
  med: ApresGaiaMedRow;
  type: MedDocType;
  accent: AccentTheme;
  /** Whether this étape is already marked ENVOYEE / ENGAGE (its date, if any). */
  alreadySentDate: string | null;
  busy: boolean;
  onEnvoyer: () => Promise<string | null>;
  onClose: () => void;
}

const TITLES: Record<MedDocType, string> = {
  invitation: "Invitation de paiement",
  med_lettre: "Mise en demeure par lettre (convocation)",
  engagement: "Engagement du client",
  attestation: "Attestation de mise à jour",
};

export default function MedDocumentModal({ client, med, type, accent, alreadySentDate, busy, onEnvoyer, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const [lang, setLang] = useState<DocLang>("fr");
  const [recorded, setRecorded] = useState(!!alreadySentDate);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | "record" | "print">(null);

  // The attestation is a plain printout: it is not a step of the MED workflow, so there is nothing to record.
  const recordable = type !== "attestation";

  const record = async () => {
    if (recorded) return true;
    const err = await onEnvoyer();
    if (err) {
      setError(err);
      return false;
    }
    setError(null);
    setRecorded(true);
    return true;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface rounded-t-lg flex-shrink-0 no-print">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${accent.badge}`}>{TITLES[type].toUpperCase()}</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 ml-1">
              {(["fr", "ar"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-xs transition-colors ${lang === l ? `${accent.bg} text-white` : "bg-white text-gray-600 hover:bg-gray-50"}`}
                >
                  {l === "fr" ? "FR" : "عربي"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {!recordable ? null : recorded ? (
              <span className="text-xs text-green-700">✓ Enregistré{alreadySentDate ? ` le ${fmtDate(alreadySentDate)}` : ""}</span>
            ) : (
              <button
                onClick={() => setAsk("record")}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Enregistrer sans imprimer
              </button>
            )}
            <button
              onClick={() => (recordable && !recorded ? setAsk("print") : window.print())}
              disabled={busy}
              className={`px-3 py-1.5 text-sm text-white rounded transition-opacity hover:opacity-80 disabled:opacity-60 ${accent.bg}`}
            >
              Imprimer{recordable && !recorded ? " et enregistrer" : ""}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-surface2 border border-border text-muted rounded hover:text-[#1C2235] transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>

        {ask && (
          <ConfirmDialog
            title={ask === "print" ? "Imprimer et enregistrer cette étape ?" : "Enregistrer cette étape sans imprimer ?"}
            confirmLabel={ask === "print" ? "Imprimer et enregistrer" : "Enregistrer"}
            busy={busy}
            onCancel={() => setAsk(null)}
            onConfirm={async () => {
              const ok = await record();
              setAsk(null);
              if (ok && ask === "print") setTimeout(() => window.print(), 50);
            }}
          >
            <p>
              <b>{TITLES[type]}</b> — compte n° <b>{client.id}</b>.
            </p>
            <p>L'étape sera marquée comme faite dans le dossier avec la date du jour.</p>
          </ConfirmDialog>
        )}

        {error && <p className="no-print px-4 py-2 text-xs bg-red-50 text-red-700 border-b border-red-200">{error}</p>}

        {/* Scrollable document */}
        <div className="overflow-auto flex-1 bg-[#d5dae5] p-5">
          <p className="no-print text-center text-xs text-brand mb-3">
            ✎ Document modifiable : cliquez dans le texte ou sur un champ pointillé pour écrire, puis imprimez.
            {" "}Changer de langue réinitialise vos modifications.
          </p>
          <div className="print-area shadow-lg" contentEditable suppressContentEditableWarning spellCheck={false}>
            <MedSheet type={type} lang={lang} client={client} med={med} />
          </div>
        </div>
      </div>
    </div>
  );
}
