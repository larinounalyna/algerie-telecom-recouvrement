import { ReactNode, useEffect, useState } from "react";
import { AccentTheme, ApresGaiaRow, AvantGaiaRow, DbKind } from "../../types";
import { DbRow } from "../../shared/lib/dbRows";
import { stadeInfo } from "../../shared/lib/juridique";
import { fmtDA, fmtDate } from "../../shared/lib/format";
import { etatJuridiqueMedInfo } from "../../shared/lib/juridique";

interface Col {
  label: string;
  align?: "left" | "right" | "center";
  cell: (r: DbRow, accent: AccentTheme) => ReactNode;
}

const statutBadge = (s: string) =>
  s === "Actif"
    ? "bg-green-100 text-green-700"
    : s === "Suspendu"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

const localite = (r: DbRow) => (
  <span className="text-gray-600">{!r.commune || r.commune === r.wilaya ? r.wilaya : `${r.commune}, ${r.wilaya}`}</span>
);
const idCell = (r: DbRow, a: AccentTheme) => <span className={`font-mono text-sm ${a.text}`}>{r.id}</span>;
const nameCell = (r: DbRow) => (
  <span className="block max-w-[15rem] truncate text-[#1C2235]" title={r.displayName}>
    {r.displayName}
  </span>
);
const serviceCell = (r: DbRow) => (
  <span className="block max-w-[9rem] truncate text-gray-600" title={r.typeService}>
    {r.typeService}
  </span>
);
const monoCell = (v: string) => <span className="font-mono text-sm text-gray-600">{v || <em className="text-gray-300 not-italic">—</em>}</span>;
const soldeCell = (r: DbRow) => (
  <span className={`font-mono font-medium ${r.solde > 0 ? "text-red-600" : "text-green-600"}`}>{fmtDA(r.solde)}</span>
);
const statutCell = (r: DbRow) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statutBadge(r.statut)}`}>{r.statut || "—"}</span>
);
const juridiqueCell = (r: DbRow) => {
  const s = stadeInfo(r.stade);
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${s.badge}`}>{s.court}</span>;
};

/**
 * Avant / Après Gaïa: one column per real table column, headed with its exact
 * SQL name (NULL stays blank), followed by the two computed columns.
 */
const AVANT_FIELDS: (keyof AvantGaiaRow)[] = [
  "ref", "actel", "n_abonne", "intitule", "adresse_01", "adresse_02", "dnpf", "type_de_compte", "abonnement", "dus_anterieur",
  "montant_compteur", "nombre_ticket", "montant_ticket", "credit", "code_payeur", "n_ccp", "somme_ht", "ttc", "tva",
  "nouveau_index", "avoir", "n_bimestre", "annee_bimestre", "n_s_t", "created_at", "updated_at",
];
const APRES_FIELDS: (keyof ApresGaiaRow)[] = [
  "n", "codetat", "codsit", "cg", "n_appel", "intitule", "adresse", "code_postal", "type_de_compte", "abonnement", "dus_ant",
  "montant_compteur", "nbre_ticket", "ticket", "credit", "code_payeur", "ccp", "date_vigueur_abt", "date_derniere_modif",
  "cod_cpt", "nouvel_index", "ancien_index", "date_rnp", "dnpf", "repere", "actel", "n_client", "commune", "bat", "esc",
  "etage", "porte", "ccat", "ndos", "nvdi", "motif_res", "created_at", "updated_at",
];
const MONEY_FIELDS = new Set([
  "abonnement", "dus_anterieur", "dus_ant", "montant_compteur", "montant_ticket", "ticket", "credit", "somme_ht", "ttc", "tva", "avoir",
]);
const HEADER_LABEL: Record<string, string> = { motif_res: "motif res", dus_anterieur: "dus Anterieur" }; // SQL names with a space
const KEY_FIELDS = new Set(["n_abonne", "n"]);

const fieldCol = (field: string): Col => ({
  label: HEADER_LABEL[field] ?? field,
  align: MONEY_FIELDS.has(field) ? "right" : undefined,
  cell: (r, a) => {
    const v = (r.raw as unknown as Record<string, string | number | null>)[field];
    if (v === null || v === undefined || v === "") return null;
    if (MONEY_FIELDS.has(field)) return <span className="font-mono">{fmtDA(Number(v))}</span>;
    if (field.endsWith("_at")) return <span className="font-mono text-xs text-gray-500">{String(v).slice(0, 16).replace("T", " ")}</span>;
    if (KEY_FIELDS.has(field)) return <span className={`font-mono text-sm ${a.text}`}>{String(v)}</span>;
    return <span className="block max-w-[15rem] truncate text-[#1C2235]" title={String(v)}>{String(v)}</span>;
  },
});

const COMPUTED: Col[] = [
  { label: "Solde dû (calculé)", align: "right", cell: soldeCell },
  { label: "État juridique", align: "center", cell: juridiqueCell },
];

/* ---------- Après Gaïa, monthly extraction: identity + versements + MED ---------- */

const pill = (done: boolean, label: string, date?: string | null) => (
  <span className="inline-flex flex-col items-center leading-tight">
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
      {label}
    </span>
    {done && date && <span className="font-mono text-[11px] text-gray-500 mt-0.5">{fmtDate(date)}</span>}
  </span>
);

const dash = <em className="text-gray-300 not-italic">—</em>;

const APRES_EXTRACTION: Col[] = [
  fieldCol("n"),
  fieldCol("intitule"),
  fieldCol("n_appel"),
  fieldCol("adresse"),
  fieldCol("commune"),
  { label: "Solde dû (calculé)", align: "right", cell: soldeCell },
  {
    label: "Versements",
    align: "center",
    cell: (r) => {
      const v = r.apres?.versements;
      if (!v || v.valides + v.enAttente + v.refuses === 0) return <span className="text-xs text-gray-400">Aucun</span>;
      return (
        <span className="inline-flex flex-col items-center gap-0.5 text-xs leading-tight">
          <span className="text-green-700">{v.valides} validé{v.valides > 1 ? "s" : ""}</span>
          {v.enAttente > 0 && <span className="text-amber-700">{v.enAttente} en attente</span>}
          {v.refuses > 0 && <span className="text-gray-400">{v.refuses} refusé{v.refuses > 1 ? "s" : ""}</span>}
        </span>
      );
    },
  },
  {
    label: "Total versé (validé)",
    align: "right",
    cell: (r) => {
      const v = r.apres?.versements;
      return v && v.totalValide > 0 ? <span className="font-mono">{fmtDA(v.totalValide)}</span> : dash;
    },
  },
  {
    label: "Dernier versement",
    align: "right",
    cell: (r) => {
      const v = r.apres?.versements;
      if (!v || !v.dernierDate) return dash;
      return (
        <span className="inline-flex flex-col items-end leading-tight">
          <span className="font-mono">{fmtDA(v.dernierMontant)}</span>
          <span className="font-mono text-[11px] text-gray-500">{fmtDate(v.dernierDate)}</span>
        </span>
      );
    },
  },
  {
    label: "Invitation de paiement",
    align: "center",
    cell: (r) => pill(r.apres?.med?.invitation_paiement_etat === "ENVOYEE", r.apres?.med?.invitation_paiement_etat === "ENVOYEE" ? "Envoyée" : "Non envoyée", r.apres?.med?.invitation_paiement_date),
  },
  {
    label: "MED par lettre",
    align: "center",
    cell: (r) => pill(r.apres?.med?.med_lettre_etat === "ENVOYEE", r.apres?.med?.med_lettre_etat === "ENVOYEE" ? "Envoyée" : "Non envoyée", r.apres?.med?.med_lettre_date),
  },
  {
    label: "Engagement",
    align: "center",
    cell: (r) => {
      const m = r.apres?.med;
      return (
        <span className="inline-flex flex-col items-center leading-tight">
          {pill(m?.engagement_etat === "ENGAGE", m?.engagement_etat === "ENGAGE" ? "Engagé" : "Non engagé", m?.engagement_date)}
          {m?.cas_particulier && (
            <span className="mt-1 max-w-[10rem] truncate text-[11px] text-amber-800" title={m.cas_particulier}>
              Cas : {m.cas_particulier}
            </span>
          )}
        </span>
      );
    },
  },
  {
    label: "MED huissier",
    align: "center",
    cell: (r) => {
      const m = r.apres?.med;
      const nom = [m?.med_huissier_nom, m?.med_huissier_prenom].filter(Boolean).join(" ");
      return (
        <span className="inline-flex flex-col items-center leading-tight">
          {pill(m?.med_huissier_etat === "ENVOYEE", m?.med_huissier_etat === "ENVOYEE" ? "Envoyée" : "Non envoyée", m?.med_huissier_date)}
          {m?.med_huissier_etat === "ENVOYEE" && nom && <span className="text-[11px] text-gray-500 mt-0.5 max-w-[9rem] truncate" title={nom}>{nom}</span>}
        </span>
      );
    },
  },
  {
    label: "État juridique",
    align: "center",
    cell: (r) => {
      const e = etatJuridiqueMedInfo(r.apres?.med?.etat_juridique);
      return <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${e.badge}`}>{e.court}</span>;
    },
  },
];

const COLUMNS: Record<DbKind, Col[]> = {
  avant: [...AVANT_FIELDS.map(fieldCol), ...COMPUTED],
  apres: [...APRES_FIELDS.map(fieldCol), ...COMPUTED],
  entreprise: [
    { label: "N° Compte", cell: idCell },
    {
      label: "Raison sociale / NIF",
      cell: (r) => (
        <div>
          {nameCell(r)}
          <span className="block font-mono text-xs text-gray-400">{r.nif ? `NIF ${r.nif}` : "NIF manquant"}</span>
        </div>
      ),
    },
    { label: "Commune, wilaya", cell: localite },
    { label: "Service", cell: serviceCell },
    { label: "TTC", align: "right", cell: (r) => <span className="font-mono">{fmtDA(r.montant)}</span> },
    { label: "Solde dû", align: "right", cell: soldeCell },
    { label: "Statut", align: "center", cell: statutCell },
    { label: "État juridique", align: "center", cell: juridiqueCell },
  ],
};

const PAGE_SIZES = [50, 100, 250];

interface Props {
  kind: DbKind;
  rows: DbRow[];
  accent: AccentTheme;
  onOpen: (r: DbRow) => void;
  emptyText?: string;
  /**
   * "extraction" (Après Gaïa only): compact identity columns followed by the versements and
   * MED details, instead of the 38 raw table columns. The full table stays in « Consultation ».
   */
  variant?: "full" | "extraction";
}

export default function RowsTable({ kind, rows, accent, onOpen, emptyText, variant = "full" }: Props) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(100);
  const pages = Math.max(1, Math.ceil(rows.length / size));

  // go back to the first page whenever the result set changes
  useEffect(() => setPage(0), [rows, size]);
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * size, cur * size + size);
  const cols = kind === "apres" && variant === "extraction" ? APRES_EXTRACTION : COLUMNS[kind];
  const hover = accent.hoverLight;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto bg-white border border-gray-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.label}
                  className={`px-3 py-2.5 text-xs text-gray-500 font-medium whitespace-nowrap ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={r.rowKey}
                onClick={() => onOpen(r)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(r)}
                className={`border-b border-gray-100 cursor-pointer transition-colors ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                } ${hover}`}
              >
                {cols.map((c) => (
                  <td
                    key={c.label}
                    className={`px-3 py-2.5 whitespace-nowrap ${
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                    }`}
                  >
                    {c.cell(r, accent)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-12 text-center text-gray-400">
                  {emptyText ?? "Aucun résultat. Assouplissez les filtres pour élargir la recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between pt-2 text-sm text-gray-600 flex-shrink-0">
        <span>
          {rows.length === 0
            ? "0 ligne"
            : `Lignes ${(cur * size + 1).toLocaleString("fr-FR")} à ${Math.min(rows.length, cur * size + size).toLocaleString("fr-FR")} sur ${rows.length.toLocaleString("fr-FR")}`}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Lignes par page
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-sm"
            >
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
            {cur + 1} / {pages.toLocaleString("fr-FR")}
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
