# Migraciones Prisma en Railway (automático)

Las migraciones se aplican **al arrancar** el backend; no hace falta correr `prisma migrate deploy` a mano en cada deploy.

## Si usás el Dockerfile (raíz del repo)

El `Dockerfile` ejecuta `backend/scripts/start.sh`, que:

1. Verifica `DATABASE_URL`
2. Ejecuta **`npx prisma migrate deploy`**
3. Intenta `prisma db seed` (si falla, sigue igual)
4. Arranca `node dist/server.js`

## Si Railway usa Nixpacks sobre `backend/`

En `backend/railway.json`, el comando de deploy es:

`npx prisma migrate deploy && npm start`

## Importante en el panel de Railway

Si en **Settings → Deploy → Custom Start Command** pusiste solo `npm start` u otro comando **sin** `prisma migrate deploy`, **eso pisa** lo del `railway.json` / Docker.

- Dejá el start command **vacío** para usar el del repo, **o**
- Pone explícitamente: `sh ./scripts/start.sh` (Docker) o `npx prisma migrate deploy && npm start` (Nixpacks).

## Variables

- `DATABASE_URL` debe apuntar al Postgres de Railway (con SSL si corresponde).
