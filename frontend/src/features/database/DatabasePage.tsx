import { useMemo, useRef, useState } from "react";
import { DbKind } from "../../types";
import { ImportResult, useAppData } from "../../store/AppData";
import { DbRow, FilterState, applyFilters, emptyFilters, toExportRows } from "../../shared/lib/dbRows";
import { buildApresRows, buildAvantRows, buildEntrepriseRows } from "../../shared/lib/dbRowBuilders";
import { exportToCSV, importFromCSV } from "../../shared/lib/csv";
import { toEntrepriseClient } from "../../shared/lib/importers";
import { fmtDA } from "../../shared/lib/format";
import { labelFor, themeFor } from "../../shared/theme/theme";
import { errorMessage, insertApresGaiaRows, parseApresGaiaCsv } from "../../services";
import { useApresGaiaDatabase, useAvantGaiaDatabase } from "../../hooks";
import ClientDetailHost from "../client-detail/ClientDetailHost";
import BackLink from "../../shared/ui/BackLink";
import FilterPanel from "./FilterPanel";
import ExtractionTab from "./ExtractionTab";
import RowsTable from "./RowsTable";

interface Props {
  kind: DbKind;
  onClose: () => void;
}

type Tab = "consultation" | "extraction";

const DEMO_COUNT = 20000;
const fileSlug = (kind: DbKind) => (kind === "avant" ? "avant-gaia" : kind === "apres" ? "apres-gaia" : "entreprises");

/**
 * Full-window database view (replaces the former pop-up):
 *  - "Consultation": every record with rich filters, export of the filtered selection
 *  - "Extraction mensuelle": the first N customers never sent a mise en demeure
 *
 * Avant / Après Gaïa show the real tables (exact column names) loaded from the
 * API; Entreprises still comes from the local store.
 */
export default function DatabasePage({ kind, onClose }: Props) {
  const { entreprises, juridique, importRows, hasDemo, loadDemo, clearDemo } = useAppData();
  const avantDb = useAvantGaiaDatabase(kind === "avant");
  const apresDb = useApresGaiaDatabase(kind === "apres");
  const accent = themeFor(kind);
  const label = labelFor(kind);

  const [tab, setTab] = useState<Tab>("consultation");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [detail, setDetail] = useState<{ id: string; tab: "finance" | "juridique" } | null>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const source = kind === "avant" ? avantDb : kind === "apres" ? apresDb : null;
  const loading = source?.loading ?? false;
  const loadError = source?.error ?? null;

  const rows = useMemo<DbRow[]>(() => {
    if (kind === "avant") return avantDb.data ? buildAvantRows(avantDb.data, juridique) : [];
    if (kind === "apres") return apresDb.data ? buildApresRows(apresDb.data, juridique) : [];
    return buildEntrepriseRows(entreprises, juridique);
  }, [kind, avantDb.data, apresDb.data, entreprises, juridique]);

  // One entry per customer (avant_gaia keeps one row per bimestre): what the extraction works on.
  const customers = useMemo(() => rows.filter((r) => r.isLatest), [rows]);
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const totalSolde = useMemo(() => {
    const seen = new Set<string>();
    let sum = 0;
    for (const r of filtered) {
      if (seen.has(r.key)) continue;
      seen.add(r.key);
      sum += r.solde;
    }
    return sum;
  }, [filtered]);
  const demo = kind === "entreprise" && hasDemo();

  const open = (r: DbRow) => r.id && setDetail({ id: r.id, tab: "finance" });

  const exportFiltered = () =>
    exportToCSV(toExportRows(filtered, juridique), `${fileSlug(kind)}-selection-${new Date().toISOString().slice(0, 10)}.csv`);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || kind === "avant") return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = importFromCSV(String(reader.result ?? ""));
        if (raw.length === 0) {
          setImportMsg({ ok: false, text: "Fichier vide ou illisible : aucune ligne importée. L'en-tête doit reprendre les noms de colonnes de l'export." });
          return;
        }

        if (kind === "apres") {
          // Après Gaïa → straight into the apres_gaia table through the API
          const { rows: parsed, ignored } = parseApresGaiaCsv(raw);
          if (parsed.length === 0) {
            setImportMsg({ ok: false, text: "Aucune colonne reconnue : l'en-tête doit utiliser les noms de colonnes de la table apres_gaia (n_appel, intitule, adresse…)." });
            return;
          }
          setImporting(true);
          const inserted = await insertApresGaiaRows(parsed);
          await apresDb.reload();
          setImportMsg({
            ok: inserted > 0,
            text: `${inserted.toLocaleString("fr-FR")} ligne(s) ajoutée(s) à apres_gaia${ignored ? `, ${ignored.toLocaleString("fr-FR")} ignorée(s) (aucune colonne reconnue)` : ""}.`,
          });
          return;
        }

        const r: ImportResult = importRows(raw.map(toEntrepriseClient));
        setImportMsg({
          ok: r.added + r.updated > 0,
          text: `${r.added.toLocaleString("fr-FR")} ligne(s) ajoutée(s), ${r.updated.toLocaleString("fr-FR")} mise(s) à jour${r.ignored ? `, ${r.ignored.toLocaleString("fr-FR")} ignorée(s) (N° de compte manquant)` : ""}.`,
        });
      } catch (err) {
        setImportMsg({ ok: false, text: errorMessage(err) });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleDemo = () => {
    if (demo) {
      clearDemo();
      return;
    }
    setLoadingDemo(true);
    // let the button repaint before the (synchronous) generation
    setTimeout(() => {
      loadDemo(DEMO_COUNT);
      setLoadingDemo(false);
    }, 30);
  };

  const headerBtn = "px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap disabled:opacity-60";

  const subtitle =
    kind === "avant"
      ? `${rows.length.toLocaleString("fr-FR")} lignes · ${customers.length.toLocaleString("fr-FR")} abonnés`
      : `${rows.length.toLocaleString("fr-FR")} enregistrements`;

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className={`${accent.bg} px-6 py-3.5 flex items-center gap-5 flex-shrink-0`}>
        <BackLink onClick={onClose} tone="light" />
        <div className="w-px h-7 bg-white/40" />
        <div>
          <h1 className="text-2xl text-white leading-tight">Base de données — {label}</h1>
          <p className="text-sm text-white/80">{loading ? "Chargement…" : subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {source && (
            <button onClick={() => void source.reload()} disabled={loading} className={headerBtn} title="Recharge la table depuis le serveur">
              ↻ Actualiser
            </button>
          )}
          {kind === "entreprise" && (
            <button onClick={toggleDemo} disabled={loadingDemo} className={headerBtn} title="Charge des clients fictifs pour tester l'extraction sur un gros volume">
              {loadingDemo ? "Génération…" : demo ? "Retirer les données de démo" : `Charger ${DEMO_COUNT.toLocaleString("fr-FR")} clients de démo`}
            </button>
          )}
          {kind !== "avant" && (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={importing} className={headerBtn}>
                {importing ? "Import en cours…" : "⭱ Importer (CSV)"}
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 flex gap-1 flex-shrink-0" role="tablist">
        {(
          [
            ["consultation", "Consultation et filtres"],
            ["extraction", "Extraction mensuelle — mises en demeure"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-5 py-3 text-[15px] border-b-2 -mb-px transition-colors ${
              tab === id ? accent.tabActive : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      {importMsg && (
        <div
          className={`mx-6 mt-3 flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm flex-shrink-0 ${
            importMsg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{importMsg.text}</span>
          <button onClick={() => setImportMsg(null)} aria-label="Fermer le message">
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      {loading && rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Chargement de la base de données…</div>
      ) : loadError && rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-red-700 max-w-xl">{loadError}</p>
          <button onClick={() => void source?.reload()} className={`px-5 py-2 rounded-lg text-sm text-white ${accent.bg} ${accent.hover}`}>
            Réessayer
          </button>
        </div>
      ) : tab === "consultation" ? (
        <div className="flex-1 min-h-0 flex">
          <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4">
            <FilterPanel kind={kind} rows={rows} value={filters} onChange={setFilters} accent={accent} />
          </aside>
          <section className="flex-1 min-w-0 flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
              <p className="text-sm text-gray-600">
                <b className="font-normal text-[#1C2235]">{filtered.length.toLocaleString("fr-FR")}</b> résultat(s) sur{" "}
                {rows.length.toLocaleString("fr-FR")} · solde dû cumulé{" "}
                <b className="font-normal text-red-600 font-mono">{fmtDA(Math.round(totalSolde * 100) / 100)}</b> · cliquez sur une ligne pour
                ouvrir la fiche
                {loadError && <span className="text-red-600"> · actualisation impossible : {loadError}</span>}
              </p>
              <button
                onClick={exportFiltered}
                disabled={filtered.length === 0}
                className={`px-4 py-2 rounded-lg text-sm text-white transition-colors ${
                  filtered.length === 0 ? "bg-gray-300 cursor-not-allowed" : `${accent.bg} ${accent.hover}`
                }`}
              >
                ⭳ Exporter la sélection filtrée (CSV)
              </button>
            </div>
            <RowsTable kind={kind} rows={filtered} accent={accent} onOpen={open} />
          </section>
        </div>
      ) : (
        <ExtractionTab kind={kind} rows={customers} accent={accent} onOpen={open} medError={kind === "apres" ? apresDb.data?.medError ?? null : null} />
      )}

      {detail && <ClientDetailHost kind={kind} id={detail.id} initialTab={detail.tab} onClose={() => setDetail(null)} />}
    </div>
  );
}
