import { LegacyAccountClient, PaymentTranche } from "../types";

export { generateNumCompte, generateCodeClient } from "../shared/lib/generators";

/*
 * Local demo data helpers. Avant Gaïa and Après Gaïa no longer use mock data
 * (they read the real database through the API); this file only keeps what the
 * Entreprises demo data (entreprisesData.ts, demoData.ts) is built from.
 */

export interface ApresSeed {
  numCompte: string;
  codeClient: string;
  nom: string;
  prenom: string;
  adresse: string;
  commune: string;
  wilaya: string;
  codePostal: string;
  telephoneFixe: string;
  gsm: string;
  email: string;
  typeService: string;
  debit: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  solde: number;
  dateCreation: string;
  statut: string;
}

const MOTIFS_RESILIATION = [
  "Non paiement",
  "Demande client",
  "Déménagement",
  "Changement d'opérateur",
  "Fraude / anomalie compteur",
];

export function deriveApres(seed: ApresSeed, i: number, resilie: boolean): LegacyAccountClient {
  const digits = seed.numCompte.replace(/\D/g, "");
  const ancien = 40000 + i * 900;
  const consommation = 90 + (i % 5) * 20;
  const versements = Math.max(0, seed.montantTTC - seed.solde);

  const historique: PaymentTranche[] =
    versements > 0
      ? [
          {
            id: `V-${digits}-1`,
            montant: Math.round(versements * 0.5 * 100) / 100,
            date: "2024-01-10",
            agent: "N. Cherif",
          },
          ...(versements * 0.5 >= 1
            ? [
                {
                  id: `V-${digits}-2`,
                  montant: Math.round(versements * 0.5 * 100) / 100,
                  date: "2024-02-18",
                  agent: "H. Merad",
                },
              ]
            : []),
        ]
      : [];

  return {
    numCompte: seed.numCompte,
    codeClient: seed.codeClient,
    numClient: digits.slice(-6),
    numAppel: (seed.telephoneFixe || seed.gsm).replace(/\D/g, ""),
    codetat: resilie ? "09" : "01",
    codsit: resilie ? "R" : "A",
    cg: String(1 + (i % 3)),
    intitule: `${seed.nom} ${seed.prenom}`,
    nom: seed.nom,
    prenom: seed.prenom,
    adresse: seed.adresse,
    commune: seed.commune,
    wilaya: seed.wilaya,
    codePostal: seed.codePostal,
    telephoneFixe: seed.telephoneFixe,
    gsm: seed.gsm,
    email: seed.email,
    typeService: seed.typeService,
    typeCompte: seed.typeService.includes("Tél") || seed.typeService === "ADSL" ? "Résidentiel" : "Professionnel",
    debit: seed.debit,
    abonnement: 700 + (i % 4) * 100,
    dusAnterieurs: seed.montantTTC,
    compteur: `CPT-${2000 + i}`,
    nbreTicket: i % 3,
    ticket: (i % 3) * 600,
    credit: i % 4 === 0 ? 500 : 0,
    codePayeur: digits.padStart(7, "0"),
    ccp: String(20 + (i % 5)),
    dateVigueurAbt: seed.dateCreation,
    dateDerniereModif: seed.dateCreation,
    codcpt: `CODCPT-${i}`,
    nouvelIndex: String(ancien + consommation),
    ancienIndex: String(ancien),
    dateRNP: resilie ? seed.dateCreation : "",
    dnpf: resilie ? "Oui" : "Non",
    repere: `${seed.commune.slice(0, 3).toUpperCase()}-${i}`,
    actel: `Actel ${seed.commune}`,
    bat: resilie ? String.fromCharCode(65 + (i % 6)) : "",
    esc: resilie ? String(1 + (i % 3)) : "",
    etage: resilie ? String(1 + (i % 5)) : "",
    porte: resilie ? String(10 + i) : "",
    ccat: resilie ? `CCAT-${i}` : "",
    ndos: resilie ? `DOS-2024-${(1000 + i).toString()}` : "",
    invoie: resilie ? "Oui" : "Non",
    motifRes: resilie ? MOTIFS_RESILIATION[i % MOTIFS_RESILIATION.length] : "",
    dateResiliation: resilie ? "27/11/2024" : undefined,
    // TVA is subtracted FROM the TTC total (not added on top of HT):
    // HT = TTC − TVA, where TVA = TTC × taux.
    montantHT: Math.round((seed.montantTTC - seed.montantTTC * (seed.tva / 100)) * 100) / 100,
    tva: seed.tva,
    montantTTC: seed.montantTTC,
    versements,
    solde: seed.solde,
    dateCreation: seed.dateCreation,
    statut: resilie ? "Résilié" : seed.statut,
    commentaire: "",
    historique,
  };
}
