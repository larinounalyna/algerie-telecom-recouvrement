import { useMemo, useState } from "react";
import { AccentTheme, DbKind } from "../../types";
import { useAppData } from "../../store/AppData";
import {
  DbRow,
  ExtractionOrder,
  FilterState,
  ORDER_LABELS,
  emptyFilters,
  extractMonthly,
  toExportRows,
} from "../../shared/lib/dbRows";
import { summarizeLots } from "../../shared/lib/juridique";
import { exportToCSV } from "../../shared/lib/csv";
import { currentMonth, fmtDA, fmtDate, fmtMonth } from "../../shared/lib/format";
import { labelFor } from "../../shared/theme/theme";
import FilterPanel from "./FilterPanel";
import RowsTable from "./RowsTable";

interface Props {
  kind: DbKind;
  rows: DbRow[];
  accent: AccentTheme;
  onOpen: (r: DbRow) => void;
}

// An address is needed to post a mise en demeure: on by default, can be relaxed.
const BASELINE: Partial<FilterState> = { requireAdresse: true };
const HIDDEN: (keyof FilterState)[] = ["med", "stade", "soldeMode"];

const fileSlug = (kind: DbKind) => (kind === "avant" ? "avant-gaia" : kind === "apres" ? "apres-gaia" : "entreprises");

export default function ExtractionTab({ kind, rows, accent, onOpen }: Props) {
  const { juridique, markLot, cancelLot } = useAppData();

  const [filters, setFilters] = useState<FilterState>({ ...emptyFilters, ...BASELINE });
  const [limit, setLimit] = useState("10000");
  const [order, setOrder] = useState<ExtractionOrder>("solde_desc");
  const [mois, setMois] = useState(currentMonth());
  const [confirming, setConfirming] = useState(false);
  const [alsoDownload, setAlsoDownload] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const limitNum = limit.trim() === "" ? Infinity : Math.max(0, Math.floor(Number(limit)) || 0);
  const result = useMemo(() => extractMonthly(rows, filters, limitNum, order), [rows, filters, limitNum, order]);

  // Batches already validated for this database
  const lots = useMemo(() => {
    const own: typeof juridique = {};
    for (const [k, v] of Object.entries(juridique)) if (k.startsWith(`${kind}:`)) own[k] = v;
    return summarizeLots(own);
  }, [juridique, kind]);
  const lotThisMonth = lots.filter((l) => l.mois === mois);

  const fileName = `mise-en-demeure_${fileSlug(kind)}_${mois}.csv`;
  const doExport = () => exportToCSV(toExportRows(result.selected, juridique), fileName);

  const validate = () => {
    if (alsoDownload) doExport();
    const { lot, count } = markLot(
      result.selected.map((r) => r.key),
      mois,
    );
    setConfirming(false);
    setFlash(`Lot ${lot} validé : ${count.toLocaleString("fr-FR")} client(s) marqué(s) « mise en demeure envoyée ». La liste ci-dessous propose maintenant les suivants.`);
  };

  const n = result.selected.length;
  const tiles: [string, string, string?][] = [
    ["Clients dans la base", result.totalScanned.toLocaleString("fr-FR")],
    ["Éligibles", result.eligibleCount.toLocaleString("fr-FR"), "jamais mis en demeure, solde > 0, critères respectés"],
    ["Retenus pour ce mois", n.toLocaleString("fr-FR"), Number.isFinite(limitNum) ? `limite : ${limitNum.toLocaleString("fr-FR")}` : "sans limite"],
    ["Montant à recouvrer", fmtDA(result.montantSelectionne)],
  ];

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Left: batch settings + criteria */}
      <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4 space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
            <span className="text-sm text-[#1C2235]">Lot du mois</span>
          </div>
          <label className="block text-[11px] text-gray-500">
            <span className="block mb-0.5">Mois d'extraction</span>
            <input
              type="month"
              value={mois}
              onChange={(e) => e.target.value && setMois(e.target.value)}
              className={`w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none ${accent.focusBorder}`}
            />
          </label>
          <label className="block text-[11px] text-gray-500">
            <span className="block mb-0.5">Nombre de clients à extraire</span>
            <input
              type="number"
              min={0}
              step={100}
              value={limit}
              placeholder="Sans limite"
              onChange={(e) => setLimit(e.target.value)}
              className={`w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none ${accent.focusBorder}`}
            />
          </label>
          <label className="block text-[11px] text-gray-500">
            <span className="block mb-0.5">Choisir les premiers selon</span>
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value as ExtractionOrder)}
              className={`w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none ${accent.focusBorder}`}
            >
              {(Object.keys(ORDER_LABELS) as ExtractionOrder[]).map((o) => (
                <option key={o} value={o}>
                  {ORDER_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          <ul className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-0.5 list-disc list-inside">
            <li>Jamais mis en demeure</li>
            <li>Solde dû supérieur à 0</li>
          </ul>
          <p className="text-[11px] text-gray-400">Ces deux règles sont toujours appliquées.</p>
        </div>

        <FilterPanel kind={kind} rows={rows} value={filters} onChange={setFilters} accent={accent} hide={HIDDEN} baseline={BASELINE} />
      </aside>

      {/* Right: result */}
      <section className="flex-1 min-w-0 flex flex-col p-4 gap-3">
        {flash && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
            <span>{flash}</span>
            <button onClick={() => setFlash(null)} className="text-green-700 hover:text-green-900" aria-label="Fermer le message">
              ✕
            </button>
          </div>
        )}

        {lotThisMonth.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {lotThisMonth.length} lot(s) déjà validé(s) pour {fmtMonth(mois)} (
            {lotThisMonth.reduce((s, l) => s + l.count, 0).toLocaleString("fr-FR")} clients). Cette extraction ne reprend que les clients restants.
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          {tiles.map(([label, value, hint]) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="text-[11px] text-gray-500">{label}</div>
              <div className="text-xl font-mono text-[#1C2235] truncate" title={value}>
                {value}
              </div>
              {hint && <div className="text-[11px] text-gray-400 truncate" title={hint}>{hint}</div>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
          <p className="text-xs text-gray-500">
            Écartés : <b>{result.excluded.dejaMED.toLocaleString("fr-FR")}</b> déjà mis en demeure ·{" "}
            <b>{result.excluded.soldeNul.toLocaleString("fr-FR")}</b> sans solde dû ·{" "}
            <b>{result.excluded.horsCriteres.toLocaleString("fr-FR")}</b> hors critères
          </p>
          <div className="flex gap-2">
            <button
              onClick={doExport}
              disabled={n === 0}
              className={`px-4 py-2 rounded-lg text-sm border-2 transition-colors ${
                n === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : `bg-white ${accent.border} ${accent.text} ${accent.hoverLight}`
              }`}
            >
              Exporter la liste (CSV)
            </button>
            <button
              onClick={() => setConfirming(true)}
              disabled={n === 0}
              className={`px-4 py-2 rounded-lg text-sm text-white transition-colors ${
                n === 0 ? "bg-gray-300 cursor-not-allowed" : `${accent.bg} ${accent.hover}`
              }`}
            >
              Valider le lot de {n.toLocaleString("fr-FR")} client(s)
            </button>
          </div>
        </div>

        <RowsTable
          kind={kind}
          rows={result.selected}
          accent={accent}
          onOpen={onOpen}
          emptyText="Aucun client ne correspond : tous ont déjà reçu une mise en demeure, ou les critères sont trop stricts."
        />

        <details className="flex-shrink-0 bg-white border border-gray-200 rounded-xl">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-[#1C2235]">
            Lots déjà validés ({lots.length})
          </summary>
          {lots.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-gray-400">Aucun lot validé pour le moment.</p>
          ) : (
            <ul className="px-4 pb-3 divide-y divide-gray-100 max-h-48 overflow-auto">
              {lots.map((l) => (
                <li key={l.lot} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    <b className="font-normal text-[#1C2235]">{fmtMonth(l.mois)}</b>
                    <span className="text-gray-500"> — {l.count.toLocaleString("fr-FR")} clients, validé le {fmtDate(l.date)} </span>
                    <span className="font-mono text-[11px] text-gray-400">{l.lot}</span>
                  </span>
                  {cancelling === l.lot ? (
                    <span className="flex items-center gap-2 text-xs">
                      <span className="text-red-700">Ces clients redeviendront éligibles.</span>
                      <button
                        onClick={() => {
                          cancelLot(l.lot);
                          setCancelling(null);
                          setFlash(`Lot ${l.lot} annulé : ${l.count.toLocaleString("fr-FR")} client(s) de nouveau éligibles.`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirmer
                      </button>
                      <button onClick={() => setCancelling(null)} className="px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-50">
                        Garder
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setCancelling(l.lot)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Annuler ce lot
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 no-print"
          onClick={() => setConfirming(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Valider le lot"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl text-[#1C2235]">Valider le lot de {fmtMonth(mois)}</h2>
            <p className="text-sm text-gray-700">
              {n.toLocaleString("fr-FR")} client(s) de la base <b>{labelFor(kind)}</b> ({fmtDA(result.montantSelectionne)} à recouvrer)
              seront marqués « mise en demeure envoyée ». Ils n'apparaîtront plus dans les prochaines extractions et leur état
              juridique sera mis à jour.
            </p>
            <p className="text-xs text-gray-500">Le lot pourra être annulé depuis la liste « Lots déjà validés ».</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={alsoDownload} onChange={(e) => setAlsoDownload(e.target.checked)} className="w-4 h-4" />
              Télécharger aussi le fichier CSV ({fileName})
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirming(false)} className="px-5 py-2 rounded-xl text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={validate} className={`px-5 py-2 rounded-xl text-sm text-white ${accent.bg} ${accent.hover}`}>
                Valider le lot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
