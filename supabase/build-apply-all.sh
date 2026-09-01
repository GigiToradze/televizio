#!/usr/bin/env bash
# Rebuilds migrations/APPLY-ALL.sql from the numbered migrations, for
# pasting into the Supabase SQL editor when no database URL is to hand.
set -euo pipefail
cd "$(dirname "$0")/.."
{
  echo "-- televizio — the whole schema, in one paste."
  echo "-- Paste into the Supabase SQL editor and press Run."
  echo "-- Generated; edit the migrations, not this file."
  echo
  for f in supabase/migrations/20260901*.sql; do
    echo "-- ── $(basename "$f") ──────────────────────────────────────"
    cat "$f"
    echo
  done
} > supabase/migrations/APPLY-ALL.sql
echo "wrote supabase/migrations/APPLY-ALL.sql"
