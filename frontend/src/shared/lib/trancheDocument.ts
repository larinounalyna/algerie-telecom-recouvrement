import { DebtorView, PaymentTranche } from "../../types";
import type { FactureData } from "../../types";

export interface TrancheDocExtra {
  numClient?: string;
  dateResiliation?: string;
  montantHT?: number;
  tvaRate?: number;
  tvaAmount?: number;
  montantTTC?: number;
  debit?: string;
  direction?: string;
  service?: string;
  actel?: string;
  extraFields?: { label: string; value: string }[];
}

/**
 * Builds the Facture (before validation) or Reçu de Paiement (after
 * validation) document for one specific versement/tranche, given the
 * client's full payment history so we can compute the running balance at
 * the time of that tranche.
 */
export function buildTrancheDocument(
  client: DebtorView,
  tranche: PaymentTranche,
  dbLabel: string,
  identifiantLabel: string,
  numPrefix: "HG" | "GA" | "EN",
  extra?: TrancheDocExtra,
): FactureData {
  const sorted = [...client.historique].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const idx = sorted.findIndex((t) => t.id === tranche.id);
  const cumulative = sorted.slice(0, idx + 1).reduce((sum, t) => sum + t.montant, 0);
  const reste = Math.max(0, Math.round((client.montantTotal - cumulative) * 100) / 100);
  const billType: "partielle" | "globale" = reste === 0 ? "globale" : "partielle";

  return {
    numFacture: `${tranche.valide ? "REC" : "FAC"}-${numPrefix}-${tranche.id}`,
    dbLabel,
    billType,
    isReceipt: !!tranche.valide,
    numIdentifiant: client.id,
    identifiantLabel,
    nom: client.nom,
    prenom: client.prenom,
    adresse: client.adresse,
    commune: client.commune,
    wilaya: client.wilaya,
    telephone: client.telephone,
    typeService: client.typeService,
    debit: extra?.debit,
    montantDu: client.montantTotal,
    montantVerse: tranche.montant,
    reste,
    periode: "",
    datePaiement: tranche.date,
    agent: tranche.agent || "",
    numClient: extra?.numClient,
    dateResiliation: extra?.dateResiliation,
    montantHT: extra?.montantHT,
    tvaRate: extra?.tvaRate,
    tvaAmount: extra?.tvaAmount,
    montantTTC: extra?.montantTTC,
    direction: extra?.direction,
    service: extra?.service,
    actel: extra?.actel,
    extraFields: [
      ...(tranche.lieu ? [{ label: "Lieu de versement", value: tranche.lieu }] : []),
      ...(extra?.extraFields ?? []),
    ],
  };
}
