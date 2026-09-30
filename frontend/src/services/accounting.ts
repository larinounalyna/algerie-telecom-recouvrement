import type { ApresGaiaReglementRow, ApresGaiaRow, AvantGaiaRow, AvantGaiaVersementRow } from "../types";

/**
 * Balance rules, used ONLY to fill the "Base de données" tables in one pass.
 * They mirror backend/app/crud.py (build_profile / build_apres_gaia_profile);
 * the per-client endpoints stay the source of truth for the detail screens.
 * If the business rule changes in the backend, change it here too.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** apres_gaia has no TTC column: TTC = abonnement + dus_ant + montant_compteur. */
export const apresMontantTTC = (r: Pick<ApresGaiaRow, "abonnement" | "dus_ant" | "montant_compteur">): number =>
  round2((r.abonnement ?? 0) + (r.dus_ant ?? 0) + (r.montant_compteur ?? 0));

/** n_abonne → max(0, Σ ttc of all its bimestres − Σ versements). */
export function computeAvantSoldes(rows: AvantGaiaRow[], versements: AvantGaiaVersementRow[]): Map<string, number> {
  const billed = new Map<string, number>();
  for (const r of rows) {
    if (r.n_abonne) billed.set(r.n_abonne, (billed.get(r.n_abonne) ?? 0) + (r.ttc ?? 0));
  }
  const paid = new Map<string, number>();
  for (const v of versements) {
    if (v.n_abonne) paid.set(v.n_abonne, (paid.get(v.n_abonne) ?? 0) + (v.montant_versement ?? 0));
  }
  const out = new Map<string, number>();
  for (const [id, total] of billed) out.set(id, Math.max(0, round2(total - (paid.get(id) ?? 0))));
  return out;
}

/** n → max(0, TTC − Σ règlements whose statut is 'valide'). */
export function computeApresSoldes(rows: ApresGaiaRow[], reglements: ApresGaiaReglementRow[]): Map<number, number> {
  const paid = new Map<number, number>();
  for (const g of reglements) {
    if (g.statut === "valide") paid.set(g.n, (paid.get(g.n) ?? 0) + (g.somme_versement ?? 0));
  }
  const out = new Map<number, number>();
  for (const r of rows) out.set(r.n, Math.max(0, round2(apresMontantTTC(r) - (paid.get(r.n) ?? 0))));
  return out;
}
