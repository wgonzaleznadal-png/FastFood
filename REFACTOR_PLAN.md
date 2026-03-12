# 🔧 Plan de Refactorización de Base de Datos

## Objetivo
Simplificar y unificar la arquitectura de datos sin romper el sistema en producción.

---

## 🎯 Problemas Identificados

### 1. **Doble Comando de Órdenes**
- **Problema:** `orders` + `order_items` vs `kg_orders` + `kg_order_items`
- **Impacto:** Si mañana se vende por unidad Y kilaje en el mismo pedido, el sistema se rompe
- **Solución:** Unificar en `orders` con campo `unitType` (KG, UNIT, PORTION)

### 2. **Egresos Duplicados**
- **Problema:** `cash_expenses` vs `structural_expenses` (misma entidad, distinto fin)
- **Impacto:** Reportes financieros complicados, consultas duplicadas
- **Solución:** Fusionar en `expenses` con campo `category` (CASH, STRUCTURAL, SUPPLIES)

### 3. **WhatsApp Logs**
- **Problema:** `wa_messages` guarda texto plano indefinidamente
- **Impacto:** Basura digital que ralentiza el sistema
- **Solución:** Ya implementado - limpieza automática cada 24hs ✅

### 4. **Permisos Complejos**
- **Problema:** `module_permissions` + `user_module_access` (suenan a lo mismo)
- **Impacto:** Confusión, queries complejas
- **Solución:** Simplificar a una tabla `permissions` vinculada a roles/users

---

## 📋 Estrategia de Migración (Incremental)

### **Fase 1: Agregar Nuevas Estructuras (Sin Romper)**
1. Crear nuevos modelos unificados en paralelo
2. Mantener modelos viejos funcionando
3. Agregar campos de compatibilidad

### **Fase 2: Migración de Datos**
1. Script de migración de datos históricos
2. Validación de integridad
3. Backup antes de migrar

### **Fase 3: Actualizar Backend**
1. Crear nuevos servicios para modelos unificados
2. Mantener servicios viejos como fallback
3. Feature flags para activar/desactivar

### **Fase 4: Actualizar Frontend**
1. Actualizar componentes para usar nuevas APIs
2. Mantener compatibilidad con APIs viejas
3. Testing exhaustivo

### **Fase 5: Deprecar Modelos Viejos**
1. Marcar como deprecated
2. Eliminar referencias
3. Drop tables

---

## 🚀 Implementación Propuesta

### **1. Unificar Órdenes**

```prisma
enum UnitType {
  UNIT      // Por unidad (1 pizza, 2 empanadas)
  KG        // Por kilaje (1.5kg de paella)
  PORTION   // Por porción (1/2 pollo, 1/4 torta)
}

model Order {
  id              String        @id @default(cuid())
  tenantId        String
  shiftId         String
  userId          String?
  customerId      String?
  cadeteId        String?
  
  // Metadata
  orderNumber     Int
  customerName    String
  
  // Delivery
  isDelivery      Boolean       @default(false)
  deliveryAddress String?
  deliveryPhone   String?
  deliveryLat     Float?
  deliveryLng     Float?
  
  // Payment
  paymentMethod   String        @default("EFECTIVO")
  cadetePaidAmount Decimal      @db.Decimal(10, 2) @default(0)
  
  // Status
  isSentToKitchen Boolean       @default(false)
  status          OrderStatus   @default(PENDING)
  totalPrice      Decimal       @db.Decimal(10, 2) @default(0)
  
  // WhatsApp
  source          OrderSource   @default(LOCAL)
  waJid           String?
  
  notes           String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  tenant   Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  shift    Shift       @relation(fields: [shiftId], references: [id])
  customer Customer?   @relation(fields: [customerId], references: [id])
  cadete   Cadete?     @relation(fields: [cadeteId], references: [id])
  items    OrderItem[]
  
  @@unique([shiftId, orderNumber])
  @@map("orders")
}

model OrderItem {
  id         String   @id @default(cuid())
  orderId    String
  productId  String
  
  // Unificado: soporta unidades, kg y porciones
  unitType   UnitType @default(UNIT)
  quantity   Decimal  @db.Decimal(8, 3) // 1.5kg, 2 unidades, 0.5 porción
  unitPrice  Decimal  @db.Decimal(10, 2)
  subtotal   Decimal  @db.Decimal(10, 2)
  
  notes      String?
  
  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])
  
  @@map("order_items")
}
```

### **2. Unificar Egresos**

```prisma
enum ExpenseType {
  CASH         // Caja chica (insumos, delivery, limpieza)
  STRUCTURAL   // Alquiler, sueldos, impuestos
  SUPPLIES     // Compras de mercadería
}

model Expense {
  id          String       @id @default(cuid())
  tenantId    String
  shiftId     String?      // Solo para CASH
  userId      String?
  
  type        ExpenseType
  category    String?      // "Alquiler", "Sueldo", "Limpieza", etc.
  description String
  amount      Decimal      @db.Decimal(10, 2)
  currency    String       @default("ARS")
  
  // Para gastos estructurales
  period      String?
  dueDate     DateTime?
  paidAt      DateTime?
  isPaid      Boolean      @default(false)
  
  notes       String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  shift  Shift? @relation(fields: [shiftId], references: [id])
  user   User?  @relation(fields: [userId], references: [id])
  
  @@map("expenses")
}
```

### **3. Simplificar Permisos**

```prisma
model Permission {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String?  // Si es null, aplica al role
  role         Role?    // Si es null, aplica al user
  
  moduleKey    String
  submoduleKey String?
  hasAccess    Boolean  @default(true)
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, userId, role, moduleKey, submoduleKey])
  @@map("permissions")
}
```

---

## ⚠️ Consideraciones Importantes

1. **No eliminar datos históricos** - Migrar, no borrar
2. **Mantener backward compatibility** - APIs viejas funcionan hasta Fase 5
3. **Testing exhaustivo** - Cada fase debe pasar tests antes de continuar
4. **Rollback plan** - Poder volver atrás en cualquier momento
5. **Documentar cambios** - Actualizar README y docs

---

## 📊 Beneficios Esperados

- ✅ **-50% de tablas** (de 8 a 4 tablas core)
- ✅ **Queries más simples** (un solo JOIN en lugar de múltiples)
- ✅ **Escalabilidad** (soporta cualquier tipo de venta)
- ✅ **Reportes unificados** (todo en una sola tabla)
- ✅ **Menos bugs** (menos código duplicado)

---

## 🎯 Próximos Pasos

**¿Querés que implemente esta refactorización?**

Opciones:
1. **Implementar Fase 1** - Agregar nuevas estructuras sin romper nada
2. **Solo unificar órdenes** - Empezar por el problema más crítico
3. **Solo unificar egresos** - Empezar por lo más simple
4. **Revisar plan** - Ajustar estrategia antes de implementar
