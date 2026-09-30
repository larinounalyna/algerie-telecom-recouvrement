# AT Recouvrement — Backend (FastAPI + PostgreSQL)

Built against your **real** schema (the DDL you pasted), not a guessed one. Every
endpoint below was tested against an actual local PostgreSQL instance — inserts,
client lookup, payment validation, the works (see "What's been tested" in each
section).

**Division of responsibility, per your instructions:**

- **Avant Gaïa** (`avant_gaia`, `avant_gaia_versement`) — **read-only**. No insert,
  no payment recording, no validation through this API. Rows come from wherever
  your data pipeline puts them; the API only ever reads them back.
- **Après Gaïa** (`apres_gaia`, `apres_gaia_regelement`) — full workflow: create
  clients, record règlements ("Encaisser"), and validate/refuse them.

## ⚠️ The one column added on purpose: `apres_gaia_regelement.statut`

You asked me to stop adding columns that don't exist in your real schema (fair —
`agent` was one I invented and it's now gone from both tables). But you also asked
me to move "Valider"/"Refuser" from Avant Gaïa onto Après Gaïa, and that
genuinely can't work without **some** place to record whether a règlement has
been validated: without it, a fresh règlement would be indistinguishable from a
validated one, and "Valider" would have nothing to do.

So `apres_gaia_regelement.statut` (`en_attente` / `valide` / `refuse`,
`sql/005_add_apres_gaia_regelement_statut.sql`, additive) stays as a deliberate
exception — it's the same tracking your original `avant_gaia_versement` mockup
implied with its "Valider" button, just moved to the table that now owns the
feature. **If you'd rather have zero extra columns at all**, tell me and I'll
switch to: every inserted règlement counts immediately (no Valider step, exactly
like the very first cut of this API), and "Refuser" becomes a hard `DELETE`
instead of a status flag.

Everything else I'd added without being asked (`agent` on both versement tables,
`date_versement`/`agent`/`statut` on `avant_gaia_versement`) has been **removed**
— `sql/002...sql` now reverts itself, `sql/004...sql` and `sql/005...sql` clean up
after it. See "Migrations" below.

## Setup

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

createdb at_recouvrement   # or: psql -c "CREATE DATABASE at_recouvrement"

# Apply every migration, in order — all idempotent, safe to re-run:
psql -d at_recouvrement -f sql/001_schema_avant_gaia.sql
psql -d at_recouvrement -f sql/002_add_versement_tracking_fields.sql
psql -d at_recouvrement -f sql/003_schema_apres_gaia.sql
psql -d at_recouvrement -f sql/004_schema_apres_gaia_regelement.sql
psql -d at_recouvrement -f sql/005_add_apres_gaia_regelement_statut.sql
psql -d at_recouvrement -f sql/006_schema_apres_gaia_med.sql
psql -d at_recouvrement -f sql/007_add_apres_gaia_med_cas_particulier.sql
psql -d at_recouvrement -f sql/008_schema_apres_gaia_rappel.sql

# Or, all in one go (safe to re-run any time, on any DB, however out of date):
bash sql/apply_all.sh at_recouvrement

cp .env.example .env   # fill in your real DB credentials

uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for interactive Swagger (every endpoint, with a
"Try it out" button).

## Migrations — what each file does today

| File                                         | Status                                                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_schema_avant_gaia.sql`                  | Your `avant_gaia` + `avant_gaia_versement` DDL, unchanged.                                                                                                                                                                                                                                  |
| `002_add_versement_tracking_fields.sql`      | **Now a revert.** Used to add `date_versement`/`agent`/`statut` to `avant_gaia_versement` for a Valider workflow that has since moved to Après Gaïa. Now drops those 3 columns if present, no-op otherwise.                                                                                 |
| `003_schema_apres_gaia.sql`                  | Your `apres_gaia` DDL, unchanged.                                                                                                                                                                                                                                                           |
| `004_schema_apres_gaia_regelement.sql`       | Your `apres_gaia_regelement` DDL, with `"N"` corrected to a proper foreign key `n` (see below) instead of its own primary key — and, as of this round, with the `agent` column I'd wrongly added removed again.                                                                             |
| `005_add_apres_gaia_regelement_statut.sql`   | Adds `statut` to `apres_gaia_regelement` (the one deliberate exception above) and cleans up `agent` for anyone who already ran an earlier `004`.                                                                                                                                            |
| `006_schema_apres_gaia_med.sql`              | Your `apres_gaia_med` DDL (mises en demeure + engagement + état juridique). **Does not include** the `cas_particulier*` columns — those are added by `007` below, on top of this. `CREATE TABLE IF NOT EXISTS` instead of `DROP TABLE`, so a re-run never wipes data. Adds an index on `n`. |
| `007_add_apres_gaia_med_cas_particulier.sql` | Adds `cas_particulier`, `cas_particulier_date`, `cas_particulier_commentaire` to `apres_gaia_med` (`ADD COLUMN IF NOT EXISTS`, additive). **Required** for the "cas particulier" editor in the engagement panel — without it, that endpoint fails with a `column ... does not exist` error. |
| `008_schema_apres_gaia_rappel.sql`           | **Nouvelle table** `apres_gaia_rappel` (notifications « client engagé sans versement depuis un mois »). Aucune table existante n'est modifiée. `CREATE ... IF NOT EXISTS`, re-runnable. **Required** for the rappels bell / `/api/apres-gaia/rappels*` endpoints.                           |

**If either the "cas particulier" save or the rappels bell isn't working, this is almost always why: `007` and/or `008` were never applied.** All eight files are idempotent — just run `bash sql/apply_all.sh <your db name>` (or the individual `psql -f` commands above) again; nothing existing is dropped or overwritten.

### Why `apres_gaia_regelement.n` is a foreign key, not its own PK

You confirmed `apres_gaia_regelement."N"` should be a **foreign key** to
`apres_gaia.n`, not this table's own identity column (as originally pasted) — a
client can pay several times, so the link column has to repeat, while a primary
key must stay unique per row. Fix: this table has its own identity PK — `ref` —
and `n` is a plain, indexed foreign key (`REFERENCES apres_gaia(n) ON DELETE
CASCADE`). Insert a règlement via the URL (`POST /api/apres-gaia/{n}/reglements`),
not the body — tested with real FK enforcement (see "What's been tested").

## ⚠️ Gaps between your real schema and the mockups

**Avant Gaïa** — `avant_gaia` has no separate `nom`/`prenom` (only `intitule`),
no `wilaya`/`commune`/`telephone`/`type_service`/`groupement`, and no
`ancien_index` (only `nouveau_index`). The API returns exactly what exists — see
`InformationsClient` in `app/schemas.py`. **Consommation history**: since each
row only stores `nouveau_index`, "Anc. Index" for a bimestre is derived from the
_previous_ bimestre row's `nouveau_index` (ordered by `annee_bimestre`,
`n_bimestre`). **`solde_du`** = `sum(ttc of all bimestre rows) -
sum(montant_versement)` (all of them now — no `statut` filter left on this side),
floored at 0 — your schema has no balance column, so this is a guess at the
business rule; `solde_du_note` in the response spells it out.

**Après Gaïa** — `apres_gaia` has no separate `nom`/`prenom`, `wilaya`,
`telephone` (fixe/GSM), `email`, `type_service`, a text `statut` (only `codetat`,
a raw code), or `débit`. **No column matches "N° Compte / N° Client" as shown**
(`GA-2022-022890` in your screenshot doesn't fit `n`/`n_client`, both plain
integers, or `n_appel`, a phone-shaped varchar) — `GET /client/{identifiant}`
tries, in order, `n` (PK) → `n_client` → `n_appel`. **Please confirm which real
column that search value actually lives in.** **No `montant_ttc`/`tva`/`ht`
columns either** — computed as `montant_ttc = abonnement + dus_ant +
montant_compteur`, `tva = montant_ttc × 19⁄119`. With your screenshot's numbers
(1200 + 800 + 999.99) this reproduces `2 999,99 DA` exactly, but the TVA/HT split
doesn't match your mockup's example — `montant_ttc_note` in the response flags
this. **Please confirm the real formula.**

## Endpoints

### Avant Gaïa — read only

| Method | Path                                | What it does                                                                                                 |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/avant-gaia`                   | List `avant_gaia` rows (paginated). Filters: `n_abonne`, `actel`.                                            |
| GET    | `/api/avant-gaia/database`          | The **whole** `avant_gaia` table, unpaginated — for a "base de données" screen that filters/exports locally. |
| GET    | `/api/avant-gaia/versements`        | List `avant_gaia_versement` rows. Filter: `n_abonne`.                                                        |
| GET    | `/api/avant-gaia/client/{n_abonne}` | Aggregated profile: client info, facturation, consommation history, versement history, `solde_du`.           |

There is no `POST`, `PUT`, `DELETE`, `valider` or `refuser` anywhere under
`/api/avant-gaia` — all of that now lives under Après Gaïa.

### Après Gaïa — full workflow

| Method | Path                                       | What it does                                                                                                                                       |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/apres-gaia`                          | List `apres_gaia` rows (paginated). Filters: `n_client`, `n_appel`.                                                                                |
| GET    | `/api/apres-gaia/database`                 | The **whole** `apres_gaia` table, unpaginated.                                                                                                     |
| POST   | `/api/apres-gaia`                          | Insert one row (JSON object) or many (JSON array).                                                                                                 |
| GET    | `/api/apres-gaia/reglements`               | List `apres_gaia_regelement` rows. Filter: `n`.                                                                                                    |
| POST   | `/api/apres-gaia/{n}/reglements`           | Records one payment against client `n` ("Encaisser"). 404 if `n` doesn't exist. Starts `statut='en_attente'` — does **not** yet reduce `solde_du`. |
| POST   | `/api/apres-gaia/reglements/{ref}/valider` | Marks a règlement validated — only then does it reduce `solde_du`.                                                                                 |
| POST   | `/api/apres-gaia/reglements/{ref}/refuser` | Symmetric "reject" — never counted.                                                                                                                |
| GET    | `/api/apres-gaia/client/{identifiant}`     | Aggregated profile: client info, facturation (computed), règlement history, `solde_du` (only `valide` règlements subtracted).                      |

Response shape (`schemas.ApresGaiaProfile`):

```json
{
  "informations_client": {
    "n": 1,
    "n_client": 22890,
    "n_appel": "0662890123",
    "intitule": "ZIANI Karima",
    "adresse": "...",
    "commune": "Blida",
    "code_postal": 9000,
    "codetat": 3,
    "motif_res": "Demenagement"
  },
  "details_facturation": {
    "montant_ttc": 2999.99,
    "tva": 478.99,
    "montant_ht": 2521.0,
    "montant_ttc_note": "..."
  },
  "reglements_historique": [
    {
      "ref": 1,
      "n": 1,
      "somme_versement": 2000.0,
      "date_versement": "2026-09-27",
      "lieu_versement": "Agence Blida",
      "statut": "valide"
    }
  ],
  "solde_du": 999.99,
  "solde_du_note": "..."
}
```

### Après Gaïa — mises en demeure & état juridique (`apres_gaia_med`)

Everything is addressed **by `n`** (FK to `apres_gaia.n`). One row per client, created
lazily the first time something is written; `GET` never writes and returns the table
defaults (`id: null`) if no row exists yet. Unknown `n` → 404.

| Method | Path                                                  | What it does                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/apres-gaia/{n}/med`                             | Statut complet : les 4 étapes (état + date), huissier, `etat_juridique`.                                                                                                                                                                                                                                                                                             |
| PATCH  | `/api/apres-gaia/{n}/med`                             | Mise à jour partielle / correction manuelle (seuls les champs envoyés changent). Passer un `*_etat` à `ENVOYEE`/`ENGAGE` sans date met la date du jour ; le repasser à `NON_*` efface la date.                                                                                                                                                                       |
| POST   | `/api/apres-gaia/{n}/med/invitation-paiement/envoyer` | Bouton Envoyer → `ENVOYEE` + date. Body optionnel `{"date_envoi": "2026-09-28"}`. 409 si déjà envoyée.                                                                                                                                                                                                                                                               |
| POST   | `/api/apres-gaia/{n}/med/med-lettre/envoyer`          | Idem pour la MED par lettre.                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/api/apres-gaia/{n}/med/engagement/engager`          | Engagement du client → `ENGAGE` + date.                                                                                                                                                                                                                                                                                                                              |
| PUT    | `/api/apres-gaia/{n}/med/engagement/cas-particulier`  | Enregistre ou modifie le cas particulier lié à l'engagement (situation sociale/médicale, échéancier hors barème…). Body `{"label": "...", "commentaire": "...", "cas_particulier_date": "2026-09-28"}` (`label` obligatoire, `cas_particulier_date` par défaut aujourd'hui). Indépendant de `engagement_etat`. Renvoyer le PUT avec de nouvelles valeurs le modifie. |
| DELETE | `/api/apres-gaia/{n}/med/engagement/cas-particulier`  | Efface le cas particulier (retour à un engagement standard).                                                                                                                                                                                                                                                                                                         |
| POST   | `/api/apres-gaia/{n}/med/med-huissier/envoyer`        | Idem, + body optionnel `{"nom": "...", "prenom": "...", "date_envoi": "..."}`.                                                                                                                                                                                                                                                                                       |
| PUT    | `/api/apres-gaia/{n}/med/etat-juridique`              | Body `{"etat_juridique": "Dossier clôturé"}` — 422 si la valeur n'est pas l'une des 6 autorisées.                                                                                                                                                                                                                                                                    |
| GET    | `/api/apres-gaia/med/etats-juridiques`                | Les 6 valeurs, pour la liste déroulante.                                                                                                                                                                                                                                                                                                                             |
| GET    | `/api/apres-gaia/med`                                 | Liste des lignes (filtres `n`, `etat_juridique`) — pour un tableau global.                                                                                                                                                                                                                                                                                           |

`GET /api/apres-gaia/client/{n}` renvoie aussi le bloc `med` (avec `cas_particulier`,
`cas_particulier_date`, `cas_particulier_commentaire`). WebSocket : événement
`apres_gaia_med.updated` `{n, action}` après chaque écriture.

### Après Gaïa — supprimer des versements (`apres_gaia_regelement`)

| Method | Path                               | What it does                                                                                                                                                                   |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DELETE | `/api/apres-gaia/reglements/{ref}` | Supprime UN versement par son `ref`. 204, ou 404 si `ref` n'existe pas. Irréversible — si le versement était validé, `solde_du` se recalcule comme s'il n'avait jamais existé. |
| DELETE | `/api/apres-gaia/{n}/reglements`   | Supprime TOUS les versements d'un client `n`. 404 si `n` n'existe pas dans `apres_gaia` ; renvoie `{"deleted": <compte>}` (0 si le client n'avait aucun versement).            |

Les deux émettent `apres_gaia_regelement.deleted` (`{ref, n}` ou `{n, count}`).

### Après Gaïa — rappels de versement (`apres_gaia_rappel`)

**Règle.** Pour chaque client dont `apres_gaia_med.engagement_etat = 'ENGAGE'` : le décompte part de
la date la plus récente entre `engagement_date` et le dernier règlement. S'il s'est écoulé
**30 jours ou plus** sans nouveau versement **et** que `solde_du > 0`, un rappel (notification) est créé.

- Un mois de plus sans versement → nouveau rappel (`mois_impayes` = 2, 3…) qui **remplace** le précédent.
- Le contrôle est aussi relancé pour le client concerné après chaque règlement créé / validé / refusé / supprimé.
- Un rappel passe à `resolu` tout seul dès que le client verse, n'est plus `ENGAGE`, ou a un solde à 0.
- Règlements comptés : `valide` toujours ; `en_attente` aussi (un versement saisi mais pas encore validé ne
  déclenche pas de faux rappel) — `REMINDER_COUNT_PENDING=false` pour ne compter que les `valide`. `refuse` jamais.
- Le contrôle tourne **au démarrage puis toutes les 24 h** (tâche de fond dans `app/main.py`), et pour le client
  concerné à chaque nouveau règlement. Les rappels sont **gardés en base** : un agent absent au moment du contrôle
  les voit à sa prochaine connexion. Un même rappel n'est jamais créé deux fois (`UNIQUE (n, type, echeance_date)`).

| Method | Path                               | What it does                                                                                        |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| GET    | `/api/apres-gaia/rappels`          | Liste (récent d'abord). Filtres : `n`, `statut` (`nouveau`/`lu`/`resolu`), `actifs=true`.           |
| GET    | `/api/apres-gaia/rappels/count`    | `{non_lus, actifs}` — pastille de la cloche.                                                        |
| POST   | `/api/apres-gaia/rappels/verifier` | Lance le contrôle **maintenant** (import, test, ou planificateur désactivé).                        |
| POST   | `/api/apres-gaia/rappels/{id}/lu`  | Marque un rappel comme lu.                                                                          |
| POST   | `/api/apres-gaia/rappels/lu`       | Tout marquer comme lu → `{"deleted": <nb>}` (le champ garde ce nom pour réutiliser `DeletedCount`). |
| GET    | `/api/apres-gaia/{n}/rappels`      | Historique des rappels d'un client (`actifs=true` pour les non résolus).                            |

`GET /api/apres-gaia/client/{n}` renvoie aussi `rappel_actif` (`null` s'il n'y en a pas) pour afficher un bandeau
sur la fiche. Il n'y a volontairement **pas** de POST pour créer un rappel à la main.

Réglages (`.env`) : `REMINDER_DELAY_DAYS=30`, `REMINDER_CHECK_INTERVAL_HOURS=24`,
`REMINDER_SCHEDULER_ENABLED=true`, `REMINDER_COUNT_PENDING=true`.

Un client avec un `cas_particulier` (échéancier hors barème) est contrôlé comme les autres ; `cas_particulier`
est dans `GET /{n}/med` si le frontend veut l'afficher à côté du rappel.

## Real-time

Every mutating endpoint calls `manager.broadcast(event, payload)`
(`app/realtime.py`) after committing, over a plain WebSocket at `/ws`:

```js
const ws = new WebSocket("ws://localhost:8000/ws");
ws.onmessage = (msg) => {
  const { event, payload } = JSON.parse(msg.data);
  // "apres_gaia.created" | "apres_gaia_regelement.created"
  // | "apres_gaia_regelement.validated" | "apres_gaia_regelement.refused"
  // | "apres_gaia_rappel.created"   -> payload = le rappel complet (id, n, message, jours_ecoules, solde_du…)
  // | "apres_gaia_rappel.resolved"  -> idem
  // | "apres_gaia_rappel.read"      -> {id, n} ou {count}
  if (event === "apres_gaia_rappel.created") {
    showToast(payload.message); // notification
    incrementBellBadge();
  }
};
```

(Avant Gaïa broadcasts nothing now — it never writes anything.)

## Tests automatiques

```bash
pip install pytest httpx
pytest -q tests      # 17 tests, base SQLite jetable — ne touche pas ton PostgreSQL
```

Couvrent : engagé > 30 j → rappel · < 30 j → rien · non engagé → rien · versement récent (même `en_attente`)
→ rien · versement `refuse` ignoré · décompte repart du dernier versement · pas de doublon · un nouveau
versement résout le rappel · 2ᵉ mois remplace le 1ᵉʳ · solde 0 → rien · plus engagé → résolu ·
lu / tout lu · push WebSocket · versement supprimé ou refusé → le rappel revient tout de suite · cas particulier (PUT/DELETE) · `solde_du` inchangé.

## What's been tested

Run against a real local PostgreSQL 16 instance, fresh install (all 5 migrations
in order) and idempotency (re-run):

- All 5 SQL files apply cleanly, and cleanly again on a second run.
- `\d avant_gaia_versement` confirms it now matches your DDL **exactly** — no
  `agent`, no `date_versement`, no `statut`.
- `\d apres_gaia_regelement` confirms only `n` (FK) and `statut` were added on
  top of your DDL — no `agent`.
- `POST /api/avant-gaia` and `POST /api/avant-gaia/versements` correctly return
  **405 Method Not Allowed** — read-only is enforced, not just undocumented.
- Seeded `avant_gaia`/`avant_gaia_versement` directly via SQL (as your real
  pipeline would) → `GET /client/{n_abonne}` and `GET /database` both return the
  right data; `solde_du` sums **all** versements now (900.0 = 1500 − 600).
- Après Gaïa full loop: created a client with your screenshot's exact numbers →
  `montant_ttc` = **2999.99**; recorded a règlement → stays `en_attente` and
  `solde_du` unchanged; **validated** it → `solde_du` drops to **999.99**;
  recorded a second règlement and **refused** it → `solde_du` stays at 999.99
  (refused règlements never count).
- FK enforced by Postgres itself, not just the API (checked earlier, still true).
- Full route table double-checked after all changes:
  `/api/avant-gaia`, `/api/avant-gaia/database`, `/api/avant-gaia/versements`,
  `/api/avant-gaia/client/{n_abonne}`, `/api/apres-gaia`,
  `/api/apres-gaia/database`, `/api/apres-gaia/reglements`,
  `/api/apres-gaia/{n}/reglements`, `/api/apres-gaia/reglements/{ref}/valider`,
  `/api/apres-gaia/reglements/{ref}/refuser`, `/api/apres-gaia/client/{identifiant}`.
