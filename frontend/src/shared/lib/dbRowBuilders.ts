import type { ApresGaiaDatabase, AvantGaiaDatabase } from "../../services";
import { apresMontantTTC } from "../../services";
import type { ApresGaiaMedRow, EntrepriseClient, PaymentTranche, StadeJuridique } from "../../types";
import { isoDay, toISODate, txt } from "./format";
import { StoredJuridique, lastMED } from "./juridique";
import type { ApresDetails, DbRow } from "./dbRows";

/**
 * Turns the records of each database into the normalised `DbRow` used by the
 * filters / extraction / table. Columns that don't exist in a table are "".
 */

function juridiqueBits(key: string, store: Record<string, StoredJuridique>) {
  const j = store[key];
  return {
    stade: (j?.stade ?? "aucune") as StadeJuridique,
    nbMed: j?.mises?.length ?? 0,
    derniereMedISO: lastMED(j)?.date ?? "",
  };
}

const noEntreprise = { formeJuridique: "", secteur: "", nif: "" };
const maxDate = (a: string | undefined, b: string) => (!a || b > a ? b : a);

/* ------------------------------ avant_gaia ------------------------------ */

export function buildAvantRows(db: AvantGaiaDatabase, store: Record<string, StoredJuridique>): DbRow[] {
  const lastVersement = new Map<string, string>();
  for (const v of db.versements) {
    if (v.n_abonne) lastVersement.set(v.n_abonne, maxDate(lastVersement.get(v.n_abonne), isoDay(v.created_at)));
  }

  // The latest bimestre row of each subscriber = the customer's current situation.
  const latest = new Map<string, (typeof db.rows)[number]>();
  for (const r of db.rows) {
    if (!r.n_abonne) continue;
    const cur = latest.get(r.n_abonne);
    if (
      !cur ||
      (r.annee_bimestre ?? 0) > (cur.annee_bimestre ?? 0) ||
      ((r.annee_bimestre ?? 0) === (cur.annee_bimestre ?? 0) &&
        ((r.n_bimestre ?? 0) > (cur.n_bimestre ?? 0) || ((r.n_bimestre ?? 0) === (cur.n_bimestre ?? 0) && r.ref > cur.ref)))
    )
      latest.set(r.n_abonne, r);
  }

  return db.rows.map((r) => {
    const id = txt(r.n_abonne);
    const key = `avant:${id}`;
    const adresse = [r.adresse_01, r.adresse_02].filter(Boolean).join(", ");
    const bimestre = r.n_bimestre !== null && r.annee_bimestre !== null ? `${r.n_bimestre}/${r.annee_bimestre}` : "";
    return {
      key,
      rowKey: `avant:ref:${r.ref}`,
      isLatest: id !== "" && latest.get(id) === r,
      kind: "avant",
      id,
      numClient: txt(r.code_payeur),
      nom: txt(r.intitule),
      prenom: "",
      displayName: txt(r.intitule),
      adresse,
      commune: "",
      wilaya: "",
      telephone: "",
      typeService: "",
      statut: "",
      montant: r.ttc ?? 0,
      solde: db.soldes.get(id) ?? 0,
      dateRefISO: isoDay(r.created_at),
      derniereVersementISO: lastVersement.get(id) ?? "",
      actel: txt(r.actel),
      typeCompte: txt(r.type_de_compte),
      codetat: "",
      motifRes: "",
      bimestre,
      ...noEntreprise,
      ...juridiqueBits(key, store),
      searchText: [id, r.intitule, adresse, r.actel, r.code_payeur, r.n_ccp, bimestre].join(" ").toLowerCase(),
      raw: r,
    };
  });
}

/* ------------------------------ apres_gaia ------------------------------ */

/** A mise en demeure is really sent once the lettre or the huissier step is done (the invitation comes before). */
const medSteps = (m: ApresGaiaMedRow | null | undefined) =>
  [
    m?.med_lettre_etat === "ENVOYEE" ? m.med_lettre_date ?? "" : null,
    m?.med_huissier_etat === "ENVOYEE" ? m.med_huissier_date ?? "" : null,
  ].filter((d): d is string => d !== null);

export function buildApresRows(db: ApresGaiaDatabase, store: Record<string, StoredJuridique>): DbRow[] {
  const lastReglement = new Map<number, string>();
  const summary = new Map<number, ApresDetails["versements"]>();
  const blank = (): ApresDetails["versements"] => ({
    valides: 0, enAttente: 0, refuses: 0, totalValide: 0, totalEnAttente: 0, dernierDate: "", dernierMontant: 0,
  });

  for (const g of db.reglements) {
    const v = summary.get(g.n) ?? blank();
    const montant = g.somme_versement ?? 0;
    if (g.statut === "refuse") {
      v.refuses++; // a refused règlement is not a payment
    } else {
      const date = g.date_versement ?? isoDay(g.created_at);
      lastReglement.set(g.n, maxDate(lastReglement.get(g.n), date));
      if (g.statut === "valide") {
        v.valides++;
        v.totalValide = Math.round((v.totalValide + montant) * 100) / 100;
      } else {
        v.enAttente++;
        v.totalEnAttente = Math.round((v.totalEnAttente + montant) * 100) / 100;
      }
      if (date >= v.dernierDate) {
        v.dernierDate = date;
        v.dernierMontant = montant;
      }
    }
    summary.set(g.n, v);
  }

  // one apres_gaia_med row per client (if the API ever returns several, the last one wins)
  const meds = new Map<number, ApresGaiaMedRow>();
  for (const m of db.meds) meds.set(m.n, m);

  return db.rows.map((r) => {
    const id = String(r.n);
    const key = `apres:${id}`;
    const med = meds.get(r.n) ?? null;
    const local = juridiqueBits(key, store);
    // The extraction must not offer again a client who already got a MED, wherever it was recorded:
    // in the real apres_gaia_med table, or in the lot validated from this screen (local store).
    const sent = medSteps(med);
    const nbMed = Math.max(local.nbMed, sent.length);
    const derniereMedISO = [local.derniereMedISO, ...sent].filter(Boolean).sort().pop() ?? "";
    return {
      key,
      rowKey: key,
      isLatest: true,
      kind: "apres",
      id,
      numClient: txt(r.n_client),
      nom: txt(r.intitule),
      prenom: "",
      displayName: txt(r.intitule),
      adresse: txt(r.adresse),
      commune: txt(r.commune),
      wilaya: "",
      telephone: txt(r.n_appel), // N° d'appel = the line's phone number
      typeService: "",
      statut: "",
      montant: apresMontantTTC(r),
      solde: db.soldes.get(r.n) ?? 0,
      dateRefISO: r.date_vigueur_abt ?? isoDay(r.created_at),
      derniereVersementISO: lastReglement.get(r.n) ?? "",
      actel: txt(r.actel),
      typeCompte: txt(r.type_de_compte),
      codetat: txt(r.codetat),
      motifRes: txt(r.motif_res),
      bimestre: "",
      ...noEntreprise,
      ...local,
      nbMed,
      derniereMedISO,
      apres: { versements: summary.get(r.n) ?? blank(), med },
      searchText: [id, r.n_client, r.n_appel, r.intitule, r.adresse, r.commune, r.actel, r.motif_res, r.code_postal]
        .join(" ")
        .toLowerCase(),
      raw: r,
    };
  });
}

/* ------------------------------ Entreprises ------------------------------ */

const lastPayment = (h?: PaymentTranche[]) => (h && h.length ? h.reduce((max, t) => (t.date > max ? t.date : max), "") : "");

export function buildEntrepriseRows(data: EntrepriseClient[], store: Record<string, StoredJuridique>): DbRow[] {
  return data.map((e) => {
    const key = `entreprise:${e.numCompte}`;
    const telephone = e.telephoneFixe || e.gsm;
    const statut = e.statut ?? "";
    return {
      key,
      rowKey: key,
      isLatest: true,
      kind: "entreprise",
      id: e.numCompte,
      numClient: e.numClient,
      nom: e.nom,
      prenom: e.prenom,
      displayName: e.raisonSociale,
      adresse: e.adresse,
      commune: e.commune,
      wilaya: e.wilaya,
      telephone,
      typeService: e.typeService,
      statut,
      montant: e.montantTTC,
      solde: e.solde,
      dateRefISO: toISODate(e.dateCreation),
      derniereVersementISO: lastPayment(e.historique),
      actel: "",
      typeCompte: "",
      codetat: "",
      motifRes: "",
      bimestre: "",
      formeJuridique: e.formeJuridique,
      secteur: e.secteur,
      nif: e.nif,
      ...juridiqueBits(key, store),
      searchText: [e.numCompte, e.numClient, e.raisonSociale, e.adresse, e.commune, e.wilaya, telephone, e.email, e.typeService, statut, e.nif, e.formeJuridique, e.secteur]
        .join(" ")
        .toLowerCase(),
      raw: e,
    };
  });
}
