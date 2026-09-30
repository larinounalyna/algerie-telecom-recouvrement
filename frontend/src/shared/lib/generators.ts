export function generateNumCompte(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000 + 100000);
  return `NR-${year}-${rand}`;
}

export function generateCodeClient(num: string): string {
  return "CLT" + num.replace(/\D/g, "").slice(-6);
}

export function generateFactureNum(prefix: "FAC-HG" | "FAC-GA" | "REC-HG" | "REC-GA"): string {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0")}`;
}

export function generateTrancheId(): string {
  return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function generateConsommationId(): string {
  return `CONS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function generateMiseEnDemeureNum(): string {
  return `MED-${new Date().getFullYear()}-${Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, "0")}`;
}
