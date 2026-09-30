/** True when the invoice date is one year old or more (calendar-accurate, leap years included). */
export function isOneYearOld(dateISO: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!m) return false;
  const anniversary = new Date(Number(m[1]) + 1, Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return today.getTime() >= anniversary.getTime();
}

/** Age as "1 an", "2 ans et 3 mois", "5 mois"… for display next to the alert. */
export function invoiceAgeLabel(dateISO: string, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!m) return "";
  let months = (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() - (Number(m[2]) - 1));
  if (now.getDate() < Number(m[3])) months -= 1;
  if (months < 0) return "";
  const y = Math.floor(months / 12);
  const r = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} an${y > 1 ? "s" : ""}`);
  if (r > 0) parts.push(`${r} mois`);
  return parts.length ? parts.join(" et ") : "moins d'un mois";
}
