-- ============================================================
-- OBSOLETE — superseded, safe to run (or re-run) anyway.
--
-- This used to ADD `date_versement`, `agent` and `statut` to
-- avant_gaia_versement, to support a "Valider" workflow on Avant Gaïa.
-- That workflow has been moved to apres_gaia_regelement instead
-- (see sql/005_add_apres_gaia_regelement_statut.sql) — Avant Gaïa is
-- now READ-ONLY through this API (no insert, no validation), matching
-- your real avant_gaia_versement DDL exactly with no extra columns.
--
-- This file now does the opposite of what it used to: it DROPS those
-- 3 columns if they're present (e.g. if you'd already applied the old
-- version of this file), and is a no-op otherwise. Safe to run any
-- number of times either way.
-- ============================================================

ALTER TABLE avant_gaia_versement
    DROP CONSTRAINT IF EXISTS chk_avant_gaia_versement_statut;

ALTER TABLE avant_gaia_versement
    DROP COLUMN IF EXISTS date_versement,
    DROP COLUMN IF EXISTS agent,
    DROP COLUMN IF EXISTS statut;
