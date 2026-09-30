import { useEffect, useState } from "react";
import { AccentTheme, ApresGaiaMedRow, DebtorView } from "../../types";
import { fmtDate } from "../../shared/lib/format";
import { buildMedDocument, MedDocType, DocLang } from "./medDocuments";

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
  med_lettre: "Mise en demeure par lettre",
  engagement: "Engagement du client",
  attestation: "Attestation de règlement",
};

const ARABIC_FONT: React.CSSProperties = { fontFamily: "'Traditional Arabic', 'Arial', 'Noto Naskh Arabic', sans-serif" };

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

  const doc = buildMedDocument(type, lang, client, med);
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
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
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
                onClick={record}
                disabled={busy}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Enregistrer sans imprimer
              </button>
            )}
            <button
              onClick={async () => {
                const ok = !recordable || (await record());
                if (ok) window.print();
              }}
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

        {error && <p className="no-print px-4 py-2 text-xs bg-red-50 text-red-700 border-b border-red-200">{error}</p>}

        {/* Scrollable document */}
        <div className="overflow-auto flex-1 bg-surface2">
          <div
            className="print-area bg-white text-black p-10 m-4 rounded shadow-sm border border-gray-100 text-sm leading-relaxed"
            dir={doc.dir}
            style={doc.lang === "ar" ? ARABIC_FONT : undefined}
          >
            {/* Header */}
            <div className="text-center mb-5 pb-4 border-b-2 border-black">
              {doc.entete.map((line, i) => (
                <p key={i} className={i === 0 ? "text-xl font-extrabold tracking-tight" : "text-[10px] text-gray-600"} style={i === 0 ? { fontFamily: "Georgia, serif" } : undefined}>
                  {line}
                </p>
              ))}
              <p className="text-sm font-medium text-gray-800 mt-2">{doc.direction}</p>
            </div>

            {/* Reference block */}
            <div className={`grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-6 ${doc.dir === "rtl" ? "text-right" : ""}`}>
              {doc.reference.map((f, i) => (
                <div key={i} className="flex gap-1">
                  <span className="font-semibold whitespace-nowrap">{f.label} :</span>
                  <span className="font-mono">{f.value}</span>
                </div>
              ))}
            </div>

            <p className="mb-2 font-semibold">{doc.objet}</p>

            <div className="text-center mb-6">
              <div className="inline-block px-8 py-2 border-2 border-black font-bold uppercase tracking-widest bg-gray-50" style={{ fontFamily: doc.dir === "ltr" ? "Georgia, serif" : undefined }}>
                {doc.titre}
              </div>
            </div>

            {doc.paragraphes.map((p, i) => (
              <p key={i} className="mb-3">
                {p}
              </p>
            ))}

            {doc.aRemplir && (
              <div className="my-4 space-y-2 pl-4 border-l-2 border-gray-300">
                {doc.aRemplir.map((l, i) => (
                  <p key={i} className="font-mono text-xs">
                    {l}
                  </p>
                ))}
              </div>
            )}

            <div className={`grid grid-cols-2 gap-8 text-[9px] uppercase text-gray-500 tracking-wider mt-10 ${doc.dir === "rtl" ? "text-right" : ""}`}>
              <div>
                <div className="border-t border-gray-400 pt-1 mt-10">{doc.signatureGauche}</div>
              </div>
              {doc.signatureDroite && (
                <div className={doc.dir === "rtl" ? "text-left" : "text-right"}>
                  <div className="border-t border-gray-400 pt-1 mt-10">{doc.signatureDroite}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
