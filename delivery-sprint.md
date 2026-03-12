# SPRINT: Módulo de Caja Colaborativa y Logística Delivery (Plaza Nadal Flow)

## 📌 1. CONTEXTO DEL NEGOCIO (El "Por qué")
GastroDash 2.0 está digitalizando la jerarquía operativa de una rotisería de alto volumen (Plaza Nadal). 
- El **Cajero Principal** abre el turno y cobra los retiros en el local.
- El **Telefonista** carga pedidos a la lista general pero no maneja caja.
- El **Encargado de Delivery** no carga pedidos, pero gestiona la asignación a cadetes (motos) y les cobra el dinero en efectivo que traen de la calle (Sub-Caja Delivery).
Para que no haya sabotajes, el Cajero Principal debe **invitar** a los colaboradores a su turno activo.

## 🚨 2. REGLAS DE ORO (Directrices Estrictas)
1. **No romper la estética:** El layout base utiliza una estructura de "hoja flotante" (`.gd-content` con `border-top-left-radius` sobre un fondo `.gd-main` gris claro). Todo lo nuevo debe usar componentes de **Mantine UI v7** envueltos en la clase `.gd-card` (definida en `globals.css`) para mantener sombras y bordes. NO tocar paddings ni anchos máximos globales.
2. **Stack:** Next.js 15 (App Router), Mantine UI, Zustand, Prisma, Express. NO agregar librerías externas de UI.
3. **Multitenant:** Toda nueva tabla debe llevar `tenantId`. Toda query debe filtrar por `tenantId` y `shiftId`.

---

## 🛠️ 3. PASO 1: Prisma Schema & Backend
Actualizar `schema.prisma` y generar migración.

1. **Nueva Tabla `ShiftCollaborator`:**
   - Campos: `id`, `tenantId`, `shiftId`, `userId`, `addedAt`.
   - Relaciones y Unique: `[shiftId, userId]`.
2. **Nueva Tabla `Cadete`:**
   - Campos: `id`, `tenantId`, `name`, `phone?`, `isActive` (Boolean, default true).
3. **Modificaciones en `KgOrder`:**
   - Agregar relaciones: `cadeteId?` (referencia a `Cadete`).
   - Agregar geolocalización: `lat` (Float?), `lng` (Float?).
   - Agregar finanzas: `paymentMethod` (String, default "EFECTIVO"), `cadetePaidAmount` (Decimal, default 0).

**Backend (`/api/shifts`):**
- Actualizar middleware/endpoints: Un usuario puede operar en un turno si es el `openedById` o si existe en `ShiftCollaborator` para ese turno.
- Endpoint `POST /api/shifts/:id/collaborators` para que el Cajero agregue usuarios.

---

## 🔐 4. PASO 2: UI de Colaboradores (Popover de Caja)
En `src/app/dashboard/layout.tsx`:
- En el Popover que muestra "Caja Activa", agregar un botón (ej: Icono de `UserPlus`) **SOLO SI** `activeShift.openedById === user.id`.
- Este botón abre un pequeño modal o vista interna en el popover con un `Select` de usuarios del tenant para agregarlos como colaboradores del turno.

---

## 📑 5. PASO 3: Refactor "Pedidos x KG" (Tabs)
En la vista actual (`caja/page.tsx` o `KgOrdersModule`), envolver la interfaz existente en `<Tabs>` de Mantine.
- **Tab `Lista General`:** Mantiene EXACTAMENTE la UI actual (Lista izquierda, carga de productos a la derecha). No alterar su funcionamiento.
- **Tab `Delivery`:** (Ver Paso 4).
- **Tab `WhatsApp`:** Crear tab y dejarlo `disabled` (Próximamente).

---

## 🗺️ 6. PASO 4: Centro de Comando Delivery (Layout Espacial)
Al entrar al Tab "Delivery", la pantalla se divide en 3 zonas estratégicas:

### A. Zona Central: Mapa Logístico
- Usar API de Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`).
- Renderizar pines por cada `KgOrder` del turno con `isDelivery == true` (excluir cancelados/entregados).
- Si `deliveryAddress` no tiene `lat/lng`, usar Geocoding on-the-fly y guardarlo en DB.
- El Pin debe ser un marcador custom que muestre el `#orderNumber`.

### B. Columna Derecha: Asignación de Pedidos
- Reemplaza el formulario de carga de productos.
- Lista de pedidos delivery pendientes.
- Cada pedido tiene un `<Select>` rápido para asignarle un `Cadete`. Al seleccionar, el pedido pasa a estado "En Camino".

### C. Fila Inferior (Dock): Finanzas por Cadete (Cards)
- Debajo del Mapa y la Columna, crear un Scroll Horizontal (o Grid) con `.gd-card` para cada Cadete que tenga pedidos asignados en este turno.
- **Empty State / Card Fija:** Una card con borde punteado que diga "+ Agregar Cadete". Abre un modal simple para crear un `Cadete` en DB. Una vez creado, aparece en los Selects de asignación (Columna B).
- **Lógica de la Card del Cadete:**
  - Muestra el nombre (Ej: "Raúl").
  - **Monto Naranja (Total a Cobrar):** `SUM(totalPrice)` de pedidos asignados a este cadete **SOLO SI** `paymentMethod === 'EFECTIVO'` y están pendientes de rendición. (No sumar pagos de Mercado Pago/Transferencia para no exigir plata de más al cadete).
  - Botón: "Cobrar / Detalle".

---

## 💵 7. PASO 5: Drawer de Rendición (El Detalle del Cadete)
Al hacer clic en "Cobrar / Detalle" en la card de un cadete, se abre un `<Drawer>` de Mantine en el lateral derecho.

**Contenido del Drawer:**
1. **Resumen:** Nombre del cadete y Deuda en Efectivo actual.
2. **Lista de Pedidos Pendientes (Efectivo):** - Diseño limpio. Ej: "Pedido #45 - $8.000".
   - Botón individual "Rendir" al lado de cada uno (Actualiza `cadetePaidAmount` y estado a `PAID`/`DELIVERED`).
3. **Lista de Pedidos Pagados/Digitales (Grisados):**
   - Debajo, mostrar pedidos que el cadete ya rindió (en gris, como historial de su viaje).
   - Mostrar también pedidos asignados a él que fueron pagados por métodos digitales (Mercado Pago), solo a modo informativo ("No requiere cobro").
4. **Permisos:** Esta sección solo gestiona rendiciones individuales al encargado. El encargado NO ve el botón de "Cerrar Caja Global" del turno.

---
**Instrucción Final para la IA:** Inicia implementando el schema de Prisma. Una vez validado, avanza con la API, luego el Store (Zustand) y finalmente la construcción de los componentes UI siguiendo la jerarquía espacial (Mapa Centro, Asignación Derecha, Cards Abajo).