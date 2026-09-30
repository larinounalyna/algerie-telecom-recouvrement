# Algérie Télécom — Gestion des Factures

## Lancer en local

Le frontend parle au backend FastAPI (`backend/`, PostgreSQL). Démarrez d'abord le backend :
```
cd backend
uvicorn app.main:app --reload --port 8000     # voir backend/README.md pour la base et les migrations SQL
```
puis le frontend :
```
cp .env.example .env     # seulement si le backend n'est pas sur http://localhost:8000
npm install
npm run dev              # http://localhost:5173
npm run build            # production build in dist/
```
`VITE_API_URL` (voir `.env.example`) doit correspondre à une origine listée dans `CORS_ORIGINS` du backend.

## Parcours
- Écran d'accueil : Clients particuliers (Avant Gaïa / Après Gaïa) ou Entreprises.
- **Entreprises (Corporate AR)** : même principe, stocké dans PostgreSQL via `/api/corporate-ar/*` (clients, factures, documents PDF/images
  joints, import CSV). Le code `CAR-xxxxxx` est généré par le backend ; les autres agents voient les changements en temps réel (`corporate_ar.changed`).
- **Avant Gaïa** (lecture seule) : on saisit le **N° abonné** → `GET /api/avant-gaia/client/{n_abonne}` renvoie le client, la
  facturation, l'historique des versements (`avant_gaia_versement`) et l'historique de consommation par bimestre.
- **Après Gaïa** : on saisit le **N° de compte `n`** → `GET /api/apres-gaia/client/{n}`. « Encaisser » crée un règlement
  (`POST /api/apres-gaia/{n}/reglements`, statut *En attente*), « Valider » / « Refuser » le règlent
  (`POST /api/apres-gaia/reglements/{ref}/valider|refuser`). Seuls les règlements validés réduisent le solde dû.
- Sur ces deux écrans, **les champs gardent les colonnes d'origine ; une colonne qui n'existe pas dans la table reste vide**
  (Prénom, Wilaya, Téléphone, Type de service, GSM, Email, Débit, Statut…). Voir « Correspondance des colonnes » ci-dessous.
- « Base de Données » : page pleine fenêtre, deux onglets :
  - Consultation et filtres : le tableau affiche **les colonnes exactes des tables** (`avant_gaia`, `apres_gaia`) + le solde dû calculé
    et l'état juridique. Export CSV de la sélection filtrée ; import CSV pour Après Gaïa (insère dans `apres_gaia`).
  - Extraction mensuelle : les N premiers clients jamais mis en demeure, avec critères ; validation du lot, annulation possible.
- Fiche client : onglets « Situation financière » et « État juridique ».
- Temps réel : la base Après Gaïa et les fiches se rafraîchissent quand le backend pousse un événement WebSocket (`/ws`).

## Rappels, suppression de versements, cas particulier, attestation (Après Gaïa)
- **Cloche de rappels** (en haut à droite de toutes les pages) : un client **engagé** qui n'a rien versé depuis un mois (30 j) apparaît
  dans la cloche (pastille rouge = non lus) et un **pop-up** s'affiche dès que le backend crée le rappel (WebSocket
  `apres_gaia_rappel.created`). Cliquer ouvre la fiche du client, qui affiche aussi un bandeau « Rappel de versement ».
  Les rappels sont gardés en base : on les retrouve à la prochaine connexion. « Vérifier maintenant » relance le contrôle
  (`POST /api/apres-gaia/rappels/verifier`) ; « Tout marquer comme lu » aussi. Le rappel disparaît tout seul quand le client verse.
- **Supprimer un versement** : bouton 🗑 sur chaque ligne de l'historique des versements (Après Gaïa), avec **fenêtre de confirmation**
  (montant, date, effet sur le solde dû, « irréversible ») → `DELETE /api/apres-gaia/reglements/{ref}`.
- **Cas particulier & commentaire** : dans l'onglet État juridique, sous « Engagement du client » — un intitulé (100 car. max, obligatoire)
  + un commentaire libre, modifiables et supprimables (avec confirmation) → `PUT|DELETE /api/apres-gaia/{n}/med/engagement/cas-particulier`.
  Indépendant de Engagé / Non engagé ; imprimé sur le formulaire d'engagement quand il existe.
- **Solde dû = 0** : la fiche affiche « ✓ Ce client est à jour » avec un bouton **Imprimer l'attestation de règlement** (FR / عربي).

## Correspondance des colonnes (formulaire ← table)
| Champ du formulaire | Avant Gaïa (`avant_gaia`) | Après Gaïa (`apres_gaia`) |
|---|---|---|
| N° Abonné / N° Compte | `n_abonne` | `n` |
| Nom | `intitule` | `intitule` |
| Prénom, Wilaya, Téléphone, Type de service | *(vide)* | *(vide)* |
| Adresse | `adresse_01`, `adresse_02` | `adresse` |
| Commune | *(vide)* | `commune` |
| Groupement | `actel` | — |
| Code payeur / CCP | `code_payeur` / `n_ccp` | — |
| Bimestre / Index | `n_bimestre/annee_bimestre`, `nouveau_index` (+ ancien index et consommation calculés) | — |
| N° Client | — | `n_client` |
| Tél fixe | — | `n_appel` |
| Code postal / Motif de résiliation | — | `code_postal` / `motif res` |
| Statut, GSM, Email, Débit | — | *(vide)* |
| TTC / TVA / HT | `ttc` / `tva` / `somme_ht` | calculés par le backend (`abonnement + dus_ant + montant_compteur`) |
| Lieu de versement | — | `apres_gaia_regelement.lieu_versement` |

Le champ « Agent » n'existe dans aucune des deux tables : il a été retiré d'Avant/Après Gaïa (il reste sur Entreprises).
Le « Commentaire » d'Après Gaïa n'a pas de colonne : il est gardé en mémoire de la session seulement.

## Architecture (couches : UI → hooks → services → API)
```
src/
  api/                     Couche réseau : la SEULE qui fait des fetch / WebSocket
    config.ts              URL du backend (VITE_API_URL)
    httpClient.ts          fetch + ApiError + pagination
    avantGaiaApi.ts        endpoints /api/avant-gaia/*
    apresGaiaApi.ts        endpoints /api/apres-gaia/*
    realtime.ts            WebSocket partagé (/ws), reconnexion automatique

  services/                Logique métier, sans React
    avantGaiaService.ts    recherche par N° abonné, correspondance colonnes → formulaire, chargement de la base
    apresGaiaService.ts    recherche par n, encaisser / valider / refuser, chargement de la base
    apresGaiaImport.ts     CSV → lignes de apres_gaia
    accounting.ts          soldes de la page Base de données (mêmes règles que le backend)

  hooks/                   État React branché sur les services
    useAvantGaiaLookup, useApresGaiaLookup (+ workflow règlements), useGaiaDatabase,
    useClientAccount (fiche client des 3 bases), useAsyncResource, useRealtime

  types/                   index.ts (domaine UI) + gaia.ts (colonnes EXACTES des 4 tables et payloads API)

  app/  pages/             Bootstrap, écrans (home, choix de base, SystemPage)
  features/                avant-gaia, apres-gaia, entreprises, database, client-detail, facture, juridique
  shared/                  ui, theme, lib (format, csv, payments, dbRows, dbRowBuilders, juridique…)
  store/AppData.tsx        Uniquement ce qui n'a PAS de table backend : Entreprises (données locales),
                           état juridique (localStorage), commentaires
  data/                    Données de démonstration des Entreprises
```
Règle : les composants (`features/`, `pages/`) n'importent jamais `api/` directement — ils passent par `hooks/` puis `services/`.

## Données
- Avant / Après Gaïa : base PostgreSQL via l'API (plus aucune donnée fictive).
- Entreprises : données fictives locales (pas de table backend pour l'instant).
- L'état juridique / les mises en demeure sont conservés dans le navigateur (localStorage, clé `at-recouvrement:juridique:v1`).

## Règles à connaître
- Solde dû Avant Gaïa = Σ `ttc` de tous les bimestres − Σ `montant_versement` (règle du backend, à confirmer côté métier).
- Solde dû Après Gaïa = (`abonnement + dus_ant + montant_compteur`) − Σ règlements **validés**.
- Un règlement « en attente » ne réduit pas le solde, mais son montant est déjà déduit du plafond d'un nouvel encaissement.
- Les colonnes créées par le formulaire d'import CSV Après Gaïa doivent porter les **noms SQL** (`n_appel`, `intitule`, `motif res`…) :
  un fichier exporté depuis la Base de données peut être ré-importé tel quel (colonnes calculées ignorées).
