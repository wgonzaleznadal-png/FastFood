# Sistema de Doble Comanda - GastroDash 2.0

## Resumen del Flujo Implementado

Este documento explica cómo funciona el sistema de impresión de comandas diferenciadas según el tipo de producto y la acción del usuario.

---

## Conceptos Clave

### Tipos de Productos (unitType)
- **KG**: Productos por kilaje (Paella, Arroz con Pollo, etc.)
- **UNIT**: Productos de carta por unidad (Rabas, Bebidas, etc.)

### Estaciones de Cocina (destination)
- **COCINA**: Para productos que se preparan en cocina
- **BARRA**: Para bebidas y productos de barra
- **DESPACHO**: Para kilaje/entrega (comandas completas)

### Tipos de Comanda
1. **Comanda Simple (Cocina/Barra)**: Solo muestra cantidad y nombre del producto en grande. Va a la estación correspondiente.
2. **Comanda Completa (Entrega/Kilaje)**: Muestra todos los datos general del pedido (cliente, items kg, items cocina, items barra).

---

## Flujo de Impresión por Botón

### PEDIDOS RETIRO - NUEVO

#### 1. Botón "CARGAR"
**Acción**: Crea el pedido en la base de datos (isSentToKitchen = false).

**Impresión**:
- Si hay items de CARTA (unitType = UNIT): Imprime **comanda simple** a cocina/barra
- Si solo hay items de KG: No imprime nada

**Ejemplo**:
```
Pedido: 1 Rabas + 1kg Arroz
→ Imprime: Comanda simple a COCINA con "1 rabas"
→ NO imprime: Comanda completa
→ Pedido queda PENDIENTE en la tabla general
```

---

#### 2. Botón "CARGAR Y COBRAR"
**Acción**: Crea el pedido y abre el drawer de cobro.

**Impresión**:
- Si hay items de CARTA: Imprime **comanda simple** a cocina/barra
- Abre drawer de cobro
- NO imprime comanda completa

**Ejemplo**:
```
Pedido: 1 Rabas + 1kg Arroz
→ Imprime: Comanda simple a COCINA con "1 rabas"
→ Abre: Drawer de cobro
→ NO imprime: Comanda completa
```

---

#### 3. Botón "KILAJE Y COBRAR"
**Acción**: Crea el pedido, imprime comandas y abre drawer de cobro.

**Impresión**:
- Si hay items de CARTA: Imprime **comanda simple** a cocina/barra
- Imprime **comanda completa** con todos los datos
- Abre drawer de cobro

**Ejemplo**:
```
Pedido: 1 Rabas + 1kg Arroz
→ Imprime: Comanda simple a COCINA con "1 rabas"
→ Imprime: Comanda completa con todos los items y total
→ Abre: Drawer de cobro
```

---

### PEDIDOS RETIRO - CARGADO (ya en tabla general)

#### 1. Botón "COBRAR"
**Acción**: Solo abre el drawer de cobro.

**Impresión**: Ninguna (la comanda a cocina ya se imprimió)

**Estado**: Pedido queda PENDIENTE de entrega

---

#### 2. Botón "KILAJE Y COBRAR"
**Acción**: Marca como enviado a kilaje, imprime comanda completa y abre drawer.

**Impresión**:
- Imprime **comanda completa** con todos los datos
- si tiene productos de COCINA/BARRA, NO imprime mas nada. ya se imprimio al cargar el pedido a la lista.
- Abre drawer de cobro

**Estado**: Pedido pasa a ENTREGADO (el cajero ya no tiene más que hacer)

---

#### 3. Botón "RE-IMPRIMIR COMANDA"
**Acción**: Re-imprime la comanda completa con justificación.

**Impresión**:
- Solicita motivo de re-impresión
- Imprime **comanda completa** con marca de RE-IMPRESIÓN
- Registra motivo en notas del pedido

---

### PEDIDOS DELIVERY

#### 1. Botón "CARGAR"
**Acción**: Crea el pedido delivery.

**Impresión**:
- Si hay items de CARTA: Imprime **comanda simple** a cocina/barra
- Imprime **comanda completa** (delivery)

---

#### 2. Botón "CARGAR Y COBRAR"
**Acción**: Crea el pedido delivery y abre drawer.

**Impresión**:
- Si hay items de CARTA: Imprime **comanda simple** a cocina/barra
- Imprime **comanda completa** (delivery)
- Abre drawer de cobro

---

## Flujo en Modo Edición

### Botón "Cobrar" (pedido PENDING)
**Acción**: Solo cobra el pedido, NO imprime nada.

**Impresión**: Ninguna

---

### Botón "Kilaje y Cobrar" (pedido PENDING sin enviar a kilaje)
**Acción**: Marca como enviado a kilaje, imprime comanda completa y abre drawer.

**Impresión**:
- Imprime **comanda completa** con todos los datos
- Abre drawer de cobro

---

### Botón "Re-imprimir Comanda" (pedido ya en kilaje)
**Acción**: Re-imprime la comanda completa con justificación.

**Impresión**:
- Imprime **comanda completa** con marca de RE-IMPRESIÓN
- Registra motivo en notas del pedido

### BOTON "ADICION Y COBRAR" (NUEVO) 
si el sistema detecta una "adicion" el boton "kilaje y cobrar" se convierte en "adición y cobrar".

**Impresión**:
- Imprime **comanda completa** HIBRIDA (NUEVO) 

PD: si el pedido esta PAGADO, no se pueden agregar modificaciones.

---

### Botón "Ticket Cliente"
**Acción**: Imprime ticket para el cliente.

**Impresión**:
- Imprime ticket con formato de cliente (sin precios detallados)

---

### BOTON "CANCELAR PEDIDO"

**Acción**: Cancela el pedido. si esta cobrado tiene que "devolver" el dinero para que el cierre de caja de correcto.

**Impresión**: Ninguna

---

## Estructura de Datos

### Comanda Simple (Cocina/Barra)
```
PLAZA NADAL
Casa de Paellas

COMANDA [COCINA]
RETIRO
------------------------
PEDIDO #6
------------------------
Cliente: juan
------------------------

1 rabas
(nota *si tiene*)

GastroDash
```

### Comanda Completa (Entrega/Kilaje)
```
PLAZA NADAL
Casa de Paellas

COMANDA RETIRO
ORIGINAL
------------------------
PEDIDO #6
06/03/2026, 03:29 p.m.
------------------------
Cliente: juan
------------------------
2 kg Paella
(nota *si tiene*)
1 rabas

GastroDash
------------------------

GastroDash
```

---
### Comanda Completa (Entrega/Kilaje) HIBRIDA (NUEVA)
```
PLAZA NADAL
Casa de Paellas

COMANDA RETIRO
ORIGINAL
------------------------
PEDIDO #6
06/03/2026, 03:29 p.m.
------------------------
Cliente: juan
------------------------
AGREGAR:
0.5 kg de Arroz c/ Pollo
(nota *si tiene*)
------------------------
TAMBIEN TIENE:
2 kg Paella
(nota *si tiene*)
1 rabas 
(nota *si tiene*)

GastroDash
------------------------

GastroDash
```

## Archivos Modificados

### Backend
- `backend/prisma/schema.prisma`: Modelo Product con campos `unitType`, `destination`

### Frontend
- `frontend/src/lib/thermalPrinter.ts`: Lógica de generación de tickets diferenciados
- `frontend/src/components/caja/ThermalPrint.tsx`: Componente de impresión con filtrado por estación
- `frontend/src/components/caja/KgOrdersModule.tsx`: Lógica de botones y flujo de impresión

---

## Reglas de Negocio

1. **Solo items de CARTA (UNIT) generan comanda simple**: Los productos KG no van a cocina/barra.
2. **Comanda completa solo se imprime cuando se pesa**: Botón "Kilaje y Cobrar" o "Re-imprimir".
3. **No se re-imprime en el cobro**: Una vez impresa la comanda, el pago NO genera nueva impresión.
4. **Doble comanda para pedidos mixtos**: Si un pedido tiene Rabas (UNIT) + Paella (KG), imprime:
   - Comanda simple a COCINA (solo Rabas)
   - Comanda completa a DESPACHO (todo el pedido)


## Notas Técnicas

- **printMode**: Controla qué se imprime
  - `STATIONS_ONLY`: Solo comandas simples a estaciones
  - `ALL_ONLY`: Solo comanda completa
  - `ALL_AND_STATIONS`: Ambas comandas
  - `CUSTOMER`: Ticket de cliente

- **headerTitle**: Si está presente, activa modo comanda simple
- **isSimpleComanda**: Flag interno que determina el formato de impresión

---

## Cambios de UI Implementados

### Botón "Ticket Cliente" (esto esta pefectamente implementado ya, no tocar)
- **Ubicación anterior**: Debajo de "Re-imprimir Comanda"
- **Ubicación nueva**: Al lado de los botones Retiro/Delivery (área superior derecha)
- **Visibilidad**: Solo visible cuando el pedido está en kilaje (isSentToKitchen = true)

### Botón "Cerrar formulario"
- **Estado**: Eliminado
- **Razón**: La X en el header del formulario es suficiente

### Botón "Kilaje y Cobrar"
- **Visibilidad**: Siempre visible en pedidos PENDING que no están en kilaje
- **Comportamiento**: Funciona tanto para pedidos solo KG como para pedidos mixtos

### Botón "Re-imprimir Comanda" (pedido ya en kilaje)
- **Visibilidad**: Visible solamente cuando el pedido ya esta en kilaje
- **Comportamiento**: Abre modal para agregar nota de seguridad, imprime la comanda con DUPLICADO

### BOTON "ADICION Y COBRAR" (NUEVO) 
- **Visibilidad**: Visible solamente cuando el pedido ya esta en kilaje y detecta una adicion a el pedido 
- **Comportamiento**: Imprime comanda hibrida, detectando el agregado

### BOTON "CANCELAR PEDIDO"
- **Visibilidad**: Visible solo con pedidos cargados en la lista. en TODOS sus estados, hasta los completados y pagados
- **Comportamiento**: Elimina de la db el pedido y devuelve la plata para que el cierre de caja de correcto. 
---

## Próximos Pasos

- [ ] Validar con impresora física
- [ ] Ajustar tiempos de pausa entre impresiones si es necesario
- [ ] Agregar configuración de estaciones por producto desde el panel de administración
