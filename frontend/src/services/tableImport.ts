import { apresGaiaApi, avantGaiaApi, corporateArApi } from "../api";
import type {
  ApresGaiaInsert,
  AvantGaiaInsert,
  AvantGaiaVersementInsert,
  DeleteAllResult,
  ReglementBulkInsert,
  ReglementStatut,
} from "../types";
import { toISODate } from "../shared/lib/format";
import { parseApresGaiaCsv } from "./apresGaiaImport";
import { insertApresGaiaRows } from "./apresGaiaService";

/**
 * CSV import (popup "Importer un fichier CSV") and "vider la table" (popup "Vider une table") for
 * every table of the Base de données screens. One registry per feature so the dialogs stay generic:
 *   - IMPORT_TABLES : avant_gaia, avant_gaia_versement, apres_gaia, apres_gaia_regelement
 *   - DELETE_TABLES : the same four + apres_gaia_med, apres_gaia_rappel, corporate_ar_client
 *
 * As for the existing Après Gaïa import, the CSV header must use the REAL column names (the
 * "Exporter" button produces exactly that). Matching ignores case and treats spaces as "_" (so the
 * SQL names "dus Anterieur" / "motif res" work too). Unknown columns are ignored.
 */

/* ------------------------------------------------------------------ */
/*  Column specs                                                       */
/* ------------------------------------------------------------------ */

export type ImportTableId = "avant_gaia" | "avant_gaia_versement" | "apres_gaia" | "apres_gaia_regelement";

type ColumnType = "int" | "decimal" | "date" | "text" | "statut";

export interface ImportColumn {
  name: string;
  type: ColumnType;
  /** A line without a usable value here is rejected (not sent). */
  required?: boolean;
}

const cols = (type: ColumnType, ...names: string[]): ImportColumn[] => names.map((name) => ({ name, type }));

const AVANT_GAIA_COLUMNS: ImportColumn[] = [
  ...cols("text", "actel", "n_abonne", "intitule", "adresse_01", "adresse_02"),
  ...cols("int", "dnpf", "type_de_compte"),
  ...cols("decimal", "abonnement", "dus_anterieur", "montant_compteur"),
  ...cols("int", "nombre_ticket"),
  ...cols("decimal", "montant_ticket", "credit"),
  ...cols("int", "code_payeur", "n_ccp"),
  ...cols("decimal", "somme_ht", "ttc", "tva"),
  ...cols("int", "nouveau_index"),
  ...cols("decimal", "avoir"),
  ...cols("int", "n_bimestre", "annee_bimestre", "n_s_t"),
];

const AVANT_VERSEMENT_COLUMNS: ImportColumn[] = [
  ...cols("text", "actel", "n_abonne"),
  ...cols("decimal", "montant_versement"),
  ...cols("int", "n_bimestre", "annee_bimestre", "n_versement"),
];

// Same columns as services/apresGaiaImport.ts (the parser actually used for this table).
const APRES_GAIA_COLUMNS: ImportColumn[] = [
  ...cols("int", "codetat", "codsit", "cg"),
  ...cols("text", "n_appel", "intitule", "adresse"),
  ...cols("int", "code_postal", "type_de_compte"),
  ...cols("decimal", "abonnement", "dus_ant", "montant_compteur"),
  ...cols("int", "nbre_ticket"),
  ...cols("decimal", "ticket", "credit"),
  ...cols("int", "code_payeur", "ccp"),
  ...cols("date", "date_vigueur_abt", "date_derniere_modif"),
  ...cols("int", "cod_cpt", "nouvel_index", "ancien_index"),
  ...cols("date", "date_rnp", "dnpf"),
  ...cols("text", "repere", "actel"),
  ...cols("int", "n_client"),
  ...cols("text", "commune", "bat", "esc", "etage", "porte"),
  ...cols("int", "ccat", "ndos"),
  ...cols("text", "nvdi", "motif_res"),
];

const REGLEMENT_COLUMNS: ImportColumn[] = [
  { name: "n", type: "int", required: true },
  ...cols("decimal", "somme_versement"),
  ...cols("date", "date_versement"),
  ...cols("text", "lieu_versement"),
  ...cols("statut", "statut"),
];

const STATUTS: readonly ReglementStatut[] = ["en_attente", "valide", "refuse"];

/* ------------------------------------------------------------------ */
/*  Generic parser                                                     */
/* ------------------------------------------------------------------ */

export interface ParsedTable<T> {
  rows: T[];
  /** Lines with none of the known columns filled in (or missing a required value). */
  ignored: number;
  /** Values that were present but unreadable (letters in a number, malformed date…) — left empty. */
  badValues: number;
  /** Header names found in the file that belong to the table / that don't. */
  recognizedColumns: string[];
  unknownColumns: string[];
}

const normalizeHeader = (h: string) => h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");

const toNumber = (v: string): number | null | "bad" => {
  const s = v.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : "bad";
};

export function parseByColumns<T>(raw: Record<string, string>[], columns: ImportColumn[]): ParsedTable<T> {
  const known = new Map(columns.map((c) => [c.name, c]));
  const headers = raw.length ? Object.keys(raw[0]) : [];
  const recognizedColumns: string[] = [];
  const unknownColumns: string[] = [];
  const headerMap = new Map<string, string>(); // header as written in the file -> column name
  for (const h of headers) {
    const norm = normalizeHeader(h);
    if (known.has(norm)) {
      headerMap.set(h, norm);
      recognizedColumns.push(norm);
    } else if (h.trim() !== "") {
      unknownColumns.push(h.trim());
    }
  }

  const rows: T[] = [];
  let ignored = 0;
  let badValues = 0;

  for (const line of raw) {
    const r: Record<string, string> = {};
    for (const [h, name] of headerMap) r[name] = line[h] ?? "";

    const out: Record<string, string | number | null> = {};
    let rejected = false;

    for (const c of columns) {
      if (!(c.name in r)) continue;
      const v = r[c.name];
      let value: string | number | null = null;

      if (c.type === "int" || c.type === "decimal") {
        const n = toNumber(v);
        if (n === "bad") badValues++;
        else value = n === null ? null : c.type === "int" ? Math.trunc(n) : n;
      } else if (c.type === "date") {
        value = toISODate(v) || null;
        if (value === null && v.trim() !== "") badValues++;
      } else if (c.type === "statut") {
        const s = v.trim().toLowerCase();
        if (s === "") value = null;
        else if ((STATUTS as readonly string[]).includes(s)) value = s;
        else {
          badValues++;
          value = null;
        }
      } else {
        value = v.trim() || null;
      }

      if (c.required && value === null) rejected = true;
      // `statut` can't be null on the server: an empty / invalid cell is left out, so it defaults to "en_attente".
      if (c.type === "statut" && value === null) continue;
      out[c.name] = value;
    }

    // Columns the file doesn't have at all: a required one makes every line unusable.
    if (columns.some((c) => c.required && !(c.name in out))) rejected = true;

    if (rejected || Object.values(out).every((v) => v === null)) ignored++;
    else rows.push(out as T);
  }

  return { rows, ignored, badValues, recognizedColumns, unknownColumns };
}

/* ------------------------------------------------------------------ */
/*  Chunked insert                                                     */
/* ------------------------------------------------------------------ */

const CHUNK = 2000;

/** Sends `rows` in chunks (a CSV can hold thousands of lines); returns how many were inserted. */
export async function insertChunked<T>(rows: T[], send: (chunk: T[]) => Promise<{ inserted: number }>, chunkSize = CHUNK): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    try {
      inserted += (await send(rows.slice(i, i + chunkSize))).inserted;
    } catch (e) {
      const reason = e instanceof Error ? e.message : "erreur inconnue";
      throw new Error(inserted > 0 ? `${inserted.toLocaleString("fr-FR")} ligne(s) insérée(s) avant l'échec : ${reason}` : reason);
    }
  }
  return inserted;
}

/* ------------------------------------------------------------------ */
/*  Import registry                                                    */
/* ------------------------------------------------------------------ */

export interface ImportContext {
  /** apres_gaia.n that exist (used to refuse règlements of unknown accounts BEFORE sending). */
  knownAccountNs?: Set<number>;
}

/** `unknownAccounts`: règlements refused before sending because their `n` isn't in apres_gaia. */
export type ParseResult = ParsedTable<Record<string, unknown>> & { unknownAccounts?: number[] };

export interface ImportTableSpec {
  id: ImportTableId;
  /** SQL table name. */
  table: string;
  /** Friendly name of the table. */
  title: string;
  description: string;
  columns: ImportColumn[];
  parse: (raw: Record<string, string>[], ctx: ImportContext) => ParseResult;
  insert: (rows: Record<string, unknown>[]) => Promise<number>;
}

export const IMPORT_TABLES: Record<ImportTableId, ImportTableSpec> = {
  avant_gaia: {
    id: "avant_gaia",
    table: "avant_gaia",
    title: "Factures bimestrielles",
    description: "Une ligne = une facture bimestrielle d'un abonné (N° abonné, bimestre, montants, index…).",
    columns: AVANT_GAIA_COLUMNS,
    parse: (raw) => parseByColumns<AvantGaiaInsert>(raw, AVANT_GAIA_COLUMNS),
    insert: (rows) => insertChunked(rows as AvantGaiaInsert[], (c) => avantGaiaApi.createRows(c)),
  },

  avant_gaia_versement: {
    id: "avant_gaia_versement",
    table: "avant_gaia_versement",
    title: "Versements",
    description: "Une ligne = un versement d'un abonné (N° abonné, montant, bimestre, N° de versement).",
    columns: AVANT_VERSEMENT_COLUMNS,
    parse: (raw) => parseByColumns<AvantGaiaVersementInsert>(raw, AVANT_VERSEMENT_COLUMNS),
    insert: (rows) => insertChunked(rows as AvantGaiaVersementInsert[], (c) => avantGaiaApi.createVersements(c)),
  },

  apres_gaia: {
    id: "apres_gaia",
    table: "apres_gaia",
    title: "Comptes résiliés",
    description: "Une ligne = un compte résilié. Le N° de compte (n) est attribué par la base : ne pas l'envoyer.",
    columns: APRES_GAIA_COLUMNS,
    // exactly the parser / insert already used by the Après Gaïa import
    parse: (raw) => {
      const p = parseApresGaiaCsv(raw);
      const headers = raw.length ? Object.keys(raw[0]).map(normalizeHeader) : [];
      const names = new Set(APRES_GAIA_COLUMNS.map((c) => c.name));
      return {
        rows: p.rows as Record<string, unknown>[],
        ignored: p.ignored,
        badValues: 0,
        recognizedColumns: headers.filter((h) => names.has(h)),
        unknownColumns: Object.keys(raw[0] ?? {}).filter((h) => !names.has(normalizeHeader(h)) && h.trim() !== ""),
      };
    },
    insert: (rows) => insertApresGaiaRows(rows as ApresGaiaInsert[]),
  },

  apres_gaia_regelement: {
    id: "apres_gaia_regelement",
    table: "apres_gaia_regelement",
    title: "Règlements",
    description:
      "Une ligne = un règlement d'un compte. La colonne n (N° de compte) est obligatoire et doit exister dans apres_gaia. Sans statut, le règlement est « en_attente ».",
    columns: REGLEMENT_COLUMNS,
    parse: (raw, ctx) => {
      const p = parseByColumns<ReglementBulkInsert>(raw, REGLEMENT_COLUMNS);
      if (!ctx.knownAccountNs) return p as unknown as ParseResult;
      // Refuse the lines of unknown accounts here: the server would reject the WHOLE request for them.
      const unknown = new Set<number>();
      const rows = p.rows.filter((r) => {
        if (ctx.knownAccountNs!.has(r.n)) return true;
        unknown.add(r.n);
        return false;
      });
      return { ...p, rows, ignored: p.ignored + (p.rows.length - rows.length), unknownAccounts: [...unknown].sort((a, b) => a - b) } as unknown as ParseResult;
    },
    insert: (rows) => insertChunked(rows as unknown as ReglementBulkInsert[], (c) => apresGaiaApi.createReglements(c)),
  },
};

/** The tables offered by the import popup of each database screen. */
export const IMPORT_TABLES_BY_KIND = {
  avant: ["avant_gaia", "avant_gaia_versement"],
  apres: ["apres_gaia", "apres_gaia_regelement"],
} as const satisfies Record<string, readonly ImportTableId[]>;

/** Header + one example line (the importer needs at least one data line), as a downloadable template. */
export function templateCsv(spec: ImportTableSpec): string {
  const example = (c: ImportColumn) => {
    switch (c.type) {
      case "int":
        return "1";
      case "decimal":
        return "1000.50";
      case "date":
        return "2026-01-31";
      case "statut":
        return "en_attente";
      default:
        return "exemple";
    }
  };
  return `\uFEFF${spec.columns.map((c) => c.name).join(";")}\n${spec.columns.map(example).join(";")}\n`;
}

/* ------------------------------------------------------------------ */
/*  "Vider la table" registry                                          */
/* ------------------------------------------------------------------ */

export type DeleteTableId =
  | "avant_gaia"
  | "avant_gaia_versement"
  | "apres_gaia"
  | "apres_gaia_regelement"
  | "apres_gaia_med"
  | "apres_gaia_rappel"
  | "corporate_ar_client";

export interface DeleteTableSpec {
  id: DeleteTableId;
  table: string;
  title: string;
  /** What else disappears with it (shown in red in the popup). */
  cascade?: string;
  run: (password: string) => Promise<DeleteAllResult>;
}

export const DELETE_TABLES: Record<DeleteTableId, DeleteTableSpec> = {
  avant_gaia: { id: "avant_gaia", table: "avant_gaia", title: "Factures bimestrielles", run: (p) => avantGaiaApi.deleteAllRows(p) },
  avant_gaia_versement: { id: "avant_gaia_versement", table: "avant_gaia_versement", title: "Versements", run: (p) => avantGaiaApi.deleteAllVersements(p) },
  apres_gaia: {
    id: "apres_gaia",
    table: "apres_gaia",
    title: "Comptes résiliés",
    cascade: "Supprime aussi TOUS les règlements, mises en demeure (MED) et rappels de ces comptes.",
    run: (p) => apresGaiaApi.deleteAllRows(p),
  },
  apres_gaia_regelement: {
    id: "apres_gaia_regelement",
    table: "apres_gaia_regelement",
    title: "Règlements",
    cascade: "Les comptes sont conservés ; leur solde dû est recalculé sans aucun règlement.",
    run: (p) => apresGaiaApi.deleteAllReglements(p),
  },
  apres_gaia_med: {
    id: "apres_gaia_med",
    table: "apres_gaia_med",
    title: "Mises en demeure / état juridique",
    cascade: "Efface les étapes MED, les engagements, les cas particuliers et l'état juridique de TOUS les comptes.",
    run: (p) => apresGaiaApi.deleteAllMed(p),
  },
  apres_gaia_rappel: {
    id: "apres_gaia_rappel",
    table: "apres_gaia_rappel",
    title: "Rappels de versement",
    cascade: "Les clients encore engagés sans versement seront de nouveau signalés au prochain contrôle automatique.",
    run: (p) => apresGaiaApi.deleteAllRappels(p),
  },
  corporate_ar_client: {
    id: "corporate_ar_client",
    table: "corporate_ar_client",
    title: "Entreprises (Corporate AR)",
    cascade: "Supprime aussi TOUS les documents joints. Les codes CAR-xxxxxx supprimés ne sont jamais réattribués.",
    run: (p) => corporateArApi.deleteAll(p),
  },
};

export const DELETE_TABLES_BY_KIND = {
  avant: ["avant_gaia", "avant_gaia_versement"],
  apres: ["apres_gaia", "apres_gaia_regelement", "apres_gaia_med", "apres_gaia_rappel"],
  corporate: ["corporate_ar_client"],
} as const satisfies Record<string, readonly DeleteTableId[]>;

/** "avant_gaia : 120 ligne(s) · apres_gaia_regelement : 4 ligne(s)" — the per-table result of a delete. */
export const describeDeleted = (r: DeleteAllResult): string =>
  Object.entries(r.details)
    .map(([table, n]) => `${table} : ${n.toLocaleString("fr-FR")} ligne(s)`)
    .join(" · ");
