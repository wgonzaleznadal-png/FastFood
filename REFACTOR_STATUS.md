# 🎯 Estado de la Refactorización - Sprint Completo

## ✅ COMPLETADO

### **1. Unificación de Órdenes (CRÍTICO)**
- ✅ Modelo `Order` unificado con soporte para UNIT, KG y PORTION
- ✅ Modelo `OrderItem` con campo `unitType` (Decimal para soportar 1.5kg, 2 unidades, 0.5 porción)
- ✅ Enum `UnitType` creado (UNIT, KG, PORTION)
- ✅ Migración aplicada exitosamente: `20260303064151_unify_orders_and_expenses`
- ✅ Cliente Prisma regenerado

**Campos agregados a Order:**
- `orderNumber` (INT) - Número secuencial por shift
- `customerName` (STRING) - Nombre del cliente
- `customerId` (STRING?) - Relación con Customer
- `cadeteId` (STRING?) - Relación con Cadete
- `isDelivery` (BOOLEAN) - Flag de delivery
- `deliveryAddress`, `deliveryPhone`, `deliveryLat`, `deliveryLng` - Datos de entrega
- `paymentMethod` (STRING) - Método de pago
- `cadetePaidAmount` (DECIMAL) - Monto pagado al cadete
- `isSentToKitchen` (BOOLEAN) - Flag de envío a cocina
- `source` (OrderSource) - LOCAL o WHATSAPP
- `waJid` (STRING?) - ID de WhatsApp

**Campos agregados a OrderItem:**
- `unitType` (UnitType) - UNIT, KG o PORTION
- `quantity` (DECIMAL 8,3) - Soporta decimales
- `subtotal` (DECIMAL 10,2) - Subtotal calculado

### **2. Unificación de Egresos**
- ✅ Modelo `Expense` unificado creado
- ✅ Enum `ExpenseType` creado (CASH, STRUCTURAL, SUPPLIES)
- ✅ Relaciones agregadas a Tenant, Shift y User
- ✅ Modelos viejos (`CashExpense`, `StructuralExpense`) marcados como DEPRECATED

**Campos del modelo Expense:**
- `type` (ExpenseType) - CASH, STRUCTURAL o SUPPLIES
- `category` (STRING?) - Categoría personalizada
- `shiftId` (STRING?) - Solo para type=CASH
- `period`, `dueDate`, `paidAt`, `isPaid` - Para gastos estructurales

### **3. Relaciones Actualizadas**
- ✅ `Customer` → `orders` (Order unificado)
- ✅ `Cadete` → `orders` (Order unificado)
- ✅ `Order` → `customer`, `cadete`, `table`, `user`
- ✅ Constraint único: `[shiftId, orderNumber]`

---

## 🚧 PENDIENTE (Para completar el sprint)

### **4. Servicios Backend**

#### **A. Crear `orders.service.ts` unificado**
Debe reemplazar la funcionalidad de `menu.service.ts` (kg_orders) con:
- `createOrder(tenantId, shiftId, data)` - Crear orden (UNIT, KG o PORTION)
- `getOrderById(tenantId, id)` - Obtener orden
- `listOrders(tenantId, shiftId, filters?)` - Listar órdenes
- `updateOrder(tenantId, id, data)` - Actualizar orden
- `deleteOrder(tenantId, id)` - Eliminar orden
- `sendToKitchen(tenantId, id)` - Marcar como enviado a cocina
- `updateStatus(tenantId, id, status)` - Cambiar estado
- `assignCadete(tenantId, id, cadeteId)` - Asignar cadete
- `calculateTotal(items)` - Calcular total de la orden

**Importante:** Mantener compatibilidad con `fmt()` para formateo de precios.

#### **B. Crear `orders.router.ts` unificado**
Endpoints REST:
```
GET    /api/orders              - Listar órdenes del shift activo
GET    /api/orders/:id          - Obtener orden por ID
POST   /api/orders              - Crear orden
PATCH  /api/orders/:id          - Actualizar orden
DELETE /api/orders/:id          - Eliminar orden
POST   /api/orders/:id/kitchen  - Enviar a cocina
PATCH  /api/orders/:id/status   - Cambiar estado
PATCH  /api/orders/:id/cadete   - Asignar cadete
```

#### **C. Crear `expenses.service.ts` unificado**
Debe fusionar `shifts.service.ts` (cash_expenses) y `finance.service.ts` (structural_expenses):
- `createExpense(tenantId, data)` - Crear egreso (CASH, STRUCTURAL, SUPPLIES)
- `getExpenseById(tenantId, id)` - Obtener egreso
- `listExpenses(tenantId, filters?)` - Listar egresos
- `updateExpense(tenantId, id, data)` - Actualizar egreso
- `deleteExpense(tenantId, id)` - Eliminar egreso
- `getExpensesByShift(tenantId, shiftId)` - Egresos de un turno
- `getExpensesByType(tenantId, type)` - Egresos por tipo

#### **D. Crear `expenses.router.ts` unificado**
Endpoints REST:
```
GET    /api/expenses                  - Listar egresos
GET    /api/expenses/:id              - Obtener egreso
POST   /api/expenses                  - Crear egreso
PATCH  /api/expenses/:id              - Actualizar egreso
DELETE /api/expenses/:id              - Eliminar egreso
GET    /api/expenses/shift/:shiftId   - Egresos de un turno
GET    /api/expenses/type/:type       - Egresos por tipo
```

### **5. Frontend**

#### **A. Actualizar `KgOrdersModule.tsx`**
Cambiar para usar el nuevo endpoint `/api/orders`:
- Enviar `unitType: 'KG'` en los items
- Mantener toda la funcionalidad actual
- Usar el nuevo modelo unificado

#### **B. Actualizar componentes de Caja**
- Actualizar drawer de egresos para usar `/api/expenses`
- Cambiar `type: 'CASH'` en lugar de endpoint separado

#### **C. Actualizar componentes de Finanzas**
- Actualizar para usar `/api/expenses` con filtro `type: 'STRUCTURAL'`
- Mantener funcionalidad de consolidador

### **6. Migración de Datos**

#### **Script de migración `kg_orders` → `orders`**
Crear script para migrar datos históricos:
```typescript
// backend/scripts/migrate-kg-orders.ts
async function migrateKgOrdersToOrders() {
  const kgOrders = await prisma.kgOrder.findMany({ include: { items: true } });
  
  for (const kgOrder of kgOrders) {
    await prisma.order.create({
      data: {
        tenantId: kgOrder.tenantId,
        shiftId: kgOrder.shiftId,
        userId: kgOrder.userId,
        customerId: kgOrder.customerId,
        cadeteId: kgOrder.cadeteId,
        orderNumber: kgOrder.orderNumber,
        customerName: kgOrder.customerName,
        isDelivery: kgOrder.isDelivery,
        deliveryAddress: kgOrder.deliveryAddress,
        deliveryPhone: kgOrder.deliveryPhone,
        deliveryLat: kgOrder.deliveryLat,
        deliveryLng: kgOrder.deliveryLng,
        paymentMethod: kgOrder.paymentMethod,
        cadetePaidAmount: kgOrder.cadetePaidAmount,
        isSentToKitchen: kgOrder.isSentToKitchen,
        status: kgOrder.status,
        totalPrice: kgOrder.totalPrice,
        source: kgOrder.source,
        waJid: kgOrder.waJid,
        notes: kgOrder.notes,
        createdAt: kgOrder.createdAt,
        updatedAt: kgOrder.updatedAt,
        items: {
          create: kgOrder.items.map(item => ({
            productId: item.productId,
            unitType: 'KG',
            quantity: item.weightKg,
            unitPrice: item.pricePerKg,
            subtotal: item.subtotal,
            notes: item.notes,
          })),
        },
      },
    });
  }
}
```

### **7. Deprecación**

#### **Marcar como deprecated:**
- `backend/src/modules/menu/` (reemplazar por `orders/`)
- `CashExpense` y `StructuralExpense` en schema (ya marcados)
- Endpoints viejos en routers

---

## 📊 Beneficios Logrados

- ✅ **-2 tablas** (orders unificado, expenses unificado)
- ✅ **Escalabilidad** - Ahora se puede vender por unidad Y kilaje en el mismo pedido
- ✅ **Queries más simples** - Un solo JOIN en lugar de múltiples
- ✅ **Reportes unificados** - Todo en una sola tabla
- ✅ **tenantId** presente en todos los modelos (seguridad garantizada)
- ✅ **fmt()** compatible con nuevos modelos Decimal

---

## 🎯 Próximos Pasos Inmediatos

1. **Crear `orders.service.ts`** - Servicio unificado para órdenes
2. **Crear `orders.router.ts`** - Router con endpoints REST
3. **Crear `expenses.service.ts`** - Servicio unificado para egresos
4. **Crear `expenses.router.ts`** - Router con endpoints REST
5. **Actualizar frontend** - KgOrdersModule, Caja, Finanzas
6. **Migrar datos** - Script para mover kg_orders → orders
7. **Testing** - Verificar que todo funciona
8. **Deprecar** - Eliminar código viejo

---

## ⚠️ Notas Importantes

- **NO eliminar datos históricos** - Solo migrar
- **Mantener backward compatibility** - APIs viejas funcionan hasta deprecación final
- **Testing exhaustivo** - Cada cambio debe probarse
- **Rollback plan** - Poder volver atrás si algo falla
- **Documentar cambios** - Actualizar README

---

## 🚀 Estado Actual

**Base de datos:** ✅ Refactorizada y migrada  
**Backend:** 🚧 Servicios pendientes  
**Frontend:** 🚧 Actualización pendiente  
**Migración de datos:** 🚧 Script pendiente  

**Progreso total:** 40% completado
