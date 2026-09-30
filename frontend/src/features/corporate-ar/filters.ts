import { CorporateClient } from "./types";
import { isOneYearOld } from "./invoiceAge";

export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export interface CorpFilters {
  search: string;
  designation: string;
  observation: string;
  creanceMin: string;
  creanceMax: string;
  dateFrom: string;
  dateTo: string;
  oneYear: boolean;
  requireNumero: boolean;
  requireDate: boolean;
  docs: "tous" | "avec" | "sans";
}

export const emptyCorpFilters: CorpFilters = {
  search: "",
  designation: "",
  observation: "",
  creanceMin: "",
  creanceMax: "",
  dateFrom: "",
  dateTo: "",
  oneYear: false,
  requireNumero: false,
  requireDate: false,
  docs: "tous",
};

export function countActive(f: CorpFilters): number {
  return (Object.keys(emptyCorpFilters) as (keyof CorpFilters)[]).filter((k) => f[k] !== emptyCorpFilters[k]).length;
}

export function applyCorpFilters(rows: CorporateClient[], f: CorpFilters): CorporateClient[] {
  const q = norm(f.search);
  const min = f.creanceMin.trim() === "" ? -Infinity : Number(f.creanceMin);
  const max = f.creanceMax.trim() === "" ? Infinity : Number(f.creanceMax);
  return rows.filter((c) => {
    if (q && !norm(`${c.code} ${c.name} ${c.numeroFacture} ${c.designation} ${c.observation}`).includes(q)) return false;
    if (f.designation && c.designation !== f.designation) return false;
    if (f.observation && c.observation !== f.observation) return false;
    if (c.creance < min || c.creance > max) return false;
    if (f.dateFrom && (!c.dateFacture || c.dateFacture < f.dateFrom)) return false;
    if (f.dateTo && (!c.dateFacture || c.dateFacture > f.dateTo)) return false;
    if (f.oneYear && !isOneYearOld(c.dateFacture)) return false;
    if (f.requireNumero && !c.numeroFacture) return false;
    if (f.requireDate && !c.dateFacture) return false;
    if (f.docs === "avec" && c.files.length === 0) return false;
    if (f.docs === "sans" && c.files.length > 0) return false;
    return true;
  });
}

export const distinct = (rows: CorporateClient[], pick: (c: CorporateClient) => string) =>
  [...new Set(rows.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
