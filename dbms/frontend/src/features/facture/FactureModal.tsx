import { useEffect } from "react";
import { fmtDA, fmtDate } from "../../shared/lib/format";
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
  // Real tables store the TVA amount; the mock (Entreprises) data only has a rate.
  const tvaAmount =
    data.tvaAmount !== undefined
      ? data.tvaAmount
      : data.montantTTC !== undefined && data.tvaRate !== undefined
        ? Math.round(data.montantTTC * (data.tvaRate / 100) * 100) / 100
        : undefined;
  const montantHT =
    data.montantHT !== undefined
      ? data.montantHT
      : data.montantTTC !== undefined && tvaAmount !== undefined
        ? Math.round((data.montantTTC - tvaAmount) * 100) / 100
        : undefined;

  const docTitle = isReceipt
    ? data.billType === "globale"
      ? "Reçu de Paiement — Règlement Global"
      : "Reçu de Paiement — Versement Partiel"
    : data.billType === "globale"
      ? "Reçu de Paiement Global"
      : "Avis de Paiement Partiel";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
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
        <div className="overflow-auto flex-1 bg-surface2">
          {/* White paper document */}
          <div className="print-area bg-white text-black p-10 m-4 rounded shadow-sm border border-gray-100">
            {/* Official header */}
            <div className="text-center mb-6 pb-5 border-b-2 border-black">
              <p className="text-[9px] uppercase tracking-widest text-gray-500">
                République Algérienne Démocratique et Populaire
              </p>
              <div className="text-3xl font-extrabold mt-2 tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                ALGÉRIE TÉLÉCOM
              </div>
              <div className="text-sm font-medium text-gray-700 mt-0.5">
                {data.direction || (data.wilaya ? `Direction Territoriale d'Alger — ${data.wilaya}` : "Direction Territoriale d'Alger")}
              </div>
              <div className="text-xs text-gray-500">
                {data.service || "Service Recouvrement & Contentieux"}
              </div>
              {data.actel && <div className="text-xs text-gray-500">{data.actel}</div>}
              <div className="text-[9px] text-gray-400 mt-1 font-mono">Base : {data.dbLabel}</div>
            </div>

            {/* Document type */}
            <div className="text-center mb-6">
              <div
                className={`inline-block px-8 py-2.5 border-2 border-black font-bold text-lg uppercase tracking-widest ${
                  isReceipt ? "bg-blue-50" : data.billType === "globale" ? "bg-green-50" : "bg-amber-50"
                }`}
                style={{ fontFamily: "Georgia, serif" }}
              >
                {docTitle}
              </div>
              <div className="mt-2 text-xs text-gray-600 font-mono">
                N° : <span className="font-bold text-black">{data.numFacture}</span>
                &nbsp;&nbsp;|&nbsp;&nbsp; Date :{" "}
                <span className="font-bold text-black">{fmtDate(data.datePaiement)}</span>
              </div>
            </div>

            {/* Client + Service grid */}
            <div className="grid grid-cols-2 gap-0 mb-6 border border-gray-400 text-sm">
              <div className="p-4 border-r border-gray-400">
                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3 pb-1 border-b border-gray-300">
                  Informations Client
                </div>
                <div className="space-y-1.5">
                  {data.numClient && (
                    <div>
                      <span className="text-[9px] uppercase text-gray-400">Numéro du Client : </span>
                      <span className="font-mono font-bold text-sm">{data.numClient}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] uppercase text-gray-400">{data.identifiantLabel} : </span>
                    <span className="font-mono font-bold text-sm">{data.numIdentifiant}</span>
                  </div>
                  {data.dateResiliation && (
                    <div>
                      <span className="text-[9px] uppercase text-gray-400">Date de Résiliation : </span>
                      <span className="font-mono text-sm">{data.dateResiliation}</span>
                    </div>
                  )}
                  <div className="font-bold text-base">
                    {data.nom} {data.prenom}
                  </div>
                  <div className="text-gray-700 text-xs">{data.adresse}</div>
                  <div className="text-gray-700 text-xs">
                    {[data.commune, data.wilaya].filter(Boolean).join(" — ") || "—"}
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-400">Tél : </span>
                    <span className="font-mono">{data.telephone || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3 pb-1 border-b border-gray-300">
                  Service &amp; Période
                </div>
                <div className="space-y-1.5">
                  <div>
                    <span className="text-[9px] uppercase text-gray-400">Type : </span>
                    <span className="font-semibold text-sm">{data.typeService}</span>
                  </div>
                  {data.debit && (
                    <div>
                      <span className="text-[9px] uppercase text-gray-400">Débit : </span>
                      <span className="font-mono text-xs">{data.debit}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] uppercase text-gray-400">Période : </span>
                    <span className="font-semibold font-mono">{data.periode}</span>
                  </div>
                  {data.extraFields?.map((f) => (
                    <div key={f.label}>
                      <span className="text-[9px] uppercase text-gray-400">{f.label} : </span>
                      <span className="text-xs">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Facturation — HT / TVA / TTC */}
            {montantHT !== undefined && tvaAmount !== undefined && data.montantTTC !== undefined && (
              <div className="mb-6">
                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">Facturation</div>
                <table className="w-full border-collapse border border-gray-400 text-sm">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="py-2 px-4 bg-gray-50 font-medium">Montant HT</td>
                      <td className="py-2 px-4 text-right font-mono">{fmtDA(montantHT)}</td>
                    </tr>
                    <tr className="border-b border-gray-300">
                      <td className="py-2 px-4 bg-gray-50 font-medium">TVA{data.tvaRate !== undefined ? ` (${data.tvaRate}%)` : ""}</td>
                      <td className="py-2 px-4 text-right font-mono">{fmtDA(tvaAmount)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 font-bold">Total TTC</td>
                      <td className="py-2 px-4 text-right font-mono font-bold">{fmtDA(data.montantTTC)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment table */}
            <div className="mb-6">
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                Détail de Paiement
              </div>
              <table className="w-full border-collapse border border-gray-400 text-sm">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="py-2.5 px-4 bg-gray-50 font-medium">Montant dû</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">{fmtDA(data.montantDu)}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="py-2.5 px-4 bg-gray-50 font-medium">Montant versé</td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-bold ${
                        data.billType === "globale" ? "text-green-700" : "text-amber-700"
                      }`}
                    >
                      {fmtDA(data.montantVerse)}
                    </td>
                  </tr>
                  {data.billType === "partielle" && (
                    <tr className="border-t-2 border-black">
                      <td className="py-2.5 px-4 font-bold">Reste à payer</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700">
                        {fmtDA(data.reste)}
                      </td>
                    </tr>
                  )}
                  {data.billType === "globale" && (
                    <tr className="border-t-2 border-black bg-green-50">
                      <td className="py-2.5 px-4 font-bold text-green-800">Total réglé</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-green-800">
                        {fmtDA(data.montantVerse)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Status stamp */}
            <div className="flex justify-center mb-6">
              {isReceipt ? (
                <div
                  className="border-4 border-blue-600 text-blue-700 px-8 py-2 font-extrabold text-xl uppercase tracking-widest opacity-80"
                  style={{ transform: "rotate(-3deg)", fontFamily: "Georgia, serif", letterSpacing: "0.15em" }}
                >
                  ✓ VERSEMENT VALIDÉ
                </div>
              ) : data.billType === "globale" ? (
                <div
                  className="border-4 border-green-600 text-green-700 px-8 py-2 font-extrabold text-2xl uppercase tracking-widest opacity-80"
                  style={{ transform: "rotate(-3deg)", fontFamily: "Georgia, serif", letterSpacing: "0.2em" }}
                >
                  ✓ SOLDÉ
                </div>
              ) : (
                <div
                  className="border-4 border-amber-500 text-amber-600 px-8 py-2 font-extrabold text-xl uppercase tracking-widest opacity-80"
                  style={{ transform: "rotate(-3deg)", fontFamily: "Georgia, serif", letterSpacing: "0.15em" }}
                >
                  PAIEMENT PARTIEL
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-gray-400 pt-4">
              <div className="flex justify-between text-sm mb-8">
                <div>
                  <div className="text-[9px] uppercase text-gray-400 mb-1">Agent de saisie</div>
                  <div className="font-semibold">{data.agent || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase text-gray-400 mb-1">Date d'émission</div>
                  <div className="font-mono text-sm">{fmtDate(data.datePaiement)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 text-[9px] uppercase text-gray-500 tracking-wider">
                <div>
                  <div className="border-t border-gray-400 pt-1 mt-10">Cachet &amp; Signature Agent</div>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1 mt-10">Lu et Approuvé — Client</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
