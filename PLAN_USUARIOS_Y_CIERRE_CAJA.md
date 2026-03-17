# Plan: Usuarios, Permisos y Cierre de Caja

## ✅ Fase 1: Crear usuarios desde Configuración (IMPLEMENTADO)

### Backend
- **POST /api/config/users** — Crear usuario (nombre, email, contraseña, rol)
- Solo OWNER/MANAGER pueden crear
- Validar email único por tenant

### Frontend
- Formulario "Nuevo usuario" en tab Usuarios
- Campos: nombre, email, contraseña, rol

---

## ✅ Fase 2: Permisos por página y por acción (IMPLEMENTADO)

### Opción A: Roles granulares (recomendada)
- Nuevos roles: `TELEFONISTA`, `ENCARGADO_DELIVERY`
- `TELEFONISTA`: puede cargar pedidos, ver lista, NO asignar cadetes, NO cobrar efectivo delivery
- `ENCARGADO_DELIVERY`: puede asignar cadetes, cobrar efectivos, NO cargar pedidos nuevos

### Opción B: Permisos por acción (más flexible)
- Tabla `UserModulePermission`: userId, moduleKey, actionKey, allowed
- Acciones en Caja: `cargar_pedidos`, `asignar_cadetes`, `cobrar_efectivo`, `cerrar_delivery`, `nuevo_egreso`, `cerrar_caja`
- El frontend consulta `can(userId, 'caja.cobrar_efectivo')`

### Implementación sugerida
- Empezar con **roles granulares** (TELEFONISTA, ENCARGADO_DELIVERY)
- Actualizar `DEFAULT_ROLE_ACCESS` y guards en KgOrdersModule, DeliveryCommandCenter

---

## ✅ Fase 3 (parcial): Cierre de Caja — Mejoras

### 3.1 Denominaciones de billetes (peso argentino) — IMPLEMENTADO
- `$20000`, `$10000`, `$5000`, `$2000`, `$1000`, `$500`, `$200`, `$100`
- Guardar conteo en Shift: `billCounts` (JSON) para auditoría

### 3.2 Cálculo efectivo correcto — IMPLEMENTADO
```
Efectivo en caja = Caja inicial + Ingresos EFECTIVO - Egresos EFECTIVO + Rendición Delivery
```
- Actualmente el summary usa `totalSales` (todos los métodos) — corregir a solo EFECTIVO

### 3.3 Reporte de cierre completo
- Lista de pedidos (con método de pago, monto, cobrado por)
- Re-impresiones (desde Order.notes con `[RE-IMPRESIÓN #N]`)
- Egresos del turno
- Rendición de delivery (si hubo)
- Conteo de billetes
- Diferencia

### 3.4 Impresión / Email / WhatsApp
- Imprimir comanda de cierre (térmica)
- Enviar por email al dueño (owner del tenant)
- Enviar por WhatsApp al dueño (si tiene configurado)

### 3.5 Historial de cierres
- En "Caja Activa" (sistema): lista de cierres del turno actual... no aplica, el turno se cierra.
- En "Caja Activa" (sistema): lista de **turnos cerrados** recientes
- En Finanzas: ya existe consolidador con shifts — ampliar con detalle del cierre

---

## Orden de implementación

1. **Crear usuarios** (POST /api/config/users + UI)
2. **Roles TELEFONISTA, ENCARGADO_DELIVERY** + permisos en módulo Caja
3. **Billetes ARS** + corrección efectivo en caja
4. **Reporte de cierre** + impresión
5. **Historial de cierres** en sistema y finanzas
6. **Email/WhatsApp** al dueño (opcional, depende de integración WA)
