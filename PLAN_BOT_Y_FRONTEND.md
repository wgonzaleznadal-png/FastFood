# Plan: Bot WhatsApp + Frontend 2026

## Filosofía

**El bot de WhatsApp es solo el canal de entrada.** Operadores cargan datos por ahí. El valor real está en el **panel de control**: simple, completo, para que profesionales saquen el 120%.

---

## 1. Bot WhatsApp (paso a paso)

### Principios
- **No es "inteligente"** en el sentido de IA compleja
- **Es un bot de formularios por pasos**: pregunta → extrae → confirma → "¿Cargamos?" → sí → endpoint → DB
- **Inteligente** solo en: entender formatos (teléfono, montos, etc.)

### Módulos del bot

| Módulo | Flujo | Endpoint |
|--------|-------|----------|
| **Pedidos** | Menú → items → nombre → retiro/delivery → pago → confirmar | `confirmWaOrder` |
| **Finanzas** | "Cargame X en Y" → confirmar | `createWaExpense` |
| **Calendario** | (futuro) Fecha → hora → evento → confirmar | `createWaEvent` |
| **Nutrición** | (futuro) Rutina: hora/tipo/repetir → confirmar | `createWaRoutine` |

### Reglas del bot
- Nunca rechazar por número de teléfono
- Nunca decir "no estás registrado" ni "no pude identificar tu número"
- Responder a todos los usuarios

---

## 2. Frontend (panel de control)

### Calendario
- **Estilo Google Calendar**
- Vistas: día / semana / mes
- Filtros: fechas, días, horas
- Igual que calendarios de celulares

### Finanzas
- **Hoja de cálculo** (scroll horizontal)
- Scroll de "contextos" (períodos, categorías)
- **Gráficos** (ventas, gastos, tendencias)

### Nutrición
- **Rutinas**: crear planes con hora/tipo/repetir
- **Tipo**: select (creatina, suplemento, comida, etc.)
- **Repetir**: todos los días / martes / lunes / varios días (multi-select)
- **Planes alimenticios** completos

### UI/UX 2026
- Aire moderno (no Windows XP)
- Layout centrado (no todo tirado a la izquierda)
- Más amor a la UI

---

## 3. Próximos pasos

### Inmediato (hecho)
- [x] Bot: no rechazar por número
- [x] Bot: tool `createWaExpense` para gastos
- [x] Normalización de teléfonos argentinos

### Corto plazo
- [ ] Calendario: vista tipo Google Calendar
- [ ] Finanzas: hoja de cálculo + gráficos
- [ ] Nutrición: rutinas (hora/tipo/repetir)
- [ ] Bot: tool para calendario
- [ ] Bot: tool para nutrición

### UI
- [ ] Rediseño frontend 2026
- [ ] Layout centrado
- [ ] Componentes modernos
