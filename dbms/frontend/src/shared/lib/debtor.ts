import { DebtorView, EntrepriseClient } from "../../types";

// Avant / Après Gaïa debtors are built from the API profiles:
// see avantProfileToDebtor / apresProfileToDebtor in src/services.

/** Entreprises still come from local data. */
export function entrepriseToDebtor(c: EntrepriseClient): DebtorView {
  return {
    kind: "entreprise",
    id: c.numCompte,
    idLabel: "N° Compte",
    nom: c.raisonSociale,
    prenom: "",
    adresse: c.adresse,
    commune: c.commune,
    wilaya: c.wilaya,
    telephone: c.telephoneFixe || c.gsm,
    typeService: c.typeService,
    montantTotal: c.montantTTC,
    solde: c.solde,
    historique: c.historique ?? [],
    dateRef: c.dateCreation,
    dateRefLabel: "Date de création",
    entreprise: {
      formeJuridique: c.formeJuridique,
      nif: c.nif,
      rc: c.rc,
      representant: c.representant,
      fonctionRepresentant: c.fonctionRepresentant,
    },
  };
}
