# Auditoría técnica completa – GastroDash 2.0

**Fecha:** 14 de marzo de 2025  
**Alcance:** Backend (Express + Prisma), Frontend (Next.js), dependencias, seguridad, optimización

---

## Resumen ejecutivo

| Área | Crítico | Alto | Medio | Bajo |
|------|---------|------|-------|------|
| Código zombie | 1 | 0 | 2 | 2 |
| Optimización | 0 | 2 | 4 | 2 |
| Seguridad | 3 | 4 | 2 | 2 |
| Dependencias | 1 | 3 | 2 | 1 |
| Deuda técnica | 1 | 3 | 3 | 1 |
| Buenas prácticas | 0 | 1 | 3 | 1 |

---

## 1. Código zombie / dead code

### Crítico
- **Endpoints de cocina duplicados** (`backend/src/modules/menu/menu.router.ts` L58-101)  
  `GET /api/menu/cocina/orders`, `/cocina/stats`, `/cocina/product-kilos` no se usan. El frontend usa `/api/orders/kitchen/*`. Código muerto.

### Medio
- **`(prisma as any)` en WhatsApp** (`whatsapp.service.ts`)  
  Uso de `(prisma as any).waMessage` y `waSessionState`; el cliente Prisma debería tipar estos modelos.
- **Parámetro `destination` ignorado** (`products.router.ts` L18-24)  
  `GET /api/products` no filtra por `destination`. CartaSelector envía `destination=KITCHEN` o `destination=BAR` sin efecto.

### Bajo
- **`requireRole` importado sin uso** en varios routers.
- **Modelo `Table`** en schema sin referencias en routers ni servicios.

---

## 2. Optimización

### Alto
- **Queries duplicadas en cocina** (`orders.service.ts` L470-565)  
  `getKitchenStats`, `getKitchenProductKilos` y `getKitchenOrders` hacen cada uno `prisma.shift.findFirst` + `prisma.order.findMany`. Unificar o cachear el shift activo.
- **Sin lazy loading de rutas**  
  No hay `dynamic()` ni `lazy()` para rutas. Todas las páginas se cargan en el bundle inicial.

### Medio
- **`CUSTOMER_INCLUDE` con orders completos** (`customers.service.ts`)  
  `getCustomerById` y `getCustomerByPhone` incluyen todos los `orders` con `items` y `product`. Costoso con muchos pedidos.
- **Sin memoización en listas** (`KgOrdersModule`, `DeliveryCommandCenter`)  
  Componentes de listas grandes sin `React.memo` ni virtualización.
- **Polling cada 10s en cocina** (`cocina/page.tsx`)  
  `setInterval(fetchDashboardData, 10000)` sin pausa al cambiar de pestaña.

### Bajo
- **`next.config.ts` básico** – Sin optimización de imágenes, bundle analyzer.
- **Google Maps sin lazy load** (`DeliveryCommandCenter.tsx`).

---

## 3. Seguridad

### Crítico
- **`JWT_SECRET` por defecto**  
  Valor `"change-this-to-a-long-random-secret-at-least-32-chars"` en `.env`. Si se usa en producción, compromete todos los tokens.
- **CORS permite requests sin origin** (`app.ts` L24)  
  `if (!origin) return callback(null, true)` permite cualquier request sin header `Origin`. Riesgo en producción.
- **POST/PATCH orders sin validación Zod** (`orders.router.ts`)  
  `req.body` se pasa directo al service sin `schema.parse()`. Posible inyección de datos.

### Alto
- **Rate limit muy alto en dev** (`app.ts` L54)  
  `max: 10000` en desarrollo. Si `NODE_ENV` no está bien configurado en prod, el límite sería excesivo.
- **Products sin validación Zod** (`products.router.ts`)  
  POST/PUT usan `req.body` sin validar.
- **`JWT_SECRET!` sin comprobación** (`tenantGuard.ts`)  
  Si no está definido, `jwt.verify` falla en runtime.
- **WaMessage sin `tenantId` en delete** (`cleanup.ts`)  
  `prisma.waMessage.deleteMany` no filtra por `tenantId`. En multi-tenant podría borrar mensajes de otros tenants.

### Medio
- Sin sanitización explícita de inputs antes de guardar.
- Verificar que `.env` no se suba a git (está en `.gitignore`).

### Bajo
- Helmet config por defecto.
- Credenciales en documentación (solo ejemplos).

---

## 4. Dependencias (npm audit)

### Backend
- **express-rate-limit**: bypass de rate limiting con IPv4-mapped IPv6.
- **@hono/node-server** (transitiva de Prisma): bypass de autorización en static paths (CVSS 7.5).
- **lodash** (transitiva): prototype pollution.
- **file-type** (transitiva): loop infinito, ZIP bomb.

### Frontend
- **flatted**: DoS por recursión (CVSS 7.5).
- **minimatch**: ReDoS (CVSS 7.5).

**Acción:** Ejecutar `npm audit fix` en backend y frontend. Evaluar `npm audit fix --force` solo si se puede probar bien.

---

## 5. Deuda técnica

### Crítico
- **Uso extensivo de `any`** (~80+ instancias)  
  `orders.service.ts`, `menu.service.ts`, `customers.service.ts`, `KgOrdersModule.tsx`, `ThermalPrint.tsx`, etc. Pérdida de type-safety.

### Alto
- **`console.log` en producción** (~50+ instancias)  
  `menu.service.ts`, `orders.router.ts`, `whatsapp.service.ts`, `KgOrdersModule.tsx`, `ProductAvailabilityDrawer.tsx`, `thermalPrinter.ts`, `DeliverySettlementModal.tsx`.
- **TODOs sin resolver**  
  `menu.service.ts` L526 (validar PIN cajero); `DeliverySettlementModal.tsx` L93 (impresión cierre delivery).
- **Manejo de errores inconsistente**  
  Algunos usan `next(err)`, otros `console.error` sin re-throw.

### Medio
- Código comentado en `menu.service.ts` (notificaciones WhatsApp).
- `eslint-disable` en `caja/page.tsx`, `sistema/page.tsx`.
- FIXME en comentarios.

### Bajo
- Comentarios en español/inglés mezclados.

---

## 6. Buenas prácticas

### Alto
- **Sin tests**  
  No hay `*.test.ts`, `*.spec.ts` ni configuración de Jest/Vitest.

### Medio
- Estructura por módulos correcta (auth, shifts, orders, etc.).
- Auth, shifts, config, customers, expenses, finance, whatsapp usan Zod. Orders y products no.
- Documentación parcial (ENV_VARIABLES, DEPLOYMENT_CHECKLIST, etc.). Falta README técnico.

### Bajo
- Convenciones coherentes: `*.router.ts`, `*.service.ts`, `*.schema.ts`.
- Multi-tenant bien implementado con `tenantId`.
- React Compiler activado.

---

## Plan de acción recomendado

### Inmediato (esta semana)
1. Cambiar `JWT_SECRET` por valor aleatorio fuerte en producción.
2. Añadir validación Zod a `POST/PATCH /api/orders` y `POST/PUT /api/products`.
3. Ejecutar `npm audit fix` en backend y frontend.
4. Añadir filtro por `tenantId` en `cleanup.ts` para `waMessage.deleteMany`.

### Corto plazo (2–4 semanas)
5. Revisar CORS: no permitir `!origin` en producción.
6. Eliminar endpoints no usados en `menu.router.ts` (`/cocina/orders`, `/cocina/stats`, `/cocina/product-kilos`).
7. Unificar o cachear queries de cocina en `orders.service.ts`.
8. Condicionar `console.log` a `NODE_ENV === 'development'`.

### Medio plazo (1–2 meses)
9. Implementar lazy loading de rutas en el frontend.
10. Reducir `any` en servicios y componentes críticos.
11. Introducir tests unitarios para auth, orders, shifts.
12. Resolver o documentar TODOs como issues.

---

## Conclusión

El sistema tiene una base sólida (estructura modular, multi-tenant, validación Zod en la mayoría de rutas). Las prioridades son: **seguridad** (JWT, validación de orders/products, CORS), **dependencias** (npm audit) y **deuda técnica** (any, console.log). La optimización y el dead code pueden abordarse en una segunda fase.
