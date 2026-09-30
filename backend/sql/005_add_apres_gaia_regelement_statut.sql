-- ============================================================
-- OPTIONAL, ADDITIVE migration — required for the "Valider"/"Refuser"
-- workflow, which you asked to move from Avant Gaïa onto Après Gaïa.
--
-- Your apres_gaia_regelement DDL has no way to record whether a
-- règlement has been "validé" yet — and without that, "Valider"/
-- "Refuser" have nothing to write to, and a règlement could never
-- differ from "already counted" the moment it's inserted. So this one
-- column is a deliberate, necessary exception to "don't add columns
-- that don't exist" — everything else (agent, an extra date field,
-- etc.) has been removed instead. If you'd rather not have this either,
-- tell me and I'll switch to: every inserted règlement counts
-- immediately (no Valider step), and "Refuser" becomes a hard DELETE.
--
-- Also cleans up `agent`, in case you already applied an earlier
-- version of sql/004 that included it — DROP is a no-op if it's not
-- there.
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE apres_gaia_regelement
    DROP COLUMN IF EXISTS agent;

ALTER TABLE apres_gaia_regelement
    ADD COLUMN IF NOT EXISTS statut VARCHAR(20) NOT NULL DEFAULT 'en_attente';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_apres_gaia_regelement_statut'
    ) THEN
        ALTER TABLE apres_gaia_regelement
            ADD CONSTRAINT chk_apres_gaia_regelement_statut
            CHECK (statut IN ('en_attente', 'valide', 'refuse'));
    END IF;
END $$;
