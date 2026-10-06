import { useEffect, useRef, useState } from "react";
import type { AccentTheme } from "../../types";
import { importFromCSV } from "../../shared/lib/csv";
import { IMPORT_TABLES, errorMessage, templateCsv } from "../../services";
import type { ImportTableId, ParseResult } from "../../services";

interface Props {
  /** Tables the user can choose from (e.g. avant_gaia + avant_gaia_versement). */
  tables: readonly ImportTableId[];
  initial?: ImportTableId;
  accent: AccentTheme;
  /** apres_gaia.n that exist: règlements of other accounts are refused before sending. */
  knownAccountNs?: Set<number>;
  /** Called after EVERY attempt that may have written rows (success or partial failure): reload the screen. */
  onChanged?: () => void | Promise<void>;
  /** Called once with the final message when an import succeeded (the page shows it as a banner). */
  onSuccess?: (text: string) => void;
  onClose: () => void;
}

const fr = (n: number) => n.toLocaleString("fr-FR");
const PREVIEW_ROWS = 5;
const PREVIEW_COLS = 8;

/**
 * Pop-up "Importer un fichier CSV": pick the table, pick the file, check what was understood, then
 * insert. Same behaviour as the existing Après Gaïa import (real column names in the header), now
 * available for every table that has an insert endpoint.
 */
export default function ImportCsvDialog({ tables, initial, accent, knownAccountNs, onChanged, onSuccess, onClose }: Props) {
  const [tableId, setTableId] = useState<ImportTableId>(initial && tables.includes(initial) ? initial : tables[0]);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null); // the file can't be used
  const [error, setError] = useState<string | null>(null); // the server refused / failed
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = IMPORT_TABLES[tableId];

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const reset = () => {
    setFileName("");
    setParsed(null);
    setProblem(null);
    setError(null);
  };

  const chooseTable = (id: ImportTableId) => {
    if (busy || id === tableId) return;
    setTableId(id);
    reset();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setFileName(file.name);
    try {
      const raw = importFromCSV(await file.text());
      if (raw.length === 0) {
        setProblem("Fichier vide ou illisible : aucune ligne à importer. La première ligne doit contenir les noms de colonnes, suivie d'au moins une ligne de données.");
        return;
      }
      const p = spec.parse(raw, { knownAccountNs });
      if (p.recognizedColumns.length === 0) {
        setProblem(`Aucune colonne reconnue : l'en-tête doit utiliser les noms de colonnes de la table ${spec.table} (voir la liste ci-dessus, ou téléchargez le modèle).`);
        return;
      }
      if (p.rows.length === 0) {
        setProblem(
          p.unknownAccounts?.length
            ? `Aucune ligne importable : les comptes n = ${p.unknownAccounts.slice(0, 10).join(", ")}${p.unknownAccounts.length > 10 ? "…" : ""} n'existent pas dans apres_gaia.`
            : "Aucune ligne importable : toutes les lignes sont vides ou incomplètes.",
        );
        return;
      }
      setParsed(p);
    } catch (err) {
      setProblem(errorMessage(err));
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv(spec)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele-${spec.table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const insert = async () => {
    if (!parsed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const inserted = await spec.insert(parsed.rows);
      const notes = [
        parsed.ignored ? `${fr(parsed.ignored)} ignorée(s) (vide(s), incomplète(s) ou compte inconnu)` : "",
        parsed.badValues ? `${fr(parsed.badValues)} valeur(s) illisible(s) laissée(s) vide(s)` : "",
      ].filter(Boolean);
      const text = `${fr(inserted)} ligne(s) ajoutée(s) à ${spec.table}${notes.length ? ` · ${notes.join(" · ")}` : ""}.`;
      setDone({ text });
      onSuccess?.(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      await onChanged?.();
    }
  };

  const previewCols = parsed ? parsed.recognizedColumns.slice(0, PREVIEW_COLS) : [];

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importer un fichier CSV"
        className={`bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col border-t-4 ${accent.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-[#1b2338]">Importer un fichier CSV</h3>
            <p className="text-sm text-gray-500">Les lignes sont ajoutées à la table choisie (rien n'est supprimé).</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="text-gray-400 hover:text-gray-700 disabled:opacity-40">
            ✕
          </button>
        </div>

        <div className="px-6 pb-2 overflow-y-auto space-y-4 text-sm">
          {done ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
              <p className="font-medium">✓ Import terminé</p>
              <p className="mt-1">{done.text}</p>
            </div>
          ) : (
            <>
              {/* 1 — table */}
              <fieldset className="space-y-2" disabled={busy}>
                <legend className="text-xs font-medium text-gray-700 mb-1">1 · Table à remplir</legend>
                <div className={`grid gap-2 ${tables.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {tables.map((id) => {
                    const t = IMPORT_TABLES[id];
                    const on = id === tableId;
                    return (
                      <label
                        key={id}
                        className={`cursor-pointer rounded-lg border-2 px-3 py-2 transition-colors ${on ? `${accent.border} ${accent.light}` : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input type="radio" name="import-table" className="sr-only" checked={on} onChange={() => chooseTable(id)} />
                        <span className="block text-[#1C2235]">{t.title}</span>
                        <span className="block font-mono text-[11px] text-gray-500">{t.table}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-gray-600">{spec.description}</p>
                <div className="flex flex-wrap gap-1">
                  {spec.columns.map((c) => (
                    <span key={c.name} className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${c.required ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                      {c.name}
                      {c.required ? " *" : ""}
                    </span>
                  ))}
                </div>
                <button type="button" onClick={downloadTemplate} className={`text-xs underline ${accent.text}`}>
                  ⭳ Télécharger un modèle CSV (colonnes + une ligne d'exemple)
                </button>
              </fieldset>

              {/* 2 — file */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-700">2 · Fichier CSV</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-700 hover:border-gray-400 disabled:opacity-60"
                  >
                    {fileName ? "Choisir un autre fichier" : "⭱ Choisir un fichier…"}
                  </button>
                  {fileName && <span className="font-mono text-xs text-gray-600 break-all">{fileName}</span>}
                  <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </div>
                <p className="text-xs text-gray-500">
                  Séparateur « ; » ou « , ». L'en-tête reprend les noms de colonnes de la table (majuscules et espaces tolérés). Les colonnes inconnues sont ignorées.
                </p>
                {problem && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    {problem}
                  </p>
                )}
              </div>

              {/* 3 — check */}
              {parsed && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">3 · Vérification</p>
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
                    <b className="font-medium">{fr(parsed.rows.length)}</b> ligne(s) prête(s) à être insérée(s) dans <span className="font-mono">{spec.table}</span>.
                  </div>
                  {(parsed.ignored > 0 || parsed.badValues > 0 || parsed.unknownColumns.length > 0 || (parsed.unknownAccounts?.length ?? 0) > 0) && (
                    <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 list-disc list-inside space-y-0.5">
                      {parsed.ignored > 0 && <li>{fr(parsed.ignored)} ligne(s) ignorée(s) (vides, ou sans valeur obligatoire).</li>}
                      {(parsed.unknownAccounts?.length ?? 0) > 0 && (
                        <li>
                          Comptes inexistants dans apres_gaia, lignes ignorées : n = {parsed.unknownAccounts!.slice(0, 10).join(", ")}
                          {parsed.unknownAccounts!.length > 10 ? `… (+${parsed.unknownAccounts!.length - 10})` : ""}.
                        </li>
                      )}
                      {parsed.badValues > 0 && <li>{fr(parsed.badValues)} valeur(s) illisible(s) (nombre ou date mal formé) : laissée(s) vide(s).</li>}
                      {parsed.unknownColumns.length > 0 && <li>Colonne(s) non reconnue(s), ignorée(s) : {parsed.unknownColumns.slice(0, 8).join(", ")}{parsed.unknownColumns.length > 8 ? "…" : ""}.</li>}
                    </ul>
                  )}
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          {previewCols.map((c) => (
                            <th key={c} className="px-2 py-1.5 text-left font-mono font-normal whitespace-nowrap">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            {previewCols.map((c) => (
                              <td key={c} className="px-2 py-1 whitespace-nowrap text-[#1C2235]">
                                {r[c] === null || r[c] === undefined ? <span className="text-gray-300">—</span> : String(r[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > PREVIEW_ROWS && <p className="text-xs text-gray-500">Aperçu des {PREVIEW_ROWS} premières lignes.</p>}
                </div>
              )}

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t border-gray-100">
          {done ? (
            <button onClick={onClose} autoFocus className={`px-4 py-2 rounded-xl text-sm text-white transition-colors ${accent.bg} ${accent.hover}`}>
              Fermer
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={() => void insert()}
                disabled={!parsed || busy}
                className={`px-4 py-2 rounded-xl text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accent.bg} ${accent.hover}`}
              >
                {busy ? "Import en cours…" : parsed ? `Insérer ${fr(parsed.rows.length)} ligne(s)` : "Insérer"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
