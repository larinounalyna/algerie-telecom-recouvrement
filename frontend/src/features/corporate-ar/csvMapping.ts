import { CorporateClient, CorporateInput, DESIGNATIONS, OBSERVATIONS } from "./types";

/* ---------- helpers ---------- */

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** "N° facture" → "nfacture": header comparison ignores case, accents and punctuation. */
const headerKey = (h: string) => strip(h).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Parses "1 500,50", "1.500,50", "1500.5", "1500 DA"… Returns null when unreadable. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0\u202f]/g, "").replace(/da|dzd/gi, "");
  if (s === "") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // the right-most separator is the decimal one, the other groups thousands
    const dec = lastComma > lastDot ? "," : ".";
    s = s.split(dec === "," ? "." : ",").join("").replace(dec, ".");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** Accepts yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy. Returns ISO, "" if empty, null if unreadable. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return "";
  let y: number, m: number, d: number;
  let mt = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s))) [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "equipement" → "Équipement": snaps to a preset when it matches one, otherwise keeps the free text. */
function snapToPreset(value: string, presets: readonly string[]): string {
  const v = value.trim();
  const k = headerKey(v);
  return presets.find((p) => headerKey(p) === k) ?? v;
}

/* ---------- import ---------- */

type Field = "code" | "name" | "creance" | "numeroFacture" | "dateFacture" | "designation" | "observation";

const ALIASES: Record<Field, string[]> = {
  code: ["code", "codeclient", "cle", "id", "key"],
  name: ["nom", "name", "raisonsociale", "societe", "entreprise", "client", "intitule"],
  creance: ["creance", "creances", "montant", "solde", "soldedu", "montantdu", "dette"],
  numeroFacture: ["numerofacture", "numerodefacture", "nfacture", "numfacture", "nofacture", "nfact", "numfact", "facture"],
  dateFacture: ["datefacture", "datedefacture", "datefact", "date"],
  designation: ["designation"],
  observation: ["observation", "observations", "remarque", "remarques"],
};

export interface ImportedRow extends CorporateInput {
  /** Present only when the file carried a key; otherwise one is generated on insert. */
  code?: string;
}

export interface ParsedImport {
  rows: ImportedRow[];
  /** Rows dropped because they have no name. */
  ignored: number;
  /** Dates that could not be read (imported with an empty date). */
  badDates: number;
  /** Créances that could not be read (imported as 0). */
  badAmounts: number;
  /** false when the header has no recognisable "nom" column. */
  recognised: boolean;
}

export function parseImport(raw: Record<string, string>[]): ParsedImport {
  const out: ParsedImport = { rows: [], ignored: 0, badDates: 0, badAmounts: 0, recognised: false };
  if (raw.length === 0) return out;

  const map: Partial<Record<Field, string>> = {};
  for (const header of Object.keys(raw[0])) {
    const k = headerKey(header);
    for (const f of Object.keys(ALIASES) as Field[]) if (!map[f] && ALIASES[f].includes(k)) map[f] = header;
  }
  if (!map.name) return out;
  out.recognised = true;

  const get = (r: Record<string, string>, f: Field) => (map[f] ? (r[map[f]!] ?? "").trim() : "");

  for (const r of raw) {
    const name = get(r, "name");
    if (!name) {
      out.ignored++;
      continue;
    }
    const amountRaw = get(r, "creance");
    const amount = amountRaw === "" ? 0 : parseAmount(amountRaw);
    if (amount === null) out.badAmounts++;

    const dateRaw = get(r, "dateFacture");
    const date = parseDate(dateRaw);
    if (date === null) out.badDates++;

    const code = get(r, "code");
    out.rows.push({
      ...(code ? { code } : {}),
      name,
      creance: amount ?? 0,
      numeroFacture: get(r, "numeroFacture"),
      dateFacture: date ?? "",
      designation: snapToPreset(get(r, "designation"), DESIGNATIONS),
      observation: snapToPreset(get(r, "observation"), OBSERVATIONS),
    });
  }
  return out;
}

/* ---------- export ---------- */

/** Headers are the ones parseImport understands, so an export can be re-imported as is. */
export function toExportRows(list: CorporateClient[]): Record<string, string>[] {
  return list.map((c) => ({
    Code: c.code,
    Nom: c.name,
    Créance: String(c.creance).replace(".", ","),
    "Numéro de facture": c.numeroFacture,
    "Date de facture": c.dateFacture,
    Désignation: c.designation,
    Observation: c.observation,
    "Documents joints": String(c.files.length),
  }));
}
