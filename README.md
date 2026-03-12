# GastroDash 2.0 — OS para negocios gastronómicos

> El Sistema Operativo para tu negocio gastronómico. Simple, rápido y poderoso.

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

## Módulos (Roadmap)

- [x] **Fase 0** — Cimientos (este sprint)
- [ ] **Fase 1** — Gestión de pedidos
- [ ] **Fase 2** — Menú y productos
- [ ] **Fase 3** — Mesas y reservas
- [ ] **Fase 4** — Reportes y analytics
- [ ] **Fase 5** — Multi-módulo (Lego)
# GastroDash2.0
