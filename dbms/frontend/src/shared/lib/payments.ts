export const MIN_TRANCHE = 2000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A tranche must be at least MIN_TRANCHE DA, unless the remaining balance
 * itself is smaller than MIN_TRANCHE — in that case the client simply pays
 * off whatever is left. It can never exceed the remaining balance.
 *
 * `pending` = règlements already recorded but not validated yet: they don't
 * lower `solde` (the backend only counts validated ones) but they are
 * already promised, so they are kept out of what can still be encaissé.
 */
export function trancheBounds(solde: number, pending = 0) {
  const max = Math.max(0, round2(solde - pending));
  const min = max <= 0 ? 0 : Math.min(MIN_TRANCHE, max);
  return { min, max };
}

export function validateTranche(amount: number, solde: number, pending = 0): string | null {
  if (solde <= 0) return "Ce client n'a plus aucun montant à payer.";
  if (round2(solde - pending) <= 0) return "Les versements en attente couvrent déjà le solde dû : validez-les d'abord.";
  if (!amount || amount <= 0) return "Entrez un montant valide.";

  const { min, max } = trancheBounds(solde, pending);

  if (amount > max) {
    return `Le montant ne peut pas dépasser ${max.toLocaleString("fr-FR")} DA (solde dû moins les versements en attente).`;
  }
  if (amount < min) {
    return `Le montant minimum d'une tranche est de ${MIN_TRANCHE.toLocaleString("fr-FR")} DA.`;
  }
  return null;
}
