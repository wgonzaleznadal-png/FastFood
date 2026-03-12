# Changelog - Sistema de Doble Comanda

## Fecha: 06/03/2026

### ✅ Cambios Implementados

---

## 1. UI/UX Improvements

### Botón "Ticket Cliente" - Reubicado
- **Antes**: Ubicado debajo del botón "Re-imprimir Comanda"
- **Ahora**: Ubicado al lado de los botones Retiro/Delivery (esquina superior derecha)
- **Visibilidad**: Solo visible cuando `isSentToKitchen = true`
- **Beneficio**: Ahorra espacio y mejora la organización visual

### Botón "Cerrar formulario" - Eliminado
- **Razón**: Redundante con la X del header
- **Beneficio**: Ahorra espacio en la interfaz

---

## 2. Lógica de Impresión Corregida

### PEDIDOS RETIRO - NUEVO

#### Botón "CARGAR"
```javascript
isSentToKitchen: false
Impresión: Solo comanda cocina (si hay items de carta)
```

#### Botón "CARGAR Y COBRAR"
```javascript
isSentToKitchen: false
Impresión: Solo comanda cocina (si hay items de carta)
Acción: Abre drawer de cobro
```

#### Botón "KILAJE Y COBRAR"
```javascript
isSentToKitchen: false
Impresión: Comanda cocina + Comanda completa
Acción: Abre drawer de cobro
```

---

### PEDIDOS RETIRO - CARGADO (en tabla general)

#### Botón "COBRAR"
```javascript
Impresión: Ninguna
Acción: Solo abre drawer de cobro
Estado: Pedido queda PENDING
```

#### Botón "KILAJE Y COBRAR"
```javascript
isSentToKitchen: true
Impresión: Comanda completa
Acción: Abre drawer de cobro
Estado: Pedido pasa a ENTREGADO
```

#### Botón "RE-IMPRIMIR COMANDA"
```javascript
Impresión: Comanda completa con marca RE-IMPRESIÓN
Acción: Solicita justificación
Estado: Registra motivo en notas
```

---

### PEDIDOS DELIVERY

#### Botón "CARGAR"
```javascript
Impresión: Comanda cocina (si hay items carta) + Comanda delivery
```

#### Botón "CARGAR Y COBRAR"
```javascript
Impresión: Comanda cocina (si hay items carta) + Comanda delivery
Acción: Abre drawer de cobro
```

---

## 3. Correcciones de Bugs

### Bug #1: Pedidos solo KG sin botón "Kilaje y Cobrar"
- **Problema**: Al cargar un pedido solo con productos KG, el botón desaparecía
- **Causa**: Lógica incorrecta en la visibilidad del botón
- **Solución**: Botón siempre visible para pedidos PENDING que no están en kilaje

### Bug #2: Pedidos marcados incorrectamente como "en kilaje"
- **Problema**: Pedidos se marcaban como `isSentToKitchen = true` al usar "Cargar"
- **Causa**: Backend recibía `isSentToKitchen: true` en todos los casos
- **Solución**: Cambiar a `isSentToKitchen: false` para botones "Cargar" y "Cargar y Cobrar"

### Bug #3: Impresión incorrecta en pedidos DELIVERY
- **Problema**: No se imprimía la comanda completa en delivery
- **Solución**: Implementar lógica específica para delivery que siempre imprime ambas comandas

---

## 4. Archivos Modificados

### Frontend
- `frontend/src/components/caja/KgOrdersModule.tsx`
  - Reubicación de botón "Ticket Cliente"
  - Eliminación de botón "Cerrar formulario"
  - Corrección de lógica de impresión en `handleSubmit()`
  - Corrección de visibilidad de botones en modo edición
  - Cambio de `isSentToKitchen: true` → `isSentToKitchen: false` en nuevos pedidos

- `frontend/src/lib/thermalPrinter.ts`
  - Soporte para comandas simples y completas
  - Manejo correcto de productos KG y UNIT

- `frontend/src/components/caja/ThermalPrint.tsx`
  - Filtrado correcto de items por estación
  - Lógica de impresión secuencial

### Documentación
- `SISTEMA_DOBLE_COMANDA.md` - Creado
- `CHANGELOG_DOBLE_COMANDA.md` - Creado

---

## 5. Testing Requerido

### Caso 1: Pedido solo KG
```
Items: 1kg Arroz
Acción: "Cargar"
Esperado: No imprime nada, pedido en tabla general
Verificar: Botón "Kilaje y Cobrar" visible
```

### Caso 2: Pedido solo CARTA
```
Items: 1 Rabas
Acción: "Cargar"
Esperado: Imprime comanda simple a COCINA
```

### Caso 3: Pedido mixto - Cargar
```
Items: 1 Rabas + 1kg Arroz
Acción: "Cargar"
Esperado: Imprime comanda simple a COCINA (solo Rabas)
```

### Caso 4: Pedido mixto - Kilaje y Cobrar
```
Items: 1 Rabas + 1kg Arroz
Acción: "Kilaje y Cobrar"
Esperado: 
  - Imprime comanda simple a COCINA (solo Rabas)
  - Imprime comanda completa (todo el pedido)
  - Abre drawer de cobro
```

### Caso 5: Pedido cargado - Kilaje y Cobrar
```
Estado: Pedido PENDING en tabla
Acción: Click en pedido → "Kilaje y Cobrar"
Esperado:
  - Imprime comanda completa
  - Abre drawer de cobro
  - Pedido pasa a isSentToKitchen = true
```

### Caso 6: Pedido DELIVERY
```
Items: 1 Rabas + 1kg Arroz
Tipo: Delivery
Acción: "Cargar"
Esperado:
  - Imprime comanda simple a COCINA (solo Rabas)
  - Imprime comanda completa (delivery)
```

---

## 6. Notas Importantes

1. **Productos KG nunca van a cocina/barra**: Solo se imprimen en la comanda completa
2. **Comanda simple solo para productos UNIT**: Rabas, bebidas, etc.
3. **Doble comanda automática**: Sistema detecta automáticamente cuándo imprimir qué
4. **Re-impresión con auditoría**: Siempre requiere justificación que queda registrada
5. **Delivery siempre imprime todo**: Para que el cadete tenga toda la información

---

## 7. Estado del Sistema

✅ Backend compilando sin errores
✅ Frontend compilando sin errores
✅ Lógica de impresión implementada
✅ UI ajustada según especificaciones
✅ Documentación actualizada

**Próximo paso**: Testing con impresora física
