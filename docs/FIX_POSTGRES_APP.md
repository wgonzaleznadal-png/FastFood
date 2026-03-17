# Arreglar: Postgres.app rejected "trust" authentication

## El problema

Node.js (tu backend) intenta conectarse a PostgreSQL y Postgres.app bloquea la conexión porque no tiene permiso para usar autenticación "trust" (sin contraseña).

## Solución 1: Permitir Node en Postgres.app (la más rápida)

1. Abrí **Postgres.app** (el ícono del elefante en la barra de menú)
2. Menú **Postgres** → **Settings**
3. En la lista de apps, buscá **Node** o **node**
4. Si está en "Deny" o "Ask", cambiá a **Allow**
5. Si no aparece Node, hacé clic en **Reset App Permission** y la próxima vez que el backend intente conectarse, va a aparecer un diálogo: hacé clic en **OK** para permitir

## Solución 2: Usar autenticación por contraseña (más segura)

Tu `.env` ya tiene contraseña: `GastoDash2024`. Si configurás PostgreSQL para usar contraseña, no vas a necesitar el diálogo de permisos.

1. Abrí **Postgres.app** → **Postgres** → **Settings**
2. Clic en **Server Settings…**
3. Clic en **Show** al lado de "HBA file"
4. Editá `pg_hba.conf` y reemplazá `trust` por `scram-sha-256` en las líneas de `host`:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
   ```
5. Guardá el archivo
6. En Server Settings, clic en **Change Password…** y configurá la contraseña `GastoDash2024` para el usuario `wgonzalez`
7. Reiniciá el servidor PostgreSQL (Stop → Start en Postgres.app)

## Solución 3: Desactivar el diálogo de permisos

1. Abrí **Postgres.app** → **Postgres** → **Settings**
2. Desmarcá **"Ask for permission when apps connect without password"**
3. Reiniciá PostgreSQL (Stop → Start)

---

Después de cualquiera de estas soluciones, reiniciá el backend (`npm run dev` en la carpeta backend) y probá el login de nuevo.
