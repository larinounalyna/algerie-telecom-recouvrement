#!/usr/bin/env bash
# Applies every migration in sql/, in order, against the given database.
# Every file in this folder is idempotent (IF NOT EXISTS / IF EXISTS / additive
# ADD COLUMN IF NOT EXISTS), so this is always safe to re-run — on a brand new
# database, on a partially-migrated one, or on one that's already fully up to
# date. Nothing existing is ever dropped or overwritten.
#
# Usage:
#   bash sql/apply_all.sh at_recouvrement
#   bash sql/apply_all.sh at_recouvrement "postgresql://user:pass@host:5432"   # optional psql connection args
set -euo pipefail

DB_NAME="${1:?Usage: bash sql/apply_all.sh <db_name> [extra psql connection args...]}"
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Applying all migrations in $SCRIPT_DIR to database '$DB_NAME'..."
for f in "$SCRIPT_DIR"/0*.sql; do
    echo "-> $(basename "$f")"
    psql -d "$DB_NAME" "$@" -v ON_ERROR_STOP=1 -f "$f"
done
echo "Done. Run the two checks below any time to confirm 006/007/008 are all in:"
echo "  psql -d $DB_NAME -c \"\\d apres_gaia_med\"     # expect to see cas_particulier, cas_particulier_date, cas_particulier_commentaire"
echo "  psql -d $DB_NAME -c \"\\d apres_gaia_rappel\"  # expect this table to exist"