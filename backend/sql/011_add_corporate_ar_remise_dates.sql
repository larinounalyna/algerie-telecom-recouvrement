-- Corporate AR : dates de remise du dossier à la SAJ et de remise au client.
-- Additive et idempotente : aucune donnée existante n'est modifiée.

ALTER TABLE corporate_ar_client ADD COLUMN IF NOT EXISTS date_remis_saj DATE;
ALTER TABLE corporate_ar_client ADD COLUMN IF NOT EXISTS date_remis_client DATE;
