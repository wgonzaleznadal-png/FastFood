# Flujos de Pedidos - Documentación Completa

## Fecha: 06/03/2026 - 18:30

---

## PEDIDOS RETIRO - NUEVO

### Botón "CARGAR"
```
Acción:
1. Crear pedido con isSentToKitchen = false, status = PENDING
2. Imprimir comanda simple a cocina (si hay items de carta)
3. Cerrar formulario

Estado final:
- isSentToKitchen: false
- status: PENDING
- Pedido en tabla general (EDITABLE)
```

---

### Botón "CARGAR Y COBRAR"
```
Acción:
1. Crear pedido con isSentToKitchen = false, status = PENDING
2. Imprimir comanda simple a cocina (si hay items de carta)
3. Abrir drawer de cobro
4. Al confirmar pago:
   - Actualizar isSentToKitchen = true
   - Actualizar status = DELIVERED
   - Actualizar paymentMethod

Estado final:
- isSentToKitchen: true ✓
- status: DELIVERED ✓
- Pedido BLOQUEADO (cobrado y entregado)
```

**CORRECCIÓN IMPLEMENTADA**: Ahora al cobrar se marca `isSentToKitchen = true` automáticamente.

---

### Botón "KILAJE Y COBRAR"
```
Acción:
1. Crear pedido con isSentToKitchen = false, status = PENDING
2. Imprimir comanda simple a cocina (si hay items de carta)
3. Imprimir comanda completa (kilaje)
4. Abrir drawer de cobro
5. Al confirmar pago:
   - Actualizar isSentToKitchen = true
   - Actualizar status = DELIVERED
   - Actualizar paymentMethod

Estado final:
- isSentToKitchen: true
- status: DELIVERED
- Pedido BLOQUEADO (cobrado y entregado)
```

---

## PEDIDOS RETIRO - CARGADO (en tabla general)

### Botón "COBRAR"
```
Condición: Pedido PENDING, isSentToKitchen = false

Acción:
1. Abrir drawer de cobro
2. Al confirmar pago:
   - Actualizar isSentToKitchen = true
   - Actualizar status = DELIVERED
   - Actualizar paymentMethod

Estado final:
- isSentToKitchen: true
- status: DELIVERED
- Pedido BLOQUEADO
```

---

### Botón "KILAJE Y COBRAR"
```
Condición: Pedido PENDING, isSentToKitchen = false

Acción:
1. Actualizar pedido con isSentToKitchen = true
2. Imprimir comanda completa
3. Abrir drawer de cobro
4. Al confirmar pago:
   - Actualizar status = DELIVERED
   - Actualizar paymentMethod

Estado final:
- isSentToKitchen: true
- status: DELIVERED
- Pedido BLOQUEADO
```

---

### Botón "RE-IMPRIMIR COMANDA"
```
Condición: Pedido con isSentToKitchen = true

Acción:
1. Solicitar justificación
2. Imprimir comanda completa con marca RE-IMPRESIÓN
3. Registrar motivo en notas

Estado: Sin cambios (solo re-imprime)
```

---

## PEDIDOS DELIVERY

### Botón "CARGAR"
```
Acción:
1. Crear pedido con isSentToKitchen = false, status = PENDING
2. Imprimir comanda simple a cocina (si hay items de carta)
3. Imprimir comanda completa (delivery)
4. Cerrar formulario

Estado final:
- isSentToKitchen: false
- status: PENDING
- Pedido en tabla general (EDITABLE)
```

---

### Botón "CARGAR Y COBRAR"
```
Acción:
1. Crear pedido con isSentToKitchen = false, status = PENDING
2. Imprimir comanda simple a cocina (si hay items de carta)
3. Imprimir comanda completa (delivery)
4. Abrir drawer de cobro
5. Al confirmar pago:
   - Actualizar isSentToKitchen = true
   - Actualizar status = DELIVERED
   - Actualizar paymentMethod

Estado final:
- isSentToKitchen: true
- status: DELIVERED
- Pedido BLOQUEADO
```

---

## REGLAS DE BLOQUEO

### Pedido EDITABLE ✓
```
- status = PENDING
- isSentToKitchen = false
```

### Pedido BLOQUEADO ✗
```
- isSentToKitchen = true (enviado a kilaje)
- status = DELIVERED (cobrado)
- status = CANCELLED (cancelado)
```

**Mensaje**: "Pedido cobrado y entregado - Solo lectura"

---

## FLUJO DE ESTADOS

### Flujo Normal (Cargar → Kilaje → Cobrar)
```
1. CREAR → status: PENDING, isSentToKitchen: false
2. KILAJE → status: PENDING, isSentToKitchen: true
3. COBRAR → status: DELIVERED, isSentToKitchen: true
```

### Flujo Rápido (Cargar y Cobrar)
```
1. CREAR → status: PENDING, isSentToKitchen: false
2. COBRAR → status: DELIVERED, isSentToKitchen: true ✓
```

### Flujo Express (Kilaje y Cobrar)
```
1. CREAR → status: PENDING, isSentToKitchen: false
2. KILAJE + COBRAR → status: DELIVERED, isSentToKitchen: true
```

---

## CORRECCIÓN IMPLEMENTADA

### Problema
Al usar "Cargar y cobrar", el pedido se cobraba pero no se marcaba como enviado a kilaje:
- status: DELIVERED ✓
- isSentToKitchen: false ✗

Esto causaba que el pedido quedara bloqueado sin poder enviarlo a kilaje después.

### Solución
Actualizado `handlePayment()` para marcar `isSentToKitchen = true` al cobrar:

**Frontend** (`KgOrdersModule.tsx`):
```typescript
const payload = {
  status: "DELIVERED", 
  paymentMethod: ...,
  isSentToKitchen: true,  // ✓ AGREGADO
  ...pendingOrderUpdate,
};
```

**Backend** (`orders.service.ts`):
```typescript
if (orderData.isSentToKitchen !== undefined) {
  updateData.isSentToKitchen = orderData.isSentToKitchen;
}
```

---

## TESTING

### Caso 1: Cargar y Cobrar
```
1. Crear pedido con 1 Vino + 1kg Paella
2. Click "Cargar y Cobrar"
   → Imprime comanda simple a COCINA (solo Vino)
   → Abre drawer de cobro
3. Confirmar pago
   → status: DELIVERED ✓
   → isSentToKitchen: true ✓
   → Pedido BLOQUEADO ✓
```

### Caso 2: Cargar → Cobrar
```
1. Crear pedido con 1 Vino + 1kg Paella
2. Click "Cargar"
   → Imprime comanda simple a COCINA (solo Vino)
   → Pedido en tabla general
3. Click en pedido → Click "Cobrar"
   → Abre drawer de cobro
4. Confirmar pago
   → status: DELIVERED ✓
   → isSentToKitchen: true ✓
   → Pedido BLOQUEADO ✓
```

### Caso 3: Kilaje y Cobrar
```
1. Crear pedido con 1 Vino + 1kg Paella
2. Click "Kilaje y Cobrar"
   → Imprime comanda simple a COCINA (solo Vino)
   → Imprime comanda completa (todo el pedido)
   → Abre drawer de cobro
3. Confirmar pago
   → status: DELIVERED ✓
   → isSentToKitchen: true ✓
   → Pedido BLOQUEADO ✓
```

---

## ARCHIVOS MODIFICADOS

### Frontend
- `frontend/src/components/caja/KgOrdersModule.tsx`
  - `handlePayment()`: Agregado `isSentToKitchen: true` al payload

### Backend
- `backend/src/modules/orders/orders.service.ts`
  - `updateStatus()`: Acepta `isSentToKitchen` en `orderData`

---

## ESTADO FINAL

✅ Botón "Cargar" → Crea pedido editable
✅ Botón "Cargar y Cobrar" → Crea, imprime, cobra y marca como enviado a kilaje
✅ Botón "Kilaje y Cobrar" → Crea, imprime ambas comandas, cobra y marca como enviado
✅ Bloqueo de formulario funciona correctamente
✅ Drawer de cobro actualiza correctamente todos los campos
✅ No quedan pedidos bloqueados sin poder enviar a kilaje

**Sistema listo para producción**
