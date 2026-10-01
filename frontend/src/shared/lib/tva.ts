/**
 * TVA: 19 %, INCLUSE dans les montants TTC (mêmes règles que backend/app/crud.py::split_ttc,
 * taux `TVA_RATE` du fichier .env du backend).
 *
 *   TVA = TTC × taux / (100 + taux)      HT = TTC − TVA
 *
 * Exemple : TTC 2 000,00 → TVA 319,33 · HT 1 680,67 (et non TVA 380,00 : le taux ne se
 * calcule pas sur le TTC, il se « sort » du TTC).
 */
export const TVA_RATE = 19;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function splitTTC(ttc: number, rate: number = TVA_RATE): { tva: number; ht: number } {
  const tva = round2((ttc * rate) / (100 + rate));
  return { tva, ht: round2(ttc - tva) };
}
