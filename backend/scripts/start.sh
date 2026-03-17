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

npx prisma migrate deploy
exec node dist/server.js
