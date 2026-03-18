#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo ""
  echo "In Railway: FastFood service -> Variables -> Add variable:"
  echo "  Name:  DATABASE_URL"
  echo "  Value: \${{ Postgres.DATABASE_URL }}"
  echo ""
  echo "Or copy the connection string from Postgres service -> Connect."
  exit 1
fi

# Deploy migrations; if P3005 (schema not empty), baseline existing DB
set +e
migrate_out=$(npx prisma migrate deploy 2>&1)
migrate_exit=$?
set -e
echo "$migrate_out"
if [ "$migrate_exit" -ne 0 ]; then
  if echo "$migrate_out" | grep -q "P3005"; then
    echo "Database has existing schema. Baselining migrations..."
    for dir in prisma/migrations/*/; do
      [ -d "$dir" ] || continue
      name=$(basename "$dir")
      npx prisma migrate resolve --applied "$name" 2>/dev/null || true
    done
    npx prisma migrate deploy
  else
    exit 1
  fi
fi

# Seed initial data (tenant, admin user, products) - idempotent via upsert
npx prisma db seed

exec node dist/server.js
