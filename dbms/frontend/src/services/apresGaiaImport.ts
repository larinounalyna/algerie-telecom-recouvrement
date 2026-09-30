import type { ApresGaiaInsert } from "../types";
import { toISODate } from "../shared/lib/format";

/**
 * CSV → `apres_gaia` rows. The header must use the real column names (the
 * "Exporter" button of the Base de données produces exactly that), so an
 * exported file can be re-imported. `n`, `created_at`, `updated_at`, and any
 * unknown column (solde, état juridique…) are ignored: the database sets them.
 */

const INT_COLUMNS = [
  "codetat", "codsit", "cg", "code_postal", "type_de_compte", "nbre_ticket", "code_payeur", "ccp",
  "cod_cpt", "nouvel_index", "ancien_index", "n_client", "ccat", "ndos",
] as const;
const DECIMAL_COLUMNS = ["abonnement", "dus_ant", "montant_compteur", "ticket", "credit"] as const;
const DATE_COLUMNS = ["date_vigueur_abt", "date_derniere_modif", "date_rnp", "dnpf"] as const;
const TEXT_COLUMNS = [
  "n_appel", "intitule", "adresse", "repere", "actel", "commune", "bat", "esc", "etage", "porte", "nvdi", "motif_res",
] as const;

// The SQL column is named "motif res" (with a space).
const HEADER_ALIASES: Record<string, string> = { "motif res": "motif_res", motif_res: "motif_res" };

const toNumber = (v: string): number | null => {
  const s = v.trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export interface ParsedImport {
  rows: ApresGaiaInsert[];
  /** Lines that contained none of the known columns. */
  ignored: number;
}

export function parseApresGaiaCsv(raw: Record<string, string>[]): ParsedImport {
  const rows: ApresGaiaInsert[] = [];
  let ignored = 0;

  for (const line of raw) {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(line)) r[HEADER_ALIASES[k.trim()] ?? k.trim()] = v ?? "";

    const out: Record<string, string | number | null> = {};
    for (const c of INT_COLUMNS) if (c in r) out[c] = (() => { const n = toNumber(r[c]); return n === null ? null : Math.trunc(n); })();
    for (const c of DECIMAL_COLUMNS) if (c in r) out[c] = toNumber(r[c]);
    for (const c of DATE_COLUMNS) if (c in r) out[c] = toISODate(r[c]) || null;
    for (const c of TEXT_COLUMNS) if (c in r) out[c] = r[c].trim() || null;

    if (Object.values(out).every((v) => v === null)) ignored++;
    else rows.push(out as ApresGaiaInsert);
  }
  return { rows, ignored };
}
