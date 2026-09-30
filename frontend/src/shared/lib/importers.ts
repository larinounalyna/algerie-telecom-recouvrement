import { EntrepriseClient, LegacyAccountClient } from "../../types";

// CSV import of the Entreprises database (local data). Après Gaïa has its own
// import, wired to the API: see services/apresGaiaImport.ts.

/** Maps one CSV row (headers = field names, as produced by the export) to a client. */
function toAccountClient(row: Record<string, string>): LegacyAccountClient {
  const num = (k: string) => Number(String(row[k] ?? "0").replace(",", ".")) || 0;
  return {
    numCompte: row.numCompte || "",
    codeClient: row.codeClient || "",
    numClient: row.numClient || "",
    numAppel: row.numAppel || "",
    codetat: row.codetat || "",
    codsit: row.codsit || "",
    cg: row.cg || "",
    intitule: row.intitule || `${row.nom || ""} ${row.prenom || ""}`.trim(),
    nom: row.nom || "",
    prenom: row.prenom || "",
    adresse: row.adresse || "",
    commune: row.commune || "",
    wilaya: row.wilaya || "",
    codePostal: row.codePostal || "",
    telephoneFixe: row.telephoneFixe || "",
    gsm: row.gsm || "",
    email: row.email || "",
    typeService: row.typeService || "",
    typeCompte: row.typeCompte || "",
    debit: row.debit || "",
    commentaire: row.commentaire || "",
    abonnement: num("abonnement"),
    dusAnterieurs: num("dusAnterieurs"),
    compteur: row.compteur || "",
    nbreTicket: num("nbreTicket"),
    ticket: num("ticket"),
    credit: num("credit"),
    codePayeur: row.codePayeur || "",
    ccp: row.ccp || "",
    dateVigueurAbt: row.dateVigueurAbt || "",
    dateDerniereModif: row.dateDerniereModif || "",
    codcpt: row.codcpt || "",
    nouvelIndex: row.nouvelIndex || "",
    ancienIndex: row.ancienIndex || "",
    dateRNP: row.dateRNP || "",
    dnpf: row.dnpf || "",
    repere: row.repere || "",
    actel: row.actel || "",
    bat: row.bat || "",
    esc: row.esc || "",
    etage: row.etage || "",
    porte: row.porte || "",
    ccat: row.ccat || "",
    ndos: row.ndos || "",
    invoie: row.invoie || "",
    motifRes: row.motifRes || "",
    dateResiliation: row.dateResiliation || undefined,
    montantHT: num("montantHT"),
    tva: num("tva") || 19,
    montantTTC: num("montantTTC"),
    versements: num("versements"),
    solde: num("solde"),
    dateCreation: row.dateCreation || new Date().toLocaleDateString("fr-FR"),
    statut: row.statut || "Résilié",
    historique: [],
  };
}

export function toEntrepriseClient(row: Record<string, string>): EntrepriseClient {
  const base = toAccountClient(row);
  const raison = row.raisonSociale || row.nom || row.intitule || "";
  return {
    ...base,
    nom: raison,
    prenom: "",
    intitule: raison,
    typeCompte: row.typeCompte || "Professionnel",
    raisonSociale: raison,
    formeJuridique: row.formeJuridique || "",
    nif: row.nif || "",
    rc: row.rc || "",
    nis: row.nis || "",
    secteur: row.secteur || "",
    representant: row.representant || "",
    fonctionRepresentant: row.fonctionRepresentant || "",
  };
}
