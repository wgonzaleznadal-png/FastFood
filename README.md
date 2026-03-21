# GastroDash 2.0 — OS para negocios gastronómicos

> El Sistema Operativo para tu negocio gastronómico. Simple, rápido y poderoso.

**Repositorio:** [github.com/wgonzaleznadal-png/FastFood](https://github.com/wgonzaleznadal-png/FastFood) · Deploy: Railway (API + DB + migraciones Prisma) + Vercel (frontend). Ver [`docs/RAILWAY_PRISMA_MIGRATE.md`](docs/RAILWAY_PRISMA_MIGRATE.md).

## Arquitectura

```
GastroDash 2.0/
├── frontend/          # Next.js 15 + Mantine UI + Zustand
└── backend/           # Express + Prisma + PostgreSQL
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | Mantine UI + CSS Global (Sitekit) |
| Estado | Zustand (persistido) |
| Validación | Zod + React Hook Form |
| HTTP Client | Axios |
| Backend | Express 5 + TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Auth | JWT (bcryptjs) |
| Seguridad | Helmet + Rate Limiting + Tenant isolation |

## Setup rápido

### 1. Backend

```bash
cd backend
cp .env.example .env
# Editá DATABASE_URL y JWT_SECRET en .env

npm run db:generate   # Genera el cliente Prisma
npm run db:migrate    # Crea las tablas en PostgreSQL
npm run dev           # Servidor en http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
# Creá un archivo .env.local con:
# NEXT_PUBLIC_API_URL=http://localhost:4000

npm run dev           # App en http://localhost:3000
```

## Multitenant

Cada tabla tiene `tenantId`. El backend valida en cada request que el usuario solo acceda a datos de su propio tenant. **La seguridad no se negocia.**

## Módulos Implementados

- [x] **Auth** — Autenticación JWT con roles
- [x] **Caja** — Sistema de turnos y punto de venta
- [x] **Pedidos** — Gestión unificada (UNIT/KG/PORTION)
- [x] **Menú** — Productos y categorías
- [x] **Cocina** — Vista de comandas
- [x] **Delivery** — Asignación de cadetes y geolocalización
- [x] **Finanzas** — Reportes y consolidación
- [x] **Clientes** — CRM y fidelización
- [x] **WhatsApp** — Bot con IA para pedidos automatizados
- [x] **Egresos** — Gestión de gastos (caja chica, estructurales, insumos)

## 🚀 Deployment

Este proyecto está listo para deployment en:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway PostgreSQL

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones detalladas.

### Quick Deploy

**Backend (Railway):**
1. Conecta este repo en Railway
2. Configura Root Directory: `backend`
3. Agrega PostgreSQL
4. Configura variables de entorno (ver DEPLOYMENT.md)

**Frontend (Vercel):**
1. Importa este repo en Vercel
2. Configura Root Directory: `frontend`
3. Agrega `NEXT_PUBLIC_API_URL` con la URL de Railway

## 📊 Estado del Proyecto

- ✅ Build exitoso (Backend + Frontend)
- ✅ TypeScript sin errores
- ✅ Base de datos optimizada (15 modelos)
- ✅ 10 módulos backend implementados
- ✅ 15 páginas frontend
- ✅ Integración WhatsApp + OpenAI
- ✅ Sistema multitenant completo
