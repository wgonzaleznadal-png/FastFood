# Lógica de Estados Separados - GastroDash 2.0

## Fecha: 06/03/2026 - 18:36

---

## Concepto Fundamental

**ESTADO DE PAGO ≠ ESTADO DE ENTREGA**

Un pedido tiene DOS estados independientes:

1. **Estado de PAGO** (`isPaid`, `paidAt`, `paymentMethod`)
2. **Estado de ENTREGA** (`status`: PENDING, IN_PROGRESS, READY, DELIVERED, CANCELLED)

---

## Campos en la Base de Datos

### Modelo Order

```prisma
// Payment (Estado de PAGO)
paymentMethod    String   @default("EFECTIVO")
isPaid           Boolean  @default(false)
paidAt           DateTime?
cadetePaidAmount Decimal  @default(0)

// Status (Estado de ENTREGA del pedido)
isSentToKitchen Boolean     @default(false)
status          OrderStatus @default(PENDING)
```

---

## Estados de PAGO

### `isPaid: false` (NO COBRADO)
- El pedido NO ha sido cobrado
- Puede estar en cualquier estado de entrega
- **EDITABLE** (se puede modificar)

### `isPaid: true` (COBRADO)
- El pedido fue cobrado
- Se registra `paidAt` (fecha/hora de cobro)
- Se registra `paymentMethod` (EFECTIVO, MERCADO PAGO, TARJETA)
- **NO EDITABLE** (bloqueado)

---

## Estados de ENTREGA

### Productos KG (Paella, Arroz con Pollo, etc.)

```
PENDING → DELIVERED
```

**Estados**:
- `PENDING`: Pedido cargado, no entregado
- `DELIVERED`: Pedido entregado al cliente

**Lógica**: La comida ya está hecha, solo hay que pesar y entregar.

---

### Productos UNIT (Rabas, Vino, etc.)

```
PENDING → IN_PROGRESS → READY → DELIVERED
```

**Estados**:
- `PENDING`: Pedido cargado, no enviado a cocina
- `IN_PROGRESS`: En preparación en cocina/barra
- `READY`: Listo para entregar
- `DELIVERED`: Entregado al cliente

**Lógica**: Hay que preparar de cero, por eso tiene más estados.

---

## Campo `isSentToKitchen`

### Para productos KG
- `true`: Se imprimió la comanda de kilaje (el pedido está en despacho)
- `false`: No se imprimió aún

### Para productos UNIT
- `true`: Se imprimió la comanda a cocina/barra (el pedido está en preparación)
- `false`: No se imprimió aún

---

## Combinaciones Posibles

### Pedido NO Cobrado, NO Entregado
```
isPaid: false
status: PENDING
isSentToKitchen: false
→ EDITABLE
```

### Pedido NO Cobrado, En Kilaje
```
isPaid: false
status: PENDING
isSentToKitchen: true
→ EDITABLE (se puede cobrar)
```

### Pedido COBRADO, NO Entregado
```
isPaid: true
status: PENDING
isSentToKitchen: true
→ NO EDITABLE (ya cobrado)
→ Pendiente de entrega
```

### Pedido COBRADO y Entregado
```
isPaid: true
status: DELIVERED
isSentToKitchen: true
→ NO EDITABLE
→ Completado
```

---

## Flujos de Botones Actualizados

### RETIRO - Botón "CARGAR"
```
1. Crear pedido:
   - isPaid: false
   - status: PENDING
   - isSentToKitchen: false
2. Imprimir comanda simple a cocina (si hay items UNIT)
3. Cerrar formulario

Estado final: EDITABLE
```

---

### RETIRO - Botón "CARGAR Y COBRAR"
```
1. Crear pedido:
   - isPaid: false
   - status: PENDING
   - isSentToKitchen: false
2. Imprimir comanda simple a cocina (si hay items UNIT)
3. Abrir drawer de cobro
4. Al confirmar pago:
   - isPaid: true ✓
   - paidAt: now()
   - paymentMethod: EFECTIVO/MP/TARJETA
   - status: PENDING (NO cambia)

Estado final: COBRADO pero NO ENTREGADO
```

---

### RETIRO - Botón "KILAJE Y COBRAR"
```
1. Crear pedido:
   - isPaid: false
   - status: PENDING
   - isSentToKitchen: false
2. Imprimir comanda simple a cocina (si hay items UNIT)
3. Imprimir comanda completa (kilaje)
4. Abrir drawer de cobro
5. Al confirmar pago:
   - isPaid: true ✓
   - paidAt: now()
   - paymentMethod: EFECTIVO/MP/TARJETA
   - status: PENDING (NO cambia)

Estado final: COBRADO pero NO ENTREGADO
```

---

### RETIRO - Botón "COBRAR" (desde edición)
```
Condición: isPaid = false

1. Abrir drawer de cobro
2. Al confirmar pago:
   - isPaid: true ✓
   - paidAt: now()
   - paymentMethod: EFECTIVO/MP/TARJETA
   - status: NO cambia

Estado final: COBRADO
```

---

### RETIRO - Botón "KILAJE Y COBRAR" (desde edición)
```
Condición: isPaid = false, isSentToKitchen = false

1. Actualizar:
   - isSentToKitchen: true
2. Imprimir comanda completa
3. Abrir drawer de cobro
4. Al confirmar pago:
   - isPaid: true ✓
   - paidAt: now()
   - paymentMethod: EFECTIVO/MP/TARJETA

Estado final: COBRADO, EN KILAJE
```

---

### Botón "ENTREGAR" (nuevo - pendiente de implementar)
```
Condición: isPaid = true, status = PENDING

1. Actualizar:
   - status: DELIVERED

Estado final: COBRADO Y ENTREGADO
```

---

## Reglas de Bloqueo del Formulario

### Pedido EDITABLE ✓
```
isPaid: false
```

### Pedido BLOQUEADO ✗
```
isPaid: true  (ya cobrado)
O
status: CANCELLED  (cancelado)
```

**Mensaje**: "Pedido cobrado - Solo lectura"

---

## Cierre de Caja

### Ventas Totales
```sql
SELECT SUM(totalPrice) 
FROM orders 
WHERE shiftId = ? AND isPaid = true
```

### Efectivo en Caja
```sql
SELECT SUM(totalPrice) 
FROM orders 
WHERE shiftId = ? 
  AND isPaid = true 
  AND paymentMethod = 'EFECTIVO'
```

**Cálculo**:
```
Efectivo Esperado = Caja Inicial + Ventas Efectivo - Gastos Caja Chica
```

---

## Migración Aplicada

```sql
-- Migration: 20260306213749_add_is_paid_to_orders

ALTER TABLE "orders" 
ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "paidAt" TIMESTAMP(3);
```

---

## Archivos Modificados

### Backend
- `backend/prisma/schema.prisma` - Agregado `isPaid` y `paidAt`
- `backend/src/modules/orders/orders.service.ts` - `updateStatus()` usa `isPaid`
- `backend/src/modules/shifts/shifts.service.ts` - Cierre de caja usa `isPaid`

### Frontend
- `frontend/src/components/caja/KgOrdersModule.tsx` - Lógica de bloqueo usa `isPaid`

---

## Próximos Pasos

### 1. Implementar Botón "ENTREGAR"
Para marcar pedidos como entregados sin cobrarlos.

### 2. Implementar Estados IN_PROGRESS y READY
Para productos UNIT que requieren preparación.

### 3. Panel de Cocina
Mostrar pedidos en preparación con estados visuales.

---

## Testing Requerido

### Caso 1: Cargar y NO Cobrar
```
1. Crear pedido → isPaid: false, status: PENDING
2. Verificar: Pedido EDITABLE
```

### Caso 2: Cargar y Cobrar
```
1. Crear pedido → isPaid: false
2. Cobrar → isPaid: true, status: PENDING
3. Verificar: Pedido BLOQUEADO, NO entregado
```

### Caso 3: Cobrar y Luego Entregar
```
1. Crear pedido → isPaid: false, status: PENDING
2. Cobrar → isPaid: true, status: PENDING
3. Entregar → isPaid: true, status: DELIVERED
4. Verificar: Pedido BLOQUEADO, entregado
```

### Caso 4: Cierre de Caja
```
1. Crear 3 pedidos:
   - Pedido A: isPaid: true, paymentMethod: EFECTIVO, total: $10.000
   - Pedido B: isPaid: true, paymentMethod: MERCADO PAGO, total: $20.000
   - Pedido C: isPaid: false, total: $5.000
2. Cerrar caja
3. Verificar:
   - Ventas Totales: $30.000 (A + B)
   - Efectivo Esperado: Caja Inicial + $10.000 - Gastos
```

---

## Estado Final

✅ Campo `isPaid` agregado a la base de datos
✅ Migración aplicada correctamente
✅ Lógica de cobro separada de lógica de entrega
✅ Bloqueo de formulario basado en `isPaid`
✅ Cierre de caja actualizado para usar `isPaid`
✅ Un pedido puede estar cobrado pero NO entregado
✅ Un pedido puede estar entregado pero NO cobrado (pendiente de implementar)

**Sistema con lógica de estados correcta implementada**
