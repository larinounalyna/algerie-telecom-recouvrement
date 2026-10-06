export function exportToCSV<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (rows.length === 0) return;
  // Union of the keys of every row (a row may omit optional fields).
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  const headers = [...keys].filter((k) => k !== "historique" && k !== "consommationHistorique");
  const escape = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The separator is decided ONCE, from the header line: ";" (French Excel) or ",". Deciding per
 * character would cut a French decimal such as 12,5 in two in a ";"-separated file.
 */
function detectDelimiter(headerLine: string): ";" | "," {
  let semi = 0;
  let comma = 0;
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ";") semi++;
    else if (!inQuotes && ch === ",") comma++;
  }
  return comma > semi ? "," : ";";
}

function parseCSVLine(line: string, delimiter: ";" | ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function importFromCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row;
  });
}
