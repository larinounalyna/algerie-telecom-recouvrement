import { EntrepriseClient } from "../types";
import { ApresSeed, deriveApres } from "./mockData";

/**
 * Corporate customers. Same account model as Après Gaïa (numéro de compte,
 * facturation, historique…) but the account holder is a company.
 */
interface EntrepriseSeed extends ApresSeed {
  raisonSociale: string;
  formeJuridique: string;
  nif: string;
  rc: string;
  nis: string;
  secteur: string;
  representant: string;
  fonctionRepresentant: string;
}

const seeds: EntrepriseSeed[] = [
  {
    numCompte: "EN-2024-000101", codeClient: "CLT000101",
    raisonSociale: "SARL MEDITERRANEE LOGISTIQUE", formeJuridique: "SARL",
    nif: "000916019876543", rc: "16/00-1234567 B 09", nis: "000916010123456",
    secteur: "Transport & Logistique", representant: "BOUZID Karim", fonctionRepresentant: "Gérant",
    nom: "", prenom: "", adresse: "Zone Industrielle Oued Smar, Lot 14", commune: "El Harrach", wilaya: "Alger",
    codePostal: "16200", telephoneFixe: "023-82-14-50", gsm: "0550-201-101", email: "contact@medlog.dz",
    typeService: "Liaison spécialisée", debit: "200 Mb/s", montantHT: 84033.61, tva: 19, montantTTC: 100000, solde: 100000,
    dateCreation: "12/03/2021", statut: "Actif",
  },
  {
    numCompte: "EN-2023-000102", codeClient: "CLT000102",
    raisonSociale: "EURL TECHNO BUILD", formeJuridique: "EURL",
    nif: "001516024561234", rc: "16/00-2345678 B 13", nis: "001516010765432",
    secteur: "BTP", representant: "HAMIDI Sofiane", fonctionRepresentant: "Gérant",
    nom: "", prenom: "", adresse: "12 Rue Didouche Mourad", commune: "Alger Centre", wilaya: "Alger",
    codePostal: "16000", telephoneFixe: "021-63-25-88", gsm: "0661-302-102", email: "admin@technobuild.dz",
    typeService: "FTTH Pro", debit: "100 Mb/s", montantHT: 25210.08, tva: 19, montantTTC: 30000, solde: 18000,
    dateCreation: "05/09/2022", statut: "Actif",
  },
  {
    numCompte: "EN-2022-000103", codeClient: "CLT000103",
    raisonSociale: "SPA SIDER DISTRIBUTION", formeJuridique: "SPA",
    nif: "099816000345678", rc: "16/00-0456789 B 98", nis: "099816010234567",
    secteur: "Industrie sidérurgique", representant: "MEZIANE Abdelaziz", fonctionRepresentant: "Directeur général",
    nom: "", prenom: "", adresse: "Route Nationale 5, Dar El Beida", commune: "Bordj El Kiffan", wilaya: "Alger",
    codePostal: "16110", telephoneFixe: "023-79-40-12", gsm: "0770-403-103", email: "dg@siderdistrib.dz",
    typeService: "Liaison spécialisée", debit: "500 Mb/s", montantHT: 252100, tva: 19, montantTTC: 300000, solde: 245000,
    dateCreation: "01/02/2020", statut: "Résilié",
  },
  {
    numCompte: "EN-2024-000104", codeClient: "CLT000104",
    raisonSociale: "SARL PHARMA PLUS", formeJuridique: "SARL",
    nif: "002116031234567", rc: "16/00-3456789 B 15", nis: "002116010345678",
    secteur: "Pharmacie & Santé", representant: "LAKHDARI Nadia", fonctionRepresentant: "Gérante",
    nom: "", prenom: "", adresse: "24 Boulevard Colonel Amirouche", commune: "Hussein Dey", wilaya: "Alger",
    codePostal: "16040", telephoneFixe: "021-77-12-34", gsm: "0555-504-104", email: "pharmaplus@gmail.com",
    typeService: "ADSL Pro", debit: "20 Mb/s", montantHT: 8403.36, tva: 19, montantTTC: 10000, solde: 0,
    dateCreation: "18/01/2024", statut: "Actif",
  },
  {
    numCompte: "EN-2021-000105", codeClient: "CLT000105",
    raisonSociale: "SNC AGRO SETIF", formeJuridique: "SNC",
    nif: "001919012345678", rc: "19/00-4567890 B 10", nis: "001919010456789",
    secteur: "Agroalimentaire", representant: "BENHAMOU Djamel", fonctionRepresentant: "Cogérant",
    nom: "", prenom: "", adresse: "Zone d'activité El Hidhab", commune: "Sétif", wilaya: "Sétif",
    codePostal: "19000", telephoneFixe: "036-84-52-10", gsm: "0662-605-105", email: "info@agrosetif.dz",
    typeService: "FTTH Pro", debit: "100 Mb/s", montantHT: 42016.81, tva: 19, montantTTC: 50000, solde: 50000,
    dateCreation: "22/06/2021", statut: "Suspendu",
  },
  {
    numCompte: "EN-2023-000106", codeClient: "CLT000106",
    raisonSociale: "SARL HOTEL LES PALMIERS", formeJuridique: "SARL",
    nif: "002031045678901", rc: "31/00-5678901 B 12", nis: "002031010567890",
    secteur: "Hôtellerie & Tourisme", representant: "OUALI Mourad", fonctionRepresentant: "Gérant",
    nom: "", prenom: "", adresse: "Front de mer, Les Andalouses", commune: "Oran", wilaya: "Oran",
    codePostal: "31000", telephoneFixe: "041-33-70-25", gsm: "0771-706-106", email: "reservation@palmiers-oran.dz",
    typeService: "Pack Business", debit: "100 Mb/s", montantHT: 63025.21, tva: 19, montantTTC: 75000, solde: 37500,
    dateCreation: "14/04/2023", statut: "Actif",
  },
  {
    numCompte: "EN-2020-000107", codeClient: "CLT000107",
    raisonSociale: "EPE ENTREPRISE PORTUAIRE ANNABA", formeJuridique: "EPE",
    nif: "099523009876543", rc: "23/00-0678912 B 95", nis: "099523010678912",
    secteur: "Transport maritime & Ports", representant: "SAIDI Toufik", fonctionRepresentant: "Directeur général",
    nom: "", prenom: "", adresse: "Quai n°3, Port d'Annaba", commune: "Annaba", wilaya: "Annaba",
    codePostal: "23000", telephoneFixe: "038-86-10-77", gsm: "0550-807-107", email: "dg@epa-annaba.dz",
    typeService: "Liaison spécialisée", debit: "1 Gb/s", montantHT: 420168.07, tva: 19, montantTTC: 500000, solde: 420000,
    dateCreation: "09/11/2020", statut: "Résilié",
  },
  {
    numCompte: "EN-2024-000108", codeClient: "CLT000108",
    raisonSociale: "EURL NUMERIC SOLUTIONS", formeJuridique: "EURL",
    nif: "002416056789012", rc: "16/00-6789012 B 24", nis: "002416010678901",
    secteur: "Informatique & Télécoms", representant: "AIT ALI Yasmine", fonctionRepresentant: "Gérante",
    nom: "", prenom: "", adresse: "Cité des 1000 logements, Bât C", commune: "Kouba", wilaya: "Alger",
    codePostal: "16050", telephoneFixe: "021-28-90-45", gsm: "0665-908-108", email: "hello@numeric-sol.dz",
    typeService: "FTTH Pro", debit: "300 Mb/s", montantHT: 16806.72, tva: 19, montantTTC: 20000, solde: 8000,
    dateCreation: "03/02/2024", statut: "Actif",
  },
  {
    numCompte: "EN-2022-000109", codeClient: "CLT000109",
    raisonSociale: "SARL CIMENT ET DERIVES BLIDA", formeJuridique: "SARL",
    nif: "001809034567890", rc: "09/00-7890123 B 18", nis: "001809010789012",
    secteur: "Matériaux de construction", representant: "KACI Rabah", fonctionRepresentant: "Gérant",
    nom: "", prenom: "", adresse: "Route de Chiffa, km 4", commune: "Blida", wilaya: "Blida",
    codePostal: "09000", telephoneFixe: "025-41-66-30", gsm: "0771-109-109", email: "contact@cdblida.dz",
    typeService: "ADSL Pro", debit: "20 Mb/s", montantHT: 12605.04, tva: 19, montantTTC: 15000, solde: 15000,
    dateCreation: "27/08/2022", statut: "Résilié",
  },
  {
    numCompte: "EN-2023-000110", codeClient: "CLT000110",
    raisonSociale: "SPA CONSTANTINE TEXTILE", formeJuridique: "SPA",
    nif: "099125008765432", rc: "25/00-0890123 B 91", nis: "099125010890123",
    secteur: "Textile & Confection", representant: "BOUKHALFA Samir", fonctionRepresentant: "Président directeur général",
    nom: "", prenom: "", adresse: "Zone industrielle Palma", commune: "Constantine", wilaya: "Constantine",
    codePostal: "25000", telephoneFixe: "031-92-33-18", gsm: "0550-110-110", email: "direction@ctextile.dz",
    typeService: "Pack Business", debit: "200 Mb/s", montantHT: 126050.42, tva: 19, montantTTC: 150000, solde: 112500,
    dateCreation: "16/05/2019", statut: "Actif",
  },
  {
    numCompte: "EN-2024-000111", codeClient: "CLT000111",
    raisonSociale: "EURL CLINIQUE EL AMEL", formeJuridique: "EURL",
    nif: "002335067890123", rc: "35/00-9012345 B 23", nis: "002335010901234",
    secteur: "Pharmacie & Santé", representant: "Dr. TOUATI Amel", fonctionRepresentant: "Gérante",
    nom: "", prenom: "", adresse: "5 Rue de la Liberté", commune: "Rouïba", wilaya: "Alger",
    codePostal: "16012", telephoneFixe: "023-85-19-60", gsm: "0661-211-111", email: "clinique.elamel@gmail.com",
    typeService: "FTTH Pro", debit: "100 Mb/s", montantHT: 20168.07, tva: 19, montantTTC: 24000, solde: 24000,
    dateCreation: "11/03/2024", statut: "Actif",
  },
  {
    numCompte: "EN-2021-000112", codeClient: "CLT000112",
    raisonSociale: "SARL TIZI TRANSPORT VOYAGEURS", formeJuridique: "SARL",
    nif: "001615023456789", rc: "15/00-1230987 B 16", nis: "001615010123098",
    secteur: "Transport & Logistique", representant: "AMROUCHE Lyes", fonctionRepresentant: "Gérant",
    nom: "", prenom: "", adresse: "Gare routière, Boukhalfa", commune: "Tizi Ouzou", wilaya: "Tizi Ouzou",
    codePostal: "15000", telephoneFixe: "026-21-45-90", gsm: "0770-312-112", email: "ttv.direction@gmail.com",
    typeService: "ADSL Pro", debit: "10 Mb/s", montantHT: 6722.69, tva: 19, montantTTC: 8000, solde: 6400,
    dateCreation: "30/09/2021", statut: "Résilié",
  },
];

export const entreprisesData: EntrepriseClient[] = seeds.map((s, i) => {
  const base = deriveApres({ ...s, nom: s.raisonSociale, prenom: "" }, i, s.statut === "Résilié");
  return {
    ...base,
    intitule: s.raisonSociale,
    typeCompte: "Professionnel",
    raisonSociale: s.raisonSociale,
    formeJuridique: s.formeJuridique,
    nif: s.nif,
    rc: s.rc,
    nis: s.nis,
    secteur: s.secteur,
    representant: s.representant,
    fonctionRepresentant: s.fonctionRepresentant,
  };
});
