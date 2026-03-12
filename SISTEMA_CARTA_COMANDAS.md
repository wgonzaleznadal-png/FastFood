# 🍽️ Sistema de Carta con Comandas Diferenciadas

## 📋 Resumen Ejecutivo

Se implementó exitosamente un sistema completo de **Carta (Comidas y Bebidas)** con **comandas diferenciadas** para cocina, barra y kilaje/entrega. Este sistema permite gestionar productos de carta independientes de los productos por KG, con routing automático de comandas según el destino.

---

## 🎯 Funcionalidades Implementadas

### **1. Gestión de Carta (Menu Items)**

#### **Backend**
- **Modelo `MenuItem` en Prisma:**
  - Campos: `name`, `description`, `price`, `type` (FOOD/DRINK), `destination` (KITCHEN/BAR)
  - Tiempo de preparación, orden de visualización, disponibilidad
  - Relación con `Tenant` y `OrderItem`

- **API REST Completa:**
  - `GET /api/menu/carta` - Listar items (filtrable por `?type=FOOD` o `?type=DRINK`)
  - `GET /api/menu/carta/:id` - Obtener item específico
  - `POST /api/menu/carta` - Crear nuevo item
  - `PUT /api/menu/carta/:id` - Actualizar item
  - `DELETE /api/menu/carta/:id` - Eliminar item
  - `PATCH /api/menu/carta/:id/toggle` - Toggle disponibilidad

#### **Frontend**
- **Página `/dashboard/menu/carta`:**
  - Tabs separados para Comidas y Bebidas
  - CRUD completo con modal de creación/edición
  - Tabla con información de precio, destino, tiempo de preparación
  - Toggle de disponibilidad en línea
  - Validación con Zod y Mantine Forms

---

### **2. Pedidos Mixtos (KG + Carta)**

#### **Backend**
- **`OrderItem` extendido:**
  - Ahora soporta `productId` (para productos por KG) y `menuItemId` (para items de carta)
  - Campo `destination` para routing de comandas (KITCHEN/BAR/DELIVERY)
  - Ambos campos son opcionales (nullable)

- **`createKgOrder` actualizado:**
  - Acepta array `menuItems` opcional además de `items` (productos por KG)
  - Valida disponibilidad de items de carta
  - Calcula precio total combinando ambos tipos
  - Asigna `destination` automáticamente según el tipo de item

#### **Schema de Validación:**
```typescript
{
  items: [{ productId, weightKg, notes }],      // Productos por KG
  menuItems: [{ menuItemId, quantity, notes }], // Items de carta (opcional)
  // ... resto de campos del pedido
}
```

---

### **3. Módulo de Cocina**

#### **Backend**
- **Servicio `kitchen.service.ts`:**
  - `getKitchenOrders()` - Obtener comandas pendientes (filtrable por estación)
  - `getKitchenOrderDetails()` - Detalle completo de un pedido
  - `markOrderInProgress()` - Marcar pedido en preparación
  - `markOrderReady()` - Marcar pedido listo
  - `getKitchenStats()` - Estadísticas de comandas (pending/inProgress/ready)

- **API REST:**
  - `GET /api/cocina/orders?station=KITCHEN|BAR` - Listar comandas
  - `GET /api/cocina/orders/:id` - Detalle de comanda
  - `PATCH /api/cocina/orders/:id/in-progress` - Marcar en preparación
  - `PATCH /api/cocina/orders/:id/ready` - Marcar listo
  - `GET /api/cocina/stats` - Estadísticas

#### **Frontend**
- **Página `/dashboard/cocina`:**
  - Tabs separados para Cocina y Barra
  - Dashboard con estadísticas (Pendientes/En Preparación/Listos/Total)
  - Vista de tarjetas con comandas agrupadas por pedido
  - Botones de acción: "Iniciar" y "Marcar Listo"
  - Auto-refresh cada 10 segundos
  - Indicador de tiempo de preparación estimado
  - Badge de delivery para pedidos a domicilio

- **Agregado al Sidebar:**
  - Nuevo item "Cocina" con icono de chef
  - Permisos: OWNER, MANAGER, COOK

---

## 🗄️ Estructura de Base de Datos

### **Nuevos Modelos**

```prisma
model MenuItem {
  id              String         @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  price           Decimal        @db.Decimal(10, 2)
  imageUrl        String?
  type            MenuItemType   // FOOD o DRINK
  destination     KitchenStation // KITCHEN o BAR
  isAvailable     Boolean        @default(true)
  preparationTime Int?
  sortOrder       Int            @default(0)
  
  tenant     Tenant      @relation(...)
  orderItems OrderItem[]
}

enum MenuItemType {
  FOOD   // Comidas
  DRINK  // Bebidas
}

enum KitchenStation {
  KITCHEN  // Cocina
  BAR      // Barra
  DELIVERY // Kilaje/Entrega
}
```

### **Modelo OrderItem Actualizado**

```prisma
model OrderItem {
  id         String   @id @default(cuid())
  orderId    String
  productId  String?  // Para productos por KG (nullable)
  menuItemId String?  // Para items de carta (nullable)
  
  unitType   UnitType @default(UNIT)
  quantity   Decimal
  unitPrice  Decimal
  subtotal   Decimal
  
  destination KitchenStation? // Para routing de comandas
  notes      String?
  
  order    Order      @relation(...)
  product  Product?   @relation(...)
  menuItem MenuItem?  @relation(...)
}
```

---

## 🔄 Flujo de Comandas Diferenciadas

### **Escenario: Cliente pide 1kg Arroz + 1 Rabas + 1 Vino**

1. **Carga del Pedido:**
   ```json
   {
     "customerName": "Juan Pérez",
     "items": [
       { "productId": "...", "weightKg": 1 }  // Arroz
     ],
     "menuItems": [
       { "menuItemId": "...", "quantity": 1 }, // Rabas (destination: KITCHEN)
       { "menuItemId": "...", "quantity": 1 }  // Vino (destination: BAR)
     ]
   }
   ```

2. **Comandas Generadas Automáticamente:**
   - **Comanda Cocina:** 1x Rabas (se imprime/muestra en `/dashboard/cocina?station=KITCHEN`)
   - **Comanda Barra:** 1x Vino (se imprime/muestra en `/dashboard/cocina?station=BAR`)

3. **Al marcar "Kilaje":**
   - **Comanda Completa:** 1kg Arroz + 1 Rabas + 1 Vino
   - El encargado de kilaje/entrega ve todo lo que necesita el cliente
   - Puede "reclamar" items en cocina/barra según necesidad

---

## 📁 Archivos Creados/Modificados

### **Backend**

#### **Nuevos Archivos:**
- `src/modules/menu/menu-items.service.ts` - Lógica de negocio para MenuItem
- `src/modules/menu/menu-items.schema.ts` - Validaciones Zod
- `src/modules/menu/menu-items.router.ts` - Endpoints REST
- `src/modules/kitchen/kitchen.service.ts` - Lógica de comandas
- `src/modules/kitchen/kitchen.schema.ts` - Validaciones
- `src/modules/kitchen/kitchen.router.ts` - Endpoints REST

#### **Modificados:**
- `prisma/schema.prisma` - Agregado MenuItem, actualizado OrderItem, nuevos enums
- `src/modules/menu/menu.schema.ts` - Agregado `menuItems` opcional en createKgOrderSchema
- `src/modules/menu/menu.service.ts` - Extendido `createKgOrder` para soportar items de carta
- `src/lib/modules.ts` - Agregado módulo "cocina" y submódulo "menu.carta"
- `src/app.ts` - Registradas rutas `/api/menu/carta` y `/api/cocina`

### **Frontend**

#### **Nuevos Archivos:**
- `src/app/dashboard/menu/carta/page.tsx` - Gestión de carta (CRUD)
- `src/app/dashboard/cocina/page.tsx` - Vista de comandas

#### **Modificados:**
- `src/app/dashboard/layout.tsx` - Agregado "Cocina" al sidebar navigation

---

## 🔐 Permisos

### **Módulo Carta (`menu.carta`)**
- **Acceso:** OWNER, MANAGER
- **Funcionalidad:** Crear, editar, eliminar items de carta

### **Módulo Cocina (`cocina`)**
- **Acceso:** OWNER, MANAGER, COOK
- **Submódulos:**
  - `cocina.comandas` - Vista de comandas de cocina
  - `cocina.barra` - Vista de comandas de barra

---

## 🚀 Migración Aplicada

**Migración:** `20260305164408_add_menu_items_and_kitchen_stations`

**Cambios en DB:**
- Tabla `menu_items` creada
- Tabla `order_items` actualizada con `menuItemId` y `destination`
- Enums `MenuItemType` y `KitchenStation` creados

---

## 📊 Estado del Sistema

### **Backend**
- ✅ Corriendo en http://localhost:4000
- ✅ Todos los endpoints funcionando
- ✅ Prisma Client actualizado
- ✅ Migraciones aplicadas

### **Frontend**
- ✅ Página de Carta funcional
- ✅ Página de Cocina funcional
- ✅ Navegación actualizada
- ✅ Permisos configurados

### **Base de Datos**
- ✅ Tablas creadas
- ✅ Relaciones establecidas
- ✅ Enums configurados

---

## 🎓 Próximos Pasos Sugeridos

1. **Integración con Impresoras:**
   - Implementar impresión automática de comandas al crear pedido
   - Configurar impresoras por estación (cocina/barra)

2. **Selector de Carta en Modal de Nuevo Pedido:**
   - Agregar botón "Agregar de Carta" en el modal de nuevo pedido
   - Modal secundario para seleccionar items de carta
   - Agregar items de carta al pedido junto con items por KG

3. **Notificaciones en Tiempo Real:**
   - WebSockets para notificar nuevas comandas a cocina/barra
   - Sonido de alerta cuando llega nueva comanda

4. **Reportes:**
   - Items de carta más vendidos
   - Tiempos promedio de preparación
   - Eficiencia de cocina/barra

---

## 📝 Notas Técnicas

- **Compatibilidad:** El sistema es 100% compatible con pedidos existentes (solo productos por KG)
- **Migración:** Los pedidos antiguos no se ven afectados
- **Performance:** Las consultas están optimizadas con includes específicos
- **Escalabilidad:** El sistema soporta múltiples estaciones de cocina si se necesita en el futuro

---

## ✅ Checklist de Implementación

- [x] Modelo MenuItem en Prisma
- [x] Migración de base de datos
- [x] API REST para MenuItem (CRUD completo)
- [x] Extender OrderItem para soportar menuItemId
- [x] Actualizar createKgOrder para pedidos mixtos
- [x] Módulo de Cocina (backend completo)
- [x] Página de Carta (frontend)
- [x] Página de Cocina (frontend)
- [x] Agregar Cocina al sidebar
- [x] Configurar permisos
- [x] Documentación completa
- [ ] Selector de carta en modal de nuevo pedido (pendiente)
- [ ] Integración con impresoras (pendiente)
- [ ] Notificaciones en tiempo real (pendiente)

---

**Fecha de Implementación:** 5 de Marzo, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ Completado y Funcional
