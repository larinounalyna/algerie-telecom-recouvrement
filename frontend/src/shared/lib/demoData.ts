import { EntrepriseClient } from "../../types";
import { ApresSeed, deriveApres } from "../../data/mockData";
import { REGIONS } from "./regions";

/**
 * Deterministic demo-data generator for the ENTREPRISES database (the only one
 * still on local data), so the monthly extraction ("premiers 10 000 clients
 * sans mise en demeure") can be tried on a realistic volume.
 * Every generated id starts with DEMO- so it can be removed in one click.
 */

export const DEMO_PREFIX = "DEMO-";
export const isDemoId = (id: string) => id.startsWith(DEMO_PREFIX);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMS = ["BENALI", "KADDOUR", "MANSOURI", "HADJADJ", "BOUZID", "MEZIANE", "LAKHDARI", "BENHAMOU", "OUALI", "SAIDI", "AMROUCHE", "KACI", "TOUATI", "BOUKHALFA", "CHERIF", "MERAD", "BELAID", "HAMIDI", "ZERROUKI", "DJAOUI", "FERHAT", "GUERFI", "HAMDANI", "IDIR", "KHELIFI", "LARBI", "MEBARKI", "NEDJAR", "OUARET", "RAHMANI", "SLIMANI", "TAHRI", "YAHIAOUI", "ZIANI"];
const PRENOMS = ["Mohamed", "Rachid", "Leila", "Fatima", "Karim", "Nadia", "Sofiane", "Amel", "Yasmine", "Samir", "Abdelaziz", "Djamel", "Lyes", "Rabah", "Farid", "Meriem", "Salima", "Toufik", "Hocine", "Nassima"];
const RUES = ["Rue des Martyrs", "Boulevard Krim Belkacem", "Cité des Orangers", "Rue Didouche Mourad", "Avenue de l'ALN", "Cité 1000 logements", "Rue de la Liberté", "Boulevard Colonel Amirouche", "Cité El Mokrani", "Rue Larbi Ben M'hidi"];
const SERVICES_ENT = ["FTTH Pro", "ADSL Pro", "Liaison spécialisée", "Pack Business", "Téléphone Pro"];
const DEBITS = ["10 Mb/s", "20 Mb/s", "50 Mb/s", "100 Mb/s", "200 Mb/s"];

const LOCALITES: [string, string, string][] = [
  // [commune, wilaya, code postal]
  ...REGIONS.map((c): [string, string, string] => [c, "Alger", "16000"]),
  ["Alger Centre", "Alger", "16001"],
  ["Bir Mourad Raïs", "Alger", "16030"],
  ["Oran", "Oran", "31000"],
  ["Es Sénia", "Oran", "31002"],
  ["Sétif", "Sétif", "19000"],
  ["Blida", "Blida", "09000"],
  ["Annaba", "Annaba", "23000"],
  ["Constantine", "Constantine", "25000"],
  ["Béjaïa", "Béjaïa", "06000"],
  ["Tizi Ouzou", "Tizi Ouzou", "15000"],
  ["Tlemcen", "Tlemcen", "13000"],
  ["Batna", "Batna", "05000"],
  ["Médéa", "Médéa", "26000"],
];

const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const pad = (n: number, w: number) => String(n).padStart(w, "0");
const round2 = (n: number) => Math.round(n * 100) / 100;

function frDate(r: () => number, y0: number, y1: number) {
  const y = y0 + Math.floor(r() * (y1 - y0 + 1));
  const m = 1 + Math.floor(r() * 12);
  const d = 1 + Math.floor(r() * 28);
  return `${pad(d, 2)}/${pad(m, 2)}/${y}`;
}

/** ~30 % paid-up, the rest owes between 1 500 and ~180 000 DA. */
function amounts(r: () => number, corporate = false) {
  const scale = corporate ? 6 : 1;
  const total = round2((3000 + r() * 60000) * scale);
  const paid = r() < 0.3;
  const solde = paid ? 0 : round2(Math.min(total, (1500 + r() * 30000 * (r() < 0.15 ? 5 : 1)) * scale));
  return { total, solde };
}

function contact(r: () => number) {
  // ~4 % have no address, ~7 % have no phone: makes the "données complètes" rule meaningful.
  const noAddr = r() < 0.04;
  const noTel = r() < 0.07;
  return { noAddr, noTel };
}

function apresSeed(r: () => number, i: number, prefix: string, services: string[], corporate: boolean): ApresSeed {
  const [commune, wilaya, cp] = pick(r, LOCALITES);
  const { total, solde } = amounts(r, corporate);
  const c = contact(r);
  const tva = 19;
  const digits = pad(i + 1, 6);
  const nom = pick(r, NOMS);
  return {
    numCompte: `${DEMO_PREFIX}${prefix}-${digits}`,
    codeClient: `CLT${digits}`,
    nom,
    prenom: pick(r, PRENOMS),
    adresse: c.noAddr ? "" : `${1 + Math.floor(r() * 120)} ${pick(r, RUES)}`,
    commune,
    wilaya,
    codePostal: cp,
    telephoneFixe: c.noTel ? "" : `0${2 + Math.floor(r() * 2)}1-${pad(Math.floor(r() * 100), 2)}-${pad(Math.floor(r() * 100), 2)}-${pad(Math.floor(r() * 100), 2)}`,
    gsm: `05${50 + Math.floor(r() * 40)}-${pad(Math.floor(r() * 1000), 3)}-${pad(Math.floor(r() * 1000), 3)}`,
    email: r() < 0.6 ? `${nom.toLowerCase()}${i}@mail.dz` : "",
    typeService: pick(r, services),
    debit: pick(r, DEBITS),
    montantHT: 0,
    tva,
    montantTTC: total,
    solde,
    dateCreation: frDate(r, 2018, 2024),
    statut: r() < 0.75 ? "Actif" : "Suspendu",
  };
}

const PREFIXES_ENT = ["Atlas", "Numidia", "Tassili", "Djurdjura", "Hoggar", "Casbah", "Mitidja", "Aurès", "Sahel", "Titteri", "Zibans", "Chélif", "Ouarsenis", "Soummam", "Rhumel"];
const ACTIVITES_ENT = ["Logistique", "Bâtiment", "Négoce", "Distribution", "Industries", "Services", "Informatique", "Agro", "Transport", "Pharma", "Textile", "Énergie", "Immobilier", "Conseil"];
const FORMES = ["SARL", "EURL", "SPA", "SNC", "EPE"];
const SECTEURS = ["Transport & Logistique", "BTP", "Agroalimentaire", "Pharmacie & Santé", "Informatique & Télécoms", "Hôtellerie & Tourisme", "Textile & Confection", "Matériaux de construction", "Commerce de gros", "Industrie mécanique"];
const FONCTIONS = ["Gérant", "Gérante", "Directeur général", "Cogérant", "Président directeur général"];

export function generateDemoEntreprises(count: number, seed = 33): EntrepriseClient[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const s = apresSeed(r, i, "EN", SERVICES_ENT, true);
    const forme = pick(r, FORMES);
    const raison = `${forme} ${pick(r, PREFIXES_ENT).toUpperCase()} ${pick(r, ACTIVITES_ENT).toUpperCase()}`;
    const noNif = r() < 0.05;
    const base = deriveApres({ ...s, nom: raison, prenom: "" }, i, r() < 0.55);
    return {
      ...base,
      intitule: raison,
      typeCompte: "Professionnel",
      raisonSociale: raison,
      formeJuridique: forme,
      nif: noNif ? "" : `00${pad(Math.floor(r() * 1e13), 13)}`,
      rc: `${pad(1 + Math.floor(r() * 48), 2)}/00-${pad(Math.floor(r() * 1e7), 7)} B ${pad(Math.floor(r() * 25), 2)}`,
      nis: `00${pad(Math.floor(r() * 1e13), 13)}`,
      secteur: pick(r, SECTEURS),
      representant: `${pick(r, NOMS)} ${pick(r, PRENOMS)}`,
      fonctionRepresentant: pick(r, FONCTIONS),
    } satisfies EntrepriseClient;
  });
}
