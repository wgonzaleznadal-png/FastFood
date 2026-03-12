# Corrección: Kilaje y Cobrar → DELIVERED

## Fecha: 06/03/2026 - 18:42

---

## Problema Identificado

**Botón "Kilaje y Cobrar"** estaba marcando:
```
isPaid: true ✓
status: PENDING ✗
```

**Lógica Incorrecta**: El pedido quedaba cobrado pero NO entregado.

---

## Lógica Correcta

**Enviar a kilaje = Entregar el pedido**

Cuando se envía un pedido a kilaje, significa que:
1. Se pesó la comida
2. Se imprimió la comanda completa
3. El pedido está listo para entregar
4. **El pedido se considera ENTREGADO**

Por lo tanto, "Kilaje y Cobrar" debe marcar:
```
isPaid: true ✓
status: DELIVERED ✓
isSentToKitchen: true ✓
```

---

## Solución Implementada

### Backend - `orders.router.ts`

Corregido endpoint para extraer `isPaid` del body:
```typescript
router.patch('/:id/status', authenticate, async (req, res, next) => {
  const { status, paymentMethod, isPaid, ...orderData } = req.body;

  const order = await ordersService.updateStatus(
    tenantId, 
    orderId, 
    status || undefined, 
    paymentMethod,
    { ...orderData, isPaid }
  );
});
```

---

### Frontend - `KgOrdersModule.tsx`

#### 1. Nuevo Estado
```typescript
const [markAsDeliveredOnPay, setMarkAsDeliveredOnPay] = useState(false);
```

#### 2. Actualizado `handleSubmit`
```typescript
if (action === "save_mp" || action === "charge_weigh") {
  // Kilaje y Cobrar debe marcar como DELIVERED al cobrar
  setMarkAsDeliveredOnPay(action === "charge_weigh");
  openPaymentDrawer(res.data.id, total);
}
```

#### 3. Actualizado `handlePayment`
```typescript
const payload: any = {
  paymentMethod: ...,
  isPaid: true,
  ...pendingOrderUpdate,
};

// Si viene de "Kilaje y Cobrar", marcar como DELIVERED
if (markAsDeliveredOnPay) {
  payload.status = "DELIVERED";
}
```

#### 4. Actualizado botón "Kilaje y Cobrar" en edición
```typescript
setMarkAsDeliveredOnPay(true);
openPaymentDrawer(editingOrder.id, total, orderData);
```

---

## Flujos Corregidos

### "CARGAR"
```
1. Crea pedido (isPaid: false, status: PENDING)
2. Imprime comanda cocina
→ NO cobrado, NO entregado
```

### "CARGAR Y COBRAR"
```
1. Crea pedido (isPaid: false, status: PENDING)
2. Imprime comanda cocina
3. Abre drawer
4. Al cobrar → isPaid: true, status: PENDING
→ COBRADO pero NO entregado (pendiente de kilaje)
```

### "KILAJE Y COBRAR"
```
1. Crea pedido (isPaid: false, status: PENDING)
2. Imprime comandas
3. Abre drawer
4. Al cobrar → isPaid: true, status: DELIVERED ✓
→ COBRADO Y ENTREGADO
```

---

## Estados Finales

### Pedido "Cargar"
```
isPaid: false
status: PENDING
isSentToKitchen: false
→ Editable, pendiente de cobro y entrega
```

### Pedido "Cargar y Cobrar"
```
isPaid: true
status: PENDING
isSentToKitchen: false
→ Bloqueado (cobrado), pendiente de entrega
```

### Pedido "Kilaje y Cobrar"
```
isPaid: true
status: DELIVERED
isSentToKitchen: true
→ Bloqueado (cobrado), entregado
```

---

## Archivos Modificados

### Backend
- `backend/src/modules/orders/orders.router.ts` - Endpoint `/api/orders/:id/status` corregido

### Frontend
- `frontend/src/components/caja/KgOrdersModule.tsx`:
  - Agregado estado `markAsDeliveredOnPay`
  - Actualizado `handleSubmit` para setear flag
  - Actualizado `handlePayment` para enviar `status: DELIVERED`
  - Actualizado botón "Kilaje y Cobrar" en edición

---

## Testing

### Caso 1: Kilaje y Cobrar (nuevo pedido)
```
1. Crear pedido con 1kg Paella
2. Click "Kilaje y Cobrar"
   → Imprime comanda completa
   → Abre drawer
3. Confirmar pago
   → isPaid: true ✓
   → status: DELIVERED ✓
   → Pedido bloqueado ✓
```

### Caso 2: Kilaje y Cobrar (desde edición)
```
1. Crear pedido con "Cargar"
2. Click en pedido
3. Click "Kilaje y Cobrar"
   → Imprime comanda completa
   → Abre drawer
4. Confirmar pago
   → isPaid: true ✓
   → status: DELIVERED ✓
   → Pedido bloqueado ✓
```

---

## Estado Final

✅ Drawer de cobro funcionando sin errores
✅ "Kilaje y Cobrar" marca status = DELIVERED
✅ Lógica correcta: enviar a kilaje = entregar
✅ Backend maneja correctamente el payload
✅ Frontend envía status cuando corresponde

**Sistema con lógica correcta implementada**
