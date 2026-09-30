-- ============================================================
-- Adds the "cas particulier" fields to apres_gaia_med (engagement
-- spécial : client hors barème normal — échelonnement particulier,
-- situation sociale/médicale, etc.).
--
-- Additive only (ALTER ... ADD COLUMN IF NOT EXISTS): apres_gaia_med
-- already exists with real rows from 006, so this never drops or
-- recreates the table.
-- ============================================================

ALTER TABLE apres_gaia_med
    ADD COLUMN IF NOT EXISTS cas_particulier VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cas_particulier_date DATE,
    ADD COLUMN IF NOT EXISTS cas_particulier_commentaire TEXT;
