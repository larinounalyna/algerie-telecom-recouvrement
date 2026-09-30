import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { greenTheme } from "../../shared/theme/theme";
import { AccentTheme } from "../../types";
import { exportToCSV, importFromCSV } from "../../shared/lib/csv";
import { fmtDA, fmtDate } from "../../shared/lib/format";
import BackLink from "../../shared/ui/BackLink";
import { CorporateClient } from "./types";
import { CorporateStore } from "./useCorporateClients";
import { CorpFilters, applyCorpFilters, countActive, distinct, emptyCorpFilters } from "./filters";
import { invoiceAgeLabel, isOneYearOld } from "./invoiceAge";
import { parseImport, toExportRows } from "./csvMapping";

interface Props {
  store: CorporateStore;
  /** Opens with the "facture d'un an ou plus" filter already ticked. */
  startWithOldOnly?: boolean;
  onClose: () => void;
  onOpen: (code: string) => void;
}

const accent = greenTheme;
const fr = (n: number) => n.toLocaleString("fr-FR");

const inputBase =
  "w-full bg-white border-2 border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-[#1C2235] focus:outline-none transition-colors placeholder:text-gray-400";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-1 h-3.5 rounded-full ${accent.bg}`} />
        <span className="text-sm text-[#1C2235]">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-[11px] text-gray-500">
      <span className="block mb-0.5">{text}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, text }: { checked: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#1C2235] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-current" />
      {text}
    </label>
  );
}

function FilterPanel({ rows, value: f, onChange }: { rows: CorporateClient[]; value: CorpFilters; onChange: (n: CorpFilters) => void }) {
  const set = <K extends keyof CorpFilters>(k: K, v: CorpFilters[K]) => onChange({ ...f, [k]: v });
  const sel = `${inputBase} ${accent.focusBorder}`;
  const designations = useMemo(() => distinct(rows, (r) => r.designation), [rows]);
  const observations = useMemo(() => distinct(rows, (r) => r.observation), [rows]);
  const active = countActive(f);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#1C2235]">
          Filtres {active > 0 && <span className={`ml-1 px-2 py-0.5 rounded-full text-[11px] ${accent.badge}`}>{active} actif(s)</span>}
        </span>
        <button
          onClick={() => onChange(emptyCorpFilters)}
          disabled={active === 0}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
            active === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Réinitialiser
        </button>
      </div>

      <Label text="Recherche libre">
        <input type="search" className={sel} placeholder="Code, nom, n° de facture…" value={f.search} onChange={(e) => set("search", e.target.value)} />
      </Label>

      <Group title="Dossier">
        <Label text="Désignation">
          <select className={sel} value={f.designation} onChange={(e) => set("designation", e.target.value)}>
            <option value="">Toutes</option>
            {designations.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Label>
        <Label text="Observation">
          <select className={sel} value={f.observation} onChange={(e) => set("observation", e.target.value)}>
            <option value="">Toutes</option>
            {observations.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </Label>
      </Group>

      <Group title="Créance">
        <div className="grid grid-cols-2 gap-2">
          <Label text="Créance min. (DA)">
            <input type="number" min={0} className={`${sel} font-mono`} value={f.creanceMin} onChange={(e) => set("creanceMin", e.target.value)} />
          </Label>
          <Label text="Créance max. (DA)">
            <input type="number" min={0} className={`${sel} font-mono`} value={f.creanceMax} onChange={(e) => set("creanceMax", e.target.value)} />
          </Label>
        </div>
      </Group>

      <Group title="Factures">
        <div className="grid grid-cols-2 gap-2">
          <Label text="Facturé à partir du">
            <input type="date" className={`${sel} font-mono`} value={f.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
          </Label>
          <Label text="Jusqu'au">
            <input type="date" className={`${sel} font-mono`} value={f.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
          </Label>
        </div>
        <Check checked={f.oneYear} onChange={(v) => set("oneYear", v)} text="Facture d'un an ou plus" />
        <Label text="Documents joints">
          <select className={sel} value={f.docs} onChange={(e) => set("docs", e.target.value as CorpFilters["docs"])}>
            <option value="tous">Tous</option>
            <option value="avec">Avec documents</option>
            <option value="sans">Sans document</option>
          </select>
        </Label>
      </Group>

      <Group title="Données à renseigner">
        <Check checked={f.requireNumero} onChange={(v) => set("requireNumero", v)} text="N° de facture renseigné" />
        <Check checked={f.requireDate} onChange={(v) => set("requireDate", v)} text="Date de facture renseignée" />
      </Group>
    </div>
  );
}

const PAGE_SIZES = [50, 100, 250];

function Cell({ children, right, center }: { children: ReactNode; right?: boolean; center?: boolean }) {
  return <td className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : center ? "text-center" : ""}`}>{children}</td>;
}

const blank = <em className="text-gray-300 not-italic">—</em>;

function Table({ rows, accent: a, onOpen }: { rows: CorporateClient[]; accent: AccentTheme; onOpen: (c: CorporateClient) => void }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(100);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  useEffect(() => setPage(0), [rows, size]);
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * size, cur * size + size);
  const heads: [string, "left" | "right" | "center"][] = [
    ["Code", "left"],
    ["Nom", "left"],
    ["Créance", "right"],
    ["N° facture", "left"],
    ["Date de facture", "left"],
    ["Désignation", "left"],
    ["Observation", "left"],
    ["Documents", "center"],
    ["Alerte", "center"],
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto bg-white border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              {heads.map(([h, align]) => (
                <th
                  key={h}
                  className={`px-3 py-2.5 text-xs text-gray-500 font-medium whitespace-nowrap ${
                    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((c, i) => (
              <tr
                key={c.code}
                onClick={() => onOpen(c)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(c)}
                className={`border-b border-gray-100 cursor-pointer transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"} ${a.hoverLight}`}
              >
                <Cell>
                  <span className={`font-mono text-sm ${a.text}`}>{c.code}</span>
                </Cell>
                <Cell>
                  <span className="block max-w-[15rem] truncate text-[#1C2235]" title={c.name}>
                    {c.name}
                  </span>
                </Cell>
                <Cell right>
                  <span className="font-mono">{fmtDA(c.creance)}</span>
                </Cell>
                <Cell>
                  <span className="font-mono text-sm text-gray-600">{c.numeroFacture || blank}</span>
                </Cell>
                <Cell>
                  <span className="font-mono text-sm text-gray-600">{c.dateFacture ? fmtDate(c.dateFacture) : blank}</span>
                </Cell>
                <Cell>
                  <span className="block max-w-[12rem] truncate text-gray-600" title={c.designation}>
                    {c.designation || blank}
                  </span>
                </Cell>
                <Cell>
                  <span className="block max-w-[12rem] truncate text-gray-600" title={c.observation}>
                    {c.observation || blank}
                  </span>
                </Cell>
                <Cell center>
                  <span className="font-mono text-gray-600">{c.files.length || blank}</span>
                </Cell>
                <Cell center>
                  {isOneYearOld(c.dateFacture) ? (
                    <span
                      title={`Facture de ${invoiceAgeLabel(c.dateFacture)}`}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap"
                    >
                      ⚠️ Un an ou plus
                    </span>
                  ) : (
                    blank
                  )}
                </Cell>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={heads.length} className="px-4 py-12 text-center text-gray-400">
                  Aucun résultat. Assouplissez les filtres ou importez une base (CSV).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2 text-sm text-gray-600 flex-shrink-0">
        <span>
          {rows.length === 0 ? "0 ligne" : `Lignes ${fr(cur * size + 1)} à ${fr(Math.min(rows.length, cur * size + size))} sur ${fr(rows.length)}`}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Lignes par page
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm">
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => setPage(cur - 1)}
            disabled={cur === 0}
            className="px-3 py-1 rounded-lg border border-gray-300 disabled:text-gray-300 disabled:border-gray-200 hover:bg-gray-50 disabled:hover:bg-transparent"
          >
            Précédent
          </button>
          <span className="font-mono text-xs">
            {cur + 1} / {fr(pages)}
          </span>
          <button
            onClick={() => setPage(cur + 1)}
            disabled={cur >= pages - 1}
            className="px-3 py-1 rounded-lg border border-gray-300 disabled:text-gray-300 disabled:border-gray-200 hover:bg-gray-50 disabled:hover:bg-transparent"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Full-window Corporate AR database — same structure as the Hors/Après Gaïa
 * database screens: header with import, filter sidebar, paginated table, export
 * of the filtered selection. Every imported row (or new client) gets its own key.
 */
export default function CorporateArDatabase({ store, startWithOldOnly, onClose, onOpen }: Props) {
  const { clients, loaded, error } = store;
  const [filters, setFilters] = useState<CorpFilters>({ ...emptyCorpFilters, oneYear: !!startWithOldOnly });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => applyCorpFilters(clients, filters), [clients, filters]);
  const total = useMemo(() => filtered.reduce((s, c) => s + c.creance, 0), [filtered]);

  const exportFiltered = () =>
    exportToCSV(toExportRows(filtered), `corporate-ar-selection-${new Date().toISOString().slice(0, 10)}.csv`);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = importFromCSV(String(reader.result ?? ""));
        if (raw.length === 0) {
          setMsg({ ok: false, text: "Fichier vide ou illisible : aucune ligne importée. La première ligne doit contenir les noms de colonnes." });
          return;
        }
        const parsed = parseImport(raw);
        if (!parsed.recognised) {
          setMsg({
            ok: false,
            text: "Colonne du nom introuvable. L'en-tête doit contenir au moins « Nom » (et, si possible : Créance, Numéro de facture, Date de facture, Désignation, Observation). Le Code est facultatif : il est généré automatiquement.",
          });
          return;
        }
        setImporting(true);
        const r = await store.importRows(parsed.rows);
        const notes = [
          r.updated ? `${fr(r.updated)} mise(s) à jour (code déjà connu)` : "",
          parsed.ignored ? `${fr(parsed.ignored)} ignorée(s) (nom manquant)` : "",
          parsed.badDates ? `${fr(parsed.badDates)} date(s) illisible(s) laissée(s) vide(s)` : "",
          parsed.badAmounts ? `${fr(parsed.badAmounts)} créance(s) illisible(s) mise(s) à 0` : "",
        ].filter(Boolean);
        setMsg({
          ok: r.added + r.updated > 0,
          text: `${fr(r.added)} entreprise(s) ajoutée(s), dont ${fr(r.generated)} avec un code généré automatiquement${notes.length ? ` · ${notes.join(" · ")}` : ""}.`,
        });
      } catch (err) {
        setMsg({ ok: false, text: `Import impossible : ${(err as Error).message}` });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const headerBtn = "px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors whitespace-nowrap disabled:opacity-60";

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className={`${accent.bg} px-6 py-3.5 flex items-center gap-5 flex-shrink-0`}>
        <BackLink onClick={onClose} tone="light" />
        <div className="w-px h-7 bg-white/40" />
        <div>
          <h1 className="text-2xl text-white leading-tight">Base de données — Corporate AR</h1>
          <p className="text-sm text-white/80">{!loaded ? "Chargement…" : `${fr(clients.length)} enregistrements`}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={importing} className={headerBtn} title="Un code est généré automatiquement pour chaque ligne sans code">
            {importing ? "Import en cours…" : "⭱ Importer (CSV)"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
      </div>

      {msg && (
        <div
          className={`mx-6 mt-3 flex items-start justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm flex-shrink-0 ${
            msg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} aria-label="Fermer le message">
            ✕
          </button>
        </div>
      )}

      {/* Body */}
      {!loaded ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Chargement de la base de données…</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-red-700">{error}</div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4">
            <FilterPanel rows={clients} value={filters} onChange={setFilters} />
          </aside>
          <section className="flex-1 min-w-0 flex flex-col p-4 gap-3">
            <div className="flex items-center justify-between gap-3 flex-shrink-0 flex-wrap">
              <p className="text-sm text-gray-600">
                <b className="font-normal text-[#1C2235]">{fr(filtered.length)}</b> résultat(s) sur {fr(clients.length)} · créance cumulée{" "}
                <b className="font-normal text-red-600 font-mono">{fmtDA(Math.round(total * 100) / 100)}</b> · cliquez sur une ligne pour ouvrir la fiche
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
            <Table rows={filtered} accent={accent} onOpen={(c) => onOpen(c.code)} />
          </section>
        </div>
      )}
    </div>
  );
}
