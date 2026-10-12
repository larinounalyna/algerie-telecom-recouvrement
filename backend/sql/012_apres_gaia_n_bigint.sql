-- Après Gaïa : les clés actuelles ont 14 chiffres, elles ne tiennent pas dans un INTEGER
-- (max 2 147 483 647). apres_gaia.n et toutes les colonnes qui la référencent passent en BIGINT.
-- Les valeurs existantes (anciennes clés de 4 à 8 chiffres) sont conservées telles quelles.
-- Idempotent : si une colonne est déjà BIGINT, l'ALTER ne change rien.

ALTER TABLE apres_gaia              ALTER COLUMN n TYPE BIGINT;
ALTER TABLE apres_gaia_regelement   ALTER COLUMN n TYPE BIGINT;
ALTER TABLE apres_gaia_med          ALTER COLUMN n TYPE BIGINT;
ALTER TABLE apres_gaia_rappel       ALTER COLUMN n TYPE BIGINT;
