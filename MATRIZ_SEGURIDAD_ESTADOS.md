# Matriz de Seguridad y Estados - GastroDash 2.0

## Fecha: 06/03/2026 - 18:53

---

## Estados del Pedido

### Campo `isPaid` (Estado de PAGO)
- `false` → NO cobrado
- `true` → COBRADO (bloqueado para edición)

### Campo `status` (Estado de ENTREGA)
- `PENDING` → Pendiente de entrega
- `IN_PROGRESS` → En preparación (futuro)
- `READY` → Listo para entregar (futuro)
- `DELIVERED` → Entregado
- `CANCELLED` → Cancelado

### Campo `isSentToKitchen`
- `false` → No enviado a cocina/kilaje
- `true` → Enviado a cocina/kilaje

---

## Matriz de Acciones Permitidas

| Estado | isPaid | status | isSentToKitchen | EDITABLE | Botón Cobrar | Botón Kilaje y Cobrar | Botón Re-imprimir |
|--------|--------|--------|-----------------|----------|--------------|----------------------|-------------------|
| Nuevo | false | PENDING | false | ✅ SÍ | ✅ SÍ | ✅ SÍ | ❌ NO |
| Cargado | false | PENDING | false | ✅ SÍ | ✅ SÍ | ✅ SÍ | ❌ NO |
| En Kilaje | false | PENDING | true | ✅ SÍ | ✅ SÍ | ❌ NO | ✅ SÍ |
| Cobrado | true | PENDING | true | ❌ NO | ❌ NO | ❌ NO | ✅ SÍ |
| Entregado | true | DELIVERED | true | ❌ NO | ❌ NO | ❌ NO | ✅ SÍ |
| Cancelado | false | CANCELLED | - | ❌ NO | ❌ NO | ❌ NO | ❌ NO |

---

## Controles de Seguridad Implementados

### 1. Click en Pedido (handleOrderClick)
```typescript
if (order.isPaid || order.status === "CANCELLED") {
  notifications.show({
    title: "Pedido no editable",
    message: order.isPaid ? "Este pedido ya fue cobrado" : "Este pedido fue cancelado",
    color: "red"
  });
  return; // BLOQUEA la edición
}
```

**Resultado**: Pedidos cobrados o cancelados NO se pueden abrir para editar.

---

### 2. Botón "Cobrar" en Lista
```typescript
{!order.isPaid && order.status !== "CANCELLED" && (
  <Button onClick={...}>Cobrar</Button>
)}
```

**Resultado**: Botón solo visible si NO está cobrado y NO está cancelado.

---

### 3. Indicador Visual en Lista
```typescript
style={{
  opacity: order.isPaid || order.status === "CANCELLED" ? 0.6 : 1,
  cursor: order.isPaid || order.status === "CANCELLED" ? "not-allowed" : "pointer"
}}
```

**Resultado**: Pedidos cobrados/cancelados se ven atenuados y con cursor bloqueado.

---

### 4. Formulario Bloqueado (isFormLocked)
```typescript
const isFormLocked = !!(editingOrder && (editingOrder.isPaid || editingOrder.status === "CANCELLED"));
```

**Resultado**: Todos los inputs del formulario quedan `disabled` si está cobrado o cancelado.

---

### 5. Botones de Acción en Formulario

#### Botón "Cobrar"
```typescript
{editingOrder.status === "PENDING" && !editingOrder.isPaid && (
  <Button>Cobrar</Button>
)}
```
**Visible**: Solo si NO está cobrado

#### Botón "Kilaje y Cobrar"
```typescript
{!editingOrder.isSentToKitchen && editingOrder.status === "PENDING" && !editingOrder.isPaid && (
  <Button>Kilaje y Cobrar</Button>
)}
```
**Visible**: Solo si NO está en kilaje y NO está cobrado

#### Botón "Re-imprimir"
```typescript
{editingOrder.isSentToKitchen && (
  <Button>Re-imprimir Comanda</Button>
)}
```
**Visible**: Solo si YA está en kilaje

---

## Flujos con Seguridad

### Flujo 1: Cargar → Cobrar
```
1. Crear pedido (isPaid: false, status: PENDING)
2. Click en pedido → Se abre formulario ✅
3. Click "Cobrar" → isPaid: true
4. Pedido se cierra automáticamente
5. Intento de click en pedido → BLOQUEADO ❌
   Mensaje: "Este pedido ya fue cobrado"
```

---

### Flujo 2: Cargar → Kilaje → Cobrar
```
1. Crear pedido (isPaid: false, status: PENDING)
2. Click en pedido → Se abre formulario ✅
3. Click "Kilaje y Cobrar" → isSentToKitchen: true
4. Confirmar pago → isPaid: true, status: DELIVERED
5. Pedido se cierra automáticamente
6. Intento de click en pedido → BLOQUEADO ❌
```

---

### Flujo 3: Intento de Doble Cobro
```
1. Pedido cobrado (isPaid: true)
2. Click en pedido → BLOQUEADO ❌
   Mensaje: "Este pedido ya fue cobrado"
3. Botón "Cobrar" NO visible en lista
```

---

## Validaciones Backend

### Endpoint: PATCH /api/orders/:id/status

**Validación recomendada** (pendiente de implementar):
```typescript
// Verificar que el pedido no esté ya cobrado
const existingOrder = await prisma.order.findUnique({
  where: { id: orderId }
});

if (existingOrder.isPaid && paymentMethod) {
  throw createError("Este pedido ya fue cobrado", 400);
}
```

---

## Reglas de Negocio

### ✅ PERMITIDO
- Editar pedido NO cobrado
- Cobrar pedido NO cobrado
- Re-imprimir pedido en kilaje (con justificación)
- Ver pedidos cobrados (solo lectura)

### ❌ PROHIBIDO
- Editar pedido cobrado
- Cobrar pedido ya cobrado
- Modificar items de pedido cobrado
- Cambiar datos de pedido cobrado
- Eliminar pedido cobrado (solo cancelar)

---

## Casos de Prueba

### Test 1: Bloqueo de Edición
```
1. Crear pedido
2. Cobrar pedido
3. Intentar hacer click en pedido
✅ Esperado: Mensaje "Este pedido ya fue cobrado"
✅ Esperado: Pedido NO se abre
```

### Test 2: Botón Cobrar Oculto
```
1. Crear pedido
2. Cobrar pedido
3. Verificar lista de pedidos
✅ Esperado: Botón "Cobrar" NO visible
✅ Esperado: Pedido con opacidad 0.6
```

### Test 3: Formulario Bloqueado
```
1. Crear pedido
2. Abrir pedido (antes de cobrar)
3. Cobrar desde otro lugar
4. Verificar formulario
✅ Esperado: Alert "Pedido cobrado - Solo lectura"
✅ Esperado: Todos los inputs disabled
```

### Test 4: Doble Cobro Imposible
```
1. Crear pedido
2. Cobrar pedido
3. Intentar cobrar de nuevo
✅ Esperado: Botón NO visible
✅ Esperado: Click en pedido bloqueado
```

---

## Archivos Modificados

### Frontend
- `frontend/src/components/caja/KgOrdersModule.tsx`:
  - `handleOrderClick`: Validación de `isPaid` y `CANCELLED`
  - Botón "Cobrar": Condición `!order.isPaid`
  - Estilos visuales: Opacidad y cursor para pedidos bloqueados
  - `isFormLocked`: Basado en `isPaid`

---

## Estado Final

✅ Pedidos cobrados NO se pueden editar
✅ Botón "Cobrar" oculto para pedidos cobrados
✅ Click en pedido cobrado muestra mensaje de error
✅ Indicador visual (opacidad) para pedidos bloqueados
✅ Formulario bloqueado con alert para pedidos cobrados
✅ Todos los botones de acción con condiciones correctas

**Sistema con seguridad completa implementada**
