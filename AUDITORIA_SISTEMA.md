# 🔍 AUDITORÍA TOTAL — GastroDash 2.0

**Fecha:** 24 de febrero 2026
**Alcance:** Backend + Frontend completo
**Archivos auditados:** ~60 archivos (todos los .ts, .tsx, .css, .json, .prisma)

---

## RESUMEN EJECUTIVO

El sistema está **bien estructurado** en su arquitectura base (multitenancy, JWT, módulos, permisos). Sin embargo, hay **código muerto**, **duplicación significativa**, **inconsistencias de patrones**, y **brechas de seguridad** que deben resolverse antes de escalar.

**Severidad general:** 🟡 Media — funcional pero con deuda técnica acumulada.

---

## 1. CÓDIGO MUERTO — ELIMINAR

### 1.1 Archivo backup abandonado
- **`backend/src/modules/menu/menu.router.ts.bak`** — 299 líneas de código muerto. Es una versión anterior del menu.router.ts. **ELIMINAR.**

### 1.2 Módulos backend sin uso en frontend
- **`backend/src/modules/orders/orders.router.ts`** — CRUD de pedidos genéricos (Order). Ninguna página del frontend lo consume. El sistema actual solo usa KgOrders. **97 líneas muertas.**
- **`backend/src/modules/products/products.router.ts`** — CRUD de productos genéricos. El frontend solo usa `/api/menu/kg-products` (que opera sobre la misma tabla Product pero filtrado por `soldByKg`). **74 líneas muertas.**
- Ambas rutas están registradas en `app.ts` (líneas 26-27) pero no se usan.

### 1.3 Modelos Prisma sin uso activo
- **`Table`** — modelo de mesas. No hay UI ni ruta activa que lo use. Solo referenciado opcionalmente en Order (que tampoco se usa).
- **`Category`** — modelo de categorías. Existe en schema pero no hay CRUD ni UI para gestionarlas.
- **`Order` / `OrderItem`** — solo usados por el módulo orders muerto. El sistema real usa KgOrder/KgOrderItem.

### 1.4 CSS muerto
- **`frontend/src/app/page.module.css`** — 142 líneas. Es el CSS default de Next.js (template). La página `page.tsx` solo hace `redirect("/login")`, no usa ninguna clase de este archivo. **ELIMINAR.**

### 1.5 Componente no utilizado
- **`frontend/src/components/layout/TopBarStatus.tsx`** + su CSS — Componente completo (85 líneas + 20 CSS) que **no se importa en ningún lugar**. La funcionalidad de turno/logout ya está en `dashboard/layout.tsx`. **ELIMINAR.**
- **`frontend/src/components/layout/PageHeader.module.css`** — Define clases `.pageTitle`, `.pageSubtitle`, `.headerContent`, `.titleSection` que **no se usan** en `PageHeader.tsx` (que usa portal, no estas clases). **ELIMINAR.**

### 1.6 Dependencia npm no utilizada
- **`next-auth`** en `frontend/package.json` — El sistema usa JWT custom con `useAuthStore`. NextAuth no se importa en ningún archivo. **ELIMINAR.**
- **`nodemon`** en `backend/devDependencies` — El proyecto usa `tsx watch`, no nodemon. **ELIMINAR.**
- **`ts-node`** en `backend/devDependencies` — El proyecto usa `tsx`, no ts-node. **ELIMINAR.**

---

## 2. CÓDIGO DUPLICADO — UNIFICAR

### 2.1 Formulario "Abrir Turno" duplicado 3 veces
El formulario para abrir turno existe en **3 lugares distintos**:
1. **`dashboard/layout.tsx`** (líneas 66-79, 227-243) — Modal en el header
2. **`dashboard/caja/page.tsx`** (líneas 64-78, 141-168) — Inline en la página
3. **`dashboard/caja/page.tsx`** (líneas 176-215) — Drawer separado

**Acción:** Extraer a un componente `<OpenShiftForm />` reutilizable.

### 2.2 Función `fmt()` duplicada 3 veces
Función idéntica de formateo de moneda en:
1. `frontend/src/components/caja/KgOrdersModule.tsx` (línea 49)
2. `frontend/src/app/dashboard/finanzas/page.tsx` (línea 77)
3. `frontend/src/app/dashboard/menu/pedidos-kg/page.tsx` (línea 25)

**Acción:** Mover a `frontend/src/lib/format.ts` como utilidad compartida.

### 2.3 Patrón de error handling duplicado en todo el frontend
Este patrón se repite **~15 veces** en el frontend:
```typescript
catch (err: unknown) {
  const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Error...";
  notifications.show({ title: "Error", message: msg, color: "red" });
}
```
**Acción:** Crear helper `showApiError(err, fallback)` en `lib/api.ts`.

### 2.4 Schemas Zod duplicados entre backend y frontend
- `openShiftSchema` existe en backend (`shifts.schema.ts`) Y en frontend (`caja/page.tsx` + `layout.tsx`)
- `loginSchema` existe en backend (`auth.schema.ts`) Y en frontend (`login/page.tsx`)

**Acción:** No es necesario compartir (son stacks separados), pero unificar los del frontend entre sí.

### 2.5 Interfaces duplicadas en frontend
- `KgProduct` definida en `KgOrdersModule.tsx` Y en `menu/pedidos-kg/page.tsx`
- `Order` (KG) definida solo en `KgOrdersModule.tsx` pero podría necesitarse en otros lugares

**Acción:** Crear `frontend/src/lib/types.ts` con interfaces compartidas.

### 2.6 Lógica de `handleOpenShift` duplicada
La lógica de abrir turno (POST + setActiveShift + notification) está en:
1. `dashboard/layout.tsx` (líneas 66-79) — usa `/shifts/open` (sin `/api/` prefix!)
2. `dashboard/caja/page.tsx` (líneas 64-78) — usa `/api/shifts/open`

**Bug incluido:** En layout.tsx la URL es `/shifts/open` (falta `/api/`). Funciona por casualidad si el baseURL del axios ya incluye algo, pero es inconsistente.

---

## 3. INCONSISTENCIAS — CORREGIR

### 3.1 URLs de API inconsistentes en frontend
- `dashboard/layout.tsx` línea 69: `api.post("/shifts/open", data)` — **FALTA `/api/`**
- Todos los demás archivos usan `/api/shifts/...`, `/api/menu/...`, etc.

### 3.2 Patrón router inconsistente en backend
- **`shifts`**, **`finance`**, **`config`** — Usan patrón service layer (router → service)
- **`orders`**, **`products`**, **`menu`** — Toda la lógica inline en el router (fat controllers)
- **`auth`** — Usa service layer + schema separado ✓

**Acción:** El módulo `menu` tiene 350 líneas en un solo archivo. Extraer service layer.

### 3.3 Módulo `menu.router.ts` es un "god file"
Con 350 líneas, maneja:
- CRUD de KG Products (4 endpoints)
- CRUD de KG Orders (4 endpoints)
- Schemas Zod inline
- Lógica de negocio inline

**Acción:** Separar en `menu.service.ts` + `menu.schema.ts`.

### 3.4 Exceso de `as any` en backend
El archivo `menu.router.ts` tiene **8 instancias** de `as any` con eslint-disable. Esto indica problemas de tipado con Prisma.

**Acción:** Tipar correctamente usando los tipos generados por Prisma.

### 3.5 `moduleGuard` busca por `submoduleKey: null` siempre
En `moduleGuard.ts` línea 15: `submoduleKey: null` — Solo verifica módulos padre, nunca submódulos. Si una ruta necesita verificar un submódulo específico, no puede.

### 3.6 Drawer de "Nuevo Egreso" no funcional
En `caja/page.tsx` (líneas 280-306): El drawer de "Nuevo Egreso de Caja Chica" tiene UI pero **ninguna lógica de submit**. El botón "Registrar egreso" no hace nada. No hay modelo en Prisma para egresos de caja chica.

---

## 5. OPTIMIZACIONES DE RENDIMIENTO

### 5.1 N+1 queries en consolidator
`finance.service.ts` hace 3 queries separadas (shifts + orderTotals + kgTotals) que podrían optimizarse.

### 5.2 Falta paginación
Ningún endpoint de listado tiene paginación:
- `GET /api/orders` — devuelve TODOS los pedidos del tenant
- `GET /api/menu/kg-orders` — devuelve TODOS los kg orders
- `GET /api/shifts` — devuelve TODOS los turnos
- `GET /api/finance/expenses` — devuelve TODOS los gastos

### 5.3 Prisma client tipado como `any`
En `prisma.ts` línea 16: `export const prisma: any = ...` — Esto elimina todo el type-safety de Prisma en todo el backend. Es la causa raíz de todos los `as any` en los routers.

### 5.4 `fetchPermissions` se llama en cada navegación
En `dashboard/layout.tsx`, `fetchPermissions()` se ejecuta cada vez que el layout se monta. No hay cache ni TTL.

---

## 6. ARQUITECTURA — OBSERVACIONES

### 6.1 Modelos huérfanos en Prisma
| Modelo | Estado | Acción |
|--------|--------|--------|
| `Table` | Sin UI, sin CRUD activo | Mantener si se planea usar, sino eliminar |
| `Category` | Sin CRUD, solo referenciado | Mantener si se planea usar |
| `Order` / `OrderItem` | Reemplazado por KgOrder | Evaluar si se necesita pedidos genéricos |

### 6.2 Enums no utilizados
- `TableStatus` — Solo usado por modelo Table (sin uso)
- `OrderStatus` — Solo usado por modelo Order (sin uso activo)

### 6.3 Estructura de carpetas frontend inconsistente
- Algunos módulos tienen su CSS module al lado (`caja/caja.module.css`)
- Componentes compartidos en `components/` pero la mayoría de la lógica está inline en las pages
- No hay carpeta `hooks/` para custom hooks

---

## 7. PLAN DE ACCIÓN — PRIORIZADO

### FASE 1: Limpieza (sin riesgo, sin cambios funcionales)

| # | Acción | Archivos | Impacto |
|---|--------|----------|---------|
| 1.1 | Eliminar `menu.router.ts.bak` | 1 archivo | -299 líneas |
| 1.2 | Eliminar `page.module.css` (template Next.js) | 1 archivo | -142 líneas |
| 1.3 | Eliminar `TopBarStatus.tsx` + `.module.css` | 2 archivos | -105 líneas |
| 1.4 | Eliminar `PageHeader.module.css` (no usado) | 1 archivo | -25 líneas |
| 1.5 | Eliminar `next-auth` de package.json | 1 línea | Dependencia fantasma |
| 1.6 | Eliminar `nodemon` + `ts-node` de backend package.json | 2 líneas | Deps fantasma |

**Total Fase 1: ~571 líneas eliminadas, 0 riesgo**

### FASE 2: Seguridad (crítico)

| # | Acción | Archivos | Impacto |
|---|--------|----------|---------|
| 2.1 | Fix login: agregar email al schema + buscar por email | `auth.schema.ts`, `auth.service.ts`, `login/page.tsx` | CRÍTICO — habilita multi-user |
| 2.2 | Validar JWT_SECRET al arrancar | `server.ts` | Previene arranque inseguro |
| 2.3 | Rate limit específico para login | `app.ts` | Anti brute-force |
| 2.4 | Agregar moduleGuard a products/orders (si se mantienen) | `products.router.ts`, `orders.router.ts` | Cierra brecha de permisos |

### FASE 3: Unificación de código

| # | Acción | Archivos | Impacto |
|---|--------|----------|---------|
| 3.1 | Crear `lib/format.ts` con `fmt()` | 1 nuevo + 3 edits | Elimina 3 duplicados |
| 3.2 | Crear `lib/types.ts` con interfaces compartidas | 1 nuevo + 2 edits | Elimina interfaces duplicadas |
| 3.3 | Crear helper `showApiError()` en `lib/api.ts` | 1 edit + ~15 edits | Elimina ~15 bloques duplicados |
| 3.4 | Extraer `<OpenShiftForm />` componente | 1 nuevo + 2 edits | Elimina 3 formularios duplicados |
| 3.5 | Fix URL inconsistente en layout.tsx (`/shifts/open` → `/api/shifts/open`) | 1 edit | Bug fix |

### FASE 4: Refactor backend

| # | Acción | Archivos | Impacto |
|---|--------|----------|---------|
| 4.1 | Tipar `prisma` correctamente (quitar `any`) | `prisma.ts` | Habilita type-safety en todo el backend |
| 4.2 | Separar `menu.router.ts` → router + service + schema | 3 archivos | -350 líneas monolíticas |
| 4.3 | Evaluar eliminar módulos `orders` + `products` | 2 archivos + `app.ts` | -171 líneas si se confirma que no se usan |
| 4.4 | Eliminar `as any` del backend usando tipos Prisma | ~8 instancias | Type safety |

### FASE 5: Mejoras futuras (no urgente)

| # | Acción | Impacto |
|---|--------|---------|
| 5.1 | Agregar paginación a endpoints de listado | Performance |
| 5.2 | Cache de permisos en frontend (TTL 5min) | Menos requests |
| 5.3 | Implementar o eliminar Drawer "Nuevo Egreso" | UX coherente |
| 5.4 | Evaluar eliminar modelos Table/Category/Order si no se planean usar | Schema limpio |
| 5.5 | Crear carpeta `hooks/` para custom hooks | Organización |

---

## MÉTRICAS ACTUALES

| Métrica | Valor |
|---------|-------|
| **Líneas de código muerto identificadas** | ~740 |
| **Bloques de código duplicado** | ~15 |
| **Vulnerabilidades de seguridad** | 2 críticas, 3 medias |
| **Archivos a eliminar** | 6 |
| **Dependencias fantasma** | 3 |
| **`as any` en backend** | ~10 instancias |
| **Módulos backend sin frontend** | 2 (orders, products) |

---

## DECISIONES QUE NECESITO DEL DUEÑO

1. **¿Eliminar módulos `orders` y `products`?** — No tienen UI. Si se planean usar en el futuro, se mantienen. Si no, se eliminan.
2. **¿Eliminar modelos `Table`, `Category`, `Order`, `OrderItem`?** — Requiere migración de Prisma. Irreversible sin backup.
3. **¿Implementar el Drawer de "Nuevo Egreso" o eliminarlo?** — Actualmente es UI sin funcionalidad.
4. **¿Priorizar alguna fase sobre otra?**

---

*Auditoría realizada sobre el 100% del codebase activo.*
