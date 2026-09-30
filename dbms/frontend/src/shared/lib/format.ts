export const fmtDA = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(n) + " DA";

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
};

export const todayISO = () => new Date().toISOString().split("T")[0];

/**
 * Parses the two date formats found in the data ("dd/mm/yyyy" from the legacy
 * exports and ISO "yyyy-mm-dd") and returns an ISO date, or "" if unreadable.
 */
export function toISODate(value: string | undefined | null): string {
  if (!value) return "";
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  return "";
}

export const currentMonth = () => new Date().toISOString().slice(0, 7); // yyyy-mm

export const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  const names = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${names[Number(m) - 1] ?? m} ${y}`;
};

export const daysBetween = (fromISO: string, to: Date = new Date()) =>
  Math.floor((to.getTime() - new Date(fromISO).getTime()) / 86400000);

/** DB value → display string: `null`/`undefined` become an empty string (blank field). */
export const txt = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v));

/** "2024-05-03T10:00:00+00:00" → "2024-05-03" (dates coming from the API). */
export const isoDay = (v: string | null | undefined): string => (v ? v.slice(0, 10) : "");

/** Like fmtDA, but a missing (NULL) amount stays blank instead of showing "0,00 DA". */
export const fmtDAOrBlank = (n: number | null | undefined): string => (n === null || n === undefined ? "" : fmtDA(n));
