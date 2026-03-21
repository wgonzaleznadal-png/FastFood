#!/bin/sh
set -e

echo "[start] Checking DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi
echo "[start] DATABASE_URL is set."

echo "[start] Running prisma migrate deploy..."
set +e
migrate_out=$(npx prisma migrate deploy 2>&1)
migrate_exit=$?
set -e
echo "$migrate_out"
if [ "$migrate_exit" -ne 0 ]; then
  if echo "$migrate_out" | grep -q "P3005"; then
    echo "[start] Baselining migrations..."
    for dir in prisma/migrations/*/; do
      [ -d "$dir" ] || continue
      name=$(basename "$dir")
      npx prisma migrate resolve --applied "$name" 2>/dev/null || true
    done
    npx prisma migrate deploy
  else
    echo "[start] Migrate failed with exit $migrate_exit"
    exit 1
  fi
fi
echo "[start] Migrations applied."

# No correr seed en cada redeploy (duplica ruido y puede confundir). Primera vez: RUN_DB_SEED=true en Railway.
if [ "${RUN_DB_SEED:-}" = "true" ]; then
  echo "[start] RUN_DB_SEED=true — running prisma db seed..."
  npx prisma db seed || {
    echo "[start] WARNING: Seed failed, continuing anyway..."
  }
  echo "[start] Seed completed."
else
  echo "[start] Skipping prisma db seed (set RUN_DB_SEED=true to run once)."
fi

echo "[start] Starting server..."
exec node dist/server.js
