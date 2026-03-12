# Documentación Técnica — Módulo WhatsApp CRM

## Índice
1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Base de Datos (Prisma)](#base-de-datos-prisma)
4. [Backend](#backend)
5. [Frontend](#frontend)
6. [Flujos de Trabajo](#flujos-de-trabajo)
7. [Seguridad y Permisos](#seguridad-y-permisos)
8. [Variables de Entorno](#variables-de-entorno)

---

## Visión General

El módulo WhatsApp CRM de GastroDash 2.0 es un **telefonista virtual inteligente** que permite a negocios gastronómicos:

- **Conectar WhatsApp Business** mediante QR o Pairing Code (sin API oficial de Meta)
- **Automatizar ventas** con IA (OpenAI GPT-4o-mini) cuando hay turno abierto
- **Gestionar conversaciones** desde un CRM web en tiempo real
- **Crear pedidos automáticamente** desde WhatsApp que se integran al sistema de caja
- **Handoff humano-bot**: el operador puede tomar control manual y reactivar el bot cuando desee

### Tecnologías Clave
- **Baileys** (@whiskeysockets/baileys) — Cliente WhatsApp Web no oficial
- **OpenAI API** (gpt-4o-mini) — Motor de IA conversacional con function calling
- **Prisma** — ORM para persistencia de sesiones y estado de chats
- **React + Mantine UI** — Interfaz CRM de 3 columnas
- **QRCode** (react-qr-code) — Generación de QR para conexión

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WhatsAppCommandCenter.tsx (CRM UI)                      │   │
│  │  - Lista de chats (polling cada 5s)                      │   │
│  │  - Viewport de conversación                              │   │
│  │  - Sidebar de pedidos WhatsApp                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ REST API
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  whatsapp.router.ts (REST endpoints)                     │   │
│  │  whatsapp.service.ts (Baileys connection manager)        │   │
│  │  whatsapp.ai.ts (OpenAI handler + tools)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              ↕                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Baileys WASocket (in-memory, per tenant)                │   │
│  │  - QR Code generation                                    │   │
│  │  - Message events (messages.upsert)                      │   │
│  │  - Connection state management                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Prisma)                           │
│  - WaSessionState (estado de chats)                             │
│  - KgOrder (pedidos con source: WHATSAPP)                       │
│  - Shift (turno activo = bot en modo venta)                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    OpenAI API (gpt-4o-mini)                      │
│  - Prompt dinámico según estado del turno                       │
│  - Function calling: checkAvailability, confirmWaOrder          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Base de Datos (Prisma)

### Modelo `WaSessionState`

Almacena el estado de cada conversación de WhatsApp por tenant.

```prisma
model WaSessionState {
  id                String      @id @default(cuid())
  tenantId          String
  jid               String      // WhatsApp JID (ej: 5491112345678@s.whatsapp.net)
  customerName      String?     // Nombre del cliente (pushName)
  chatState         WaChatState @default(TALKING)
  isPaused          Boolean     @default(false)  // true = humano tomó control
  lastMessage       String?     // Último mensaje (truncado a 200 chars)
  lastInteractionAt DateTime    @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, jid])
  @@map("wa_session_states")
}
```

### Enum `WaChatState`

```prisma
enum WaChatState {
  TALKING    // Conversación activa
  PENDING    // Producto no encontrado, requiere atención humana
  COMPLETED  // Pedido creado exitosamente
  NO_REPLY   // Cliente no respondió en 10+ minutos
}
```

### Enum `OrderSource`

```prisma
enum OrderSource {
  LOCAL      // Pedido creado desde el frontend
  WHATSAPP   // Pedido creado por el bot de WhatsApp
}
```

### Extensión del modelo `KgOrder`

Se agregaron dos campos para integración con WhatsApp:

```prisma
model KgOrder {
  // ... campos existentes ...
  
  source      OrderSource @default(LOCAL)
  waJid       String?     // JID del cliente si source = WHATSAPP
  
  // ...
}
```

---

## Backend

### Estructura de Archivos

```
backend/src/modules/whatsapp/
├── whatsapp.router.ts    # REST API endpoints
├── whatsapp.service.ts   # Baileys connection manager
├── whatsapp.ai.ts        # OpenAI handler + function calling
└── whatsapp.schema.ts    # Zod validation schemas
```

---

### `whatsapp.router.ts`

**Endpoints REST:**

#### `POST /api/whatsapp/connect`
- **Roles:** OWNER, MANAGER, CASHIER
- **Descripción:** Inicia la conexión de WhatsApp para el tenant
- **Respuesta:** `{ status: "connecting" | "open", qr?: string, pairingCode?: string }`
- **Nota:** La conexión es **no bloqueante**. El frontend debe hacer polling a `/status` para obtener el QR.

#### `POST /api/whatsapp/disconnect`
- **Roles:** OWNER, MANAGER
- **Descripción:** Desconecta WhatsApp y limpia la sesión del tenant
- **Respuesta:** `{ status: "disconnected" }`

#### `GET /api/whatsapp/status`
- **Roles:** Todos (autenticados)
- **Descripción:** Obtiene el estado actual de la conexión
- **Respuesta:** `{ status: "disconnected" | "connecting" | "open", qr?: string, pairingCode?: string }`

#### `GET /api/whatsapp/sessions`
- **Roles:** Todos (autenticados)
- **Descripción:** Lista todas las sesiones de chat del tenant
- **Respuesta:** Array de `WaSessionState`

#### `GET /api/whatsapp/sessions/:jid`
- **Roles:** Todos (autenticados)
- **Descripción:** Obtiene una sesión específica por JID
- **Respuesta:** `WaSessionState` o 404

#### `PATCH /api/whatsapp/sessions`
- **Roles:** Todos (autenticados)
- **Body:** `{ jid: string, isPaused?: boolean, chatState?: WaChatState }`
- **Descripción:** Actualiza el estado de una sesión (pausar/reanudar bot, cambiar estado)

#### `POST /api/whatsapp/send`
- **Roles:** Todos (autenticados)
- **Body:** `{ jid: string, text: string }`
- **Descripción:** Envía un mensaje desde el CRM. **Auto-pausa el bot** para que el humano tome control.

#### `POST /api/whatsapp/reactivate`
- **Roles:** Todos (autenticados)
- **Body:** `{ jid: string }`
- **Descripción:** Reactiva el bot (isPaused = false)

#### `GET /api/whatsapp/orders/:shiftId`
- **Roles:** Todos (autenticados)
- **Descripción:** Lista pedidos de WhatsApp del turno especificado (source = WHATSAPP)

#### `POST /api/whatsapp/check-no-reply`
- **Roles:** OWNER, MANAGER
- **Descripción:** Marca como NO_REPLY las sesiones sin actividad en 10+ minutos (puede ejecutarse manualmente o vía cron)

---

### `whatsapp.service.ts`

**Responsabilidades:**
- Gestión del ciclo de vida de conexiones Baileys (una por tenant)
- Almacenamiento de credenciales en `.wa-auth/{tenantId}/`
- Generación de QR y Pairing Codes
- Manejo de eventos de mensajes (`messages.upsert`)
- Reconexión automática con límite de reintentos (MAX_RETRIES = 5)

**Stores en Memoria:**
```typescript
const sockets = new Map<string, WASocket>();
const qrCodes = new Map<string, string>();
const pairingCodes = new Map<string, string>();
const connectionStates = new Map<string, "disconnected" | "connecting" | "open">();
const retryCounters = new Map<string, number>();
```

**Funciones Principales:**

#### `connectWhatsApp(tenantId: string, phoneNumber?: string)`
- Inicia la conexión de forma **no bloqueante**
- Si ya existe un socket, devuelve el estado actual
- Lanza `_startSocket()` en background
- Retorna inmediatamente con `{ status: "connecting" }`

#### `_startSocket(tenantId: string, phoneNumber?: string)`
- Crea el socket de Baileys con `makeWASocket()`
- Configura autenticación multi-archivo (`useMultiFileAuthState`)
- Si se provee `phoneNumber`, genera pairing code en lugar de QR
- Escucha eventos:
  - `connection.update`: maneja QR, conexión abierta, desconexión, reconexión
  - `creds.update`: guarda credenciales
  - `messages.upsert`: procesa mensajes entrantes

#### `handleOperatorMessage(tenantId: string, jid: string, text: string)`
- Detecta mensajes enviados **desde el teléfono del negocio** (key.fromMe = true)
- Si el mensaje es "asistente" → reactiva el bot (isPaused = false)
- Cualquier otro mensaje → pausa el bot (isPaused = true)

#### `sendMessage(tenantId: string, jid: string, text: string)`
- Envía un mensaje de texto al cliente
- Actualiza `lastMessage` y `lastInteractionAt` en la DB

#### `extractText(message: WAMessageContent)`
- Extrae texto de mensajes de WhatsApp
- Soporta: `conversation`, `extendedTextMessage.text`
- Retorna `null` para mensajes no textuales (audio, imagen, sticker, etc.)

#### Lógica de Mensajes Entrantes

```typescript
sock.ev.on("messages.upsert", async ({ messages, type }) => {
  if (type !== "notify") return;
  
  for (const msg of messages) {
    const jid = msg.key.remoteJid;
    
    // Filtrar grupos y status
    if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;
    
    // Mensajes del operador (fromMe)
    if (msg.key.fromMe) {
      await handleOperatorMessage(tenantId, jid, text);
      continue;
    }
    
    const text = extractText(msg.message);
    
    // Rechazar mensajes no textuales
    if (!text) {
      await sendMessage(tenantId, jid, "Solo puedo leer mensajes de texto...");
      continue;
    }
    
    // Upsert sesión en DB
    const session = await prisma.waSessionState.upsert({
      where: { tenantId_jid: { tenantId, jid } },
      update: { lastMessage: text, lastInteractionAt: new Date(), chatState: "TALKING" },
      create: { tenantId, jid, customerName: pushName, lastMessage: text },
    });
    
    // Si el bot está pausado, no procesar con IA
    if (session.isPaused) continue;
    
    // Procesar con IA
    const aiResponse = await handleIncomingMessage(tenantId, jid, text, pushName);
    if (aiResponse) await sendMessage(tenantId, jid, aiResponse);
  }
});
```

---

### `whatsapp.ai.ts`

**Responsabilidades:**
- Integración con OpenAI API (gpt-4o-mini)
- Gestión de historial de conversación en memoria (MAX_HISTORY = 20 mensajes)
- Definición de tools (function calling)
- Ejecución de tools y creación de pedidos

**Historial de Conversación:**
```typescript
const conversationHistory = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();
```

**Prompt Dinámico:**

El sistema prompt cambia según el estado del turno:

```typescript
const openShift = await prisma.shift.findFirst({
  where: { tenantId, status: "OPEN" },
});

const isOpen = !!openShift;

const systemPrompt = isOpen
  ? `Sos el asistente virtual de un local gastronómico. Estás en MODO VENTA.
     Vendemos comida por kilo. Regla: se calcula aprox 0.5kg por persona.
     Hablá en argentino, amable y directo. Precios con $.
     Usá las herramientas (tools) para consultar stock y confirmar pedidos.
     Si el cliente pide algo que no hay, ofrecé alternativas.
     Cuando el cliente confirme el pedido completo, usá confirmWaOrder.`
  : `Sos el asistente virtual de un local gastronómico. Estás en MODO INFORMATIVO.
     La caja está cerrada. NO podés vender ni tomar pedidos.
     Si piden comida, pedí disculpas, informá que estamos cerrados.`;
```

**Tools (Function Calling):**

#### Tool: `checkAvailability`
```typescript
{
  name: "checkAvailability",
  description: "Busca productos disponibles por nombre. Devuelve lista de productos con precio por kg.",
  parameters: {
    productName: { type: "string" }
  }
}
```

**Ejecución:**
- Busca productos con `soldByKg: true`, `isAvailable: true`, nombre coincidente
- Si no encuentra, devuelve lista completa de productos disponibles
- Si no encuentra ningún producto, marca el chat como `PENDING`

#### Tool: `confirmWaOrder`
```typescript
{
  name: "confirmWaOrder",
  description: "Confirma y crea un pedido de WhatsApp. Se usa cuando el cliente confirmó todos los detalles.",
  parameters: {
    items: Array<{ productId: string, weightKg: number }>,
    customerName: string,
    isDelivery: boolean,
    deliveryAddress?: string,
    deliveryPhone?: string,
    paymentMethod?: "EFECTIVO" | "MERCADO PAGO"
  }
}
```

**Ejecución:**
1. Valida que haya un turno abierto
2. Valida que todos los productos existan y estén disponibles
3. Calcula subtotales y total
4. Obtiene el siguiente `orderNumber` del turno
5. Crea el `KgOrder` con `source: "WHATSAPP"` y `waJid`
6. Marca el chat como `COMPLETED`
7. Retorna confirmación con número de pedido y total

**Flujo de Llamadas a OpenAI:**

```typescript
// Primera llamada con tools
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [systemPrompt, ...history],
  tools: isOpen ? tools : undefined,
  tool_choice: isOpen ? "auto" : undefined,
});

// Si hay tool_calls, ejecutar y hacer segunda llamada
if (response.choices[0].message.tool_calls) {
  const toolResults = await executeTools(tool_calls);
  
  const followUp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...messages, assistantMsg, ...toolResults],
  });
  
  return followUp.choices[0].message.content;
}
```

---

### `whatsapp.schema.ts`

Validación con Zod:

```typescript
export const sendMessageSchema = z.object({
  jid: z.string().min(1),
  text: z.string().min(1),
});

export const updateSessionSchema = z.object({
  jid: z.string().min(1),
  isPaused: z.boolean().optional(),
  chatState: z.enum(["TALKING", "PENDING", "COMPLETED", "NO_REPLY"]).optional(),
});
```

---

## Frontend

### Estructura de Archivos

```
frontend/src/components/caja/
├── WhatsAppCommandCenter.tsx         # CRM principal (3 columnas)
├── WhatsAppCommandCenter.module.css  # Estilos del CRM
└── WhatsAppConfigDrawer.tsx          # Drawer de ayuda/configuración
```

---

### `WhatsAppCommandCenter.tsx`

**Componente principal del CRM con 3 columnas:**

1. **Columna Izquierda: Lista de Chats**
   - Muestra todas las sesiones (`WaSessionState`)
   - Avatar con iniciales del cliente
   - Preview del último mensaje
   - Timestamp
   - Pill de estado (TALKING, PENDING, COMPLETED, NO_REPLY, PAUSED)

2. **Columna Central: Viewport de Conversación**
   - Header con info del cliente y badges de estado
   - Área de mensajes (actualmente muestra solo `lastMessage` + mensaje del sistema)
   - Input para enviar mensajes (auto-pausa el bot)
   - Botones: Reactivar bot, Desconectar, Configuración

3. **Columna Derecha: Sidebar de Pedidos**
   - Lista de pedidos de WhatsApp del turno actual
   - Muestra: número, cliente, items, total, método de pago
   - Badges: Envío/Retiro, Estado (PENDING/PAID)

**Polling Adaptativo:**

```typescript
useEffect(() => {
  if (connStatus === "open") {
    // Conectado: poll cada 5s
    fetchSessions();
    fetchOrders();
    pollRef.current = setInterval(() => {
      fetchSessions();
      fetchOrders();
      fetchStatus();
    }, 5000);
  } else if (connStatus === "connecting") {
    // Esperando QR: poll rápido cada 2s
    pollRef.current = setInterval(() => {
      fetchStatus();
    }, 2000);
  } else {
    // Desconectado: poll lento cada 15s
    pollRef.current = setInterval(() => {
      fetchStatus();
    }, 15000);
  }
}, [connStatus]);
```

**Estados de Conexión:**

- `disconnected`: Muestra banner con botón "Conectar WhatsApp"
- `connecting`: Muestra QR Code (si está disponible) y botón "Esperando escaneo..."
- `open`: Muestra el CRM completo de 3 columnas

**Colores de Estado:**

```typescript
const STATE_COLORS = {
  TALKING: "cyan",      // 🔵 Conversando
  PENDING: "yellow",    // 🟡 Pendiente
  COMPLETED: "green",   // 🟢 Completado
  NO_REPLY: "red",      // 🔴 Sin respuesta
};
```

**Handoff Humano-Bot:**

- Cuando el operador envía un mensaje desde el CRM → `isPaused = true` automáticamente
- Botón "Reactivar bot" (▶) → `isPaused = false`
- Desde el celular del negocio: escribir "asistente" → reactiva el bot

---

### `WhatsAppCommandCenter.module.css`

**Layout de 3 Columnas:**

```css
.container {
  display: grid;
  grid-template-columns: 22% 53% 25%;
  gap: 0;
  height: calc(100vh - 200px);
  min-height: 500px;
  border: 1px solid var(--gd-border);
  border-radius: var(--gd-radius-lg);
  overflow: hidden;
}
```

**Pills de Estado:**

```css
.stateTalking   { background: #22d3ee; } /* Celeste */
.statePending   { background: #f59e0b; } /* Amarillo */
.stateCompleted { background: #22c55e; } /* Verde */
.stateNoReply   { background: #ef4444; } /* Rojo */

.statePaused {
  background: #9ca3af;
  position: relative;
}

.statePaused::after {
  content: "";
  position: absolute;
  top: 50%;
  left: -1px;
  right: -1px;
  height: 2px;
  background: #6b7280;
  transform: rotate(-45deg);
}
```

**Responsive:**

```css
@media (max-width: 1024px) {
  .container {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  
  .ordersSidebar {
    display: none;
  }
}
```

---

### `WhatsAppConfigDrawer.tsx`

Drawer informativo que explica:
- Funcionamiento del bot (modo venta vs informativo)
- Handoff humano-bot
- Estados de chat
- Comando "asistente" para reactivar desde el celular

---

### Integración en `KgOrdersModule.tsx`

El módulo de WhatsApp se integra como una **pestaña** dentro del módulo de Pedidos x KG:

```tsx
<Tabs defaultValue="general">
  <Tabs.List>
    <Tabs.Tab value="general">Lista General</Tabs.Tab>
    <Tabs.Tab value="delivery">Delivery</Tabs.Tab>
    <Tabs.Tab value="whatsapp" leftSection={<IconBrandWhatsapp size={16} />}>
      WhatsApp
    </Tabs.Tab>
  </Tabs.List>
  
  <Tabs.Panel value="general">
    {/* Lista de pedidos general */}
  </Tabs.Panel>
  
  <Tabs.Panel value="delivery">
    <DeliveryCommandCenter shiftId={shiftId} />
  </Tabs.Panel>
  
  <Tabs.Panel value="whatsapp">
    <WhatsAppCommandCenter shiftId={shiftId} />
  </Tabs.Panel>
</Tabs>
```

---

## Flujos de Trabajo

### 1. Conexión Inicial de WhatsApp

```
Usuario → Click "Conectar WhatsApp"
  ↓
Frontend → POST /api/whatsapp/connect
  ↓
Backend → _startSocket() (no bloqueante)
  ↓
Backend → Genera QR Code
  ↓
Frontend → Polling GET /api/whatsapp/status cada 2s
  ↓
Frontend → Muestra QR Code
  ↓
Usuario → Escanea QR desde WhatsApp del celular
  ↓
Baileys → connection.update: "open"
  ↓
Frontend → Detecta status "open" → Muestra CRM
```

---

### 2. Cliente Envía Mensaje (Turno Abierto)

```
Cliente → Envía mensaje de WhatsApp
  ↓
Baileys → messages.upsert event
  ↓
whatsapp.service.ts → extractText()
  ↓
whatsapp.service.ts → Upsert WaSessionState en DB
  ↓
whatsapp.service.ts → Verifica isPaused
  ↓ (si NO está pausado)
whatsapp.ai.ts → handleIncomingMessage()
  ↓
OpenAI → Genera respuesta con tools
  ↓ (si usa checkAvailability)
whatsapp.ai.ts → Busca productos en DB
  ↓
OpenAI → Segunda llamada con tool results
  ↓
whatsapp.service.ts → sendMessage() al cliente
  ↓
Cliente → Recibe respuesta del bot
```

---

### 3. Cliente Confirma Pedido

```
Cliente → "Confirmo el pedido"
  ↓
OpenAI → Detecta intención de confirmar
  ↓
OpenAI → Llama tool confirmWaOrder con items
  ↓
whatsapp.ai.ts → executeConfirmWaOrder()
  ↓
Prisma → Crea KgOrder con source: "WHATSAPP", waJid
  ↓
Prisma → Actualiza WaSessionState.chatState = "COMPLETED"
  ↓
OpenAI → Genera mensaje de confirmación
  ↓
Cliente → Recibe "Tu pedido #123 fue confirmado. Total: $X"
  ↓
Frontend → Polling detecta nuevo pedido en sidebar
```

---

### 4. Operador Toma Control Manual

```
Operador → Selecciona chat en CRM
  ↓
Operador → Escribe mensaje y presiona Enter
  ↓
Frontend → POST /api/whatsapp/send { jid, text }
  ↓
Backend → sendMessage()
  ↓
Backend → updateSessionState({ isPaused: true })
  ↓
Cliente → Recibe mensaje del operador
  ↓
Cliente → Responde
  ↓
Baileys → messages.upsert
  ↓
whatsapp.service.ts → Detecta isPaused = true
  ↓
whatsapp.service.ts → NO llama a IA, solo guarda en DB
  ↓
Frontend → Polling muestra badge "Bot pausado"
```

---

### 5. Reactivar Bot

**Opción A: Desde el CRM**
```
Operador → Click botón "▶ Reactivar bot"
  ↓
Frontend → POST /api/whatsapp/reactivate { jid }
  ↓
Backend → updateSessionState({ isPaused: false })
  ↓
Frontend → Badge cambia a "Bot activo"
```

**Opción B: Desde el Celular del Negocio**
```
Operador → Escribe "asistente" desde WhatsApp del celular
  ↓
Baileys → messages.upsert (key.fromMe = true)
  ↓
whatsapp.service.ts → handleOperatorMessage()
  ↓
Backend → Detecta texto = "asistente"
  ↓
Backend → updateSessionState({ isPaused: false })
  ↓
Bot → Vuelve a responder automáticamente
```

---

### 6. Cliente No Responde (NO_REPLY)

```
Cron Job / Manual → POST /api/whatsapp/check-no-reply
  ↓
Backend → checkNoReplySessions()
  ↓
Prisma → Busca sesiones con:
  - chatState = "TALKING"
  - isPaused = false
  - lastInteractionAt < 10 minutos atrás
  ↓
Prisma → UPDATE chatState = "NO_REPLY"
  ↓
Frontend → Polling detecta cambio
  ↓
Frontend → Muestra pill rojo 🔴
```

---

## Seguridad y Permisos

### Middleware de Seguridad

Todos los endpoints de WhatsApp están protegidos por:

```typescript
router.use(authenticate);           // JWT validation
router.use(requireModule("caja"));  // Requiere acceso al módulo "caja"
```

### Roles por Endpoint

| Endpoint | OWNER | MANAGER | CASHIER | COOK | STAFF |
|----------|-------|---------|---------|------|-------|
| POST /connect | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /disconnect | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /status | ✅ | ✅ | ✅ | ❌ | ❌ |
| GET /sessions | ✅ | ✅ | ✅ | ❌ | ❌ |
| PATCH /sessions | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /send | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /reactivate | ✅ | ✅ | ✅ | ❌ | ❌ |
| GET /orders/:shiftId | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /check-no-reply | ✅ | ✅ | ❌ | ❌ | ❌ |

### Aislamiento Multi-Tenant

- Cada tenant tiene su propia conexión de WhatsApp (socket en memoria)
- Las credenciales se almacenan en `.wa-auth/{tenantId}/`
- Todas las queries a DB incluyen `tenantId` en el WHERE
- El middleware `authenticate` inyecta `req.auth.tenantId` desde el JWT

### Registro del Módulo

El módulo WhatsApp está registrado en `backend/src/lib/modules.ts`:

```typescript
{
  key: "caja",
  label: "Gestión de Caja",
  submodules: [
    { key: "caja.turnos", label: "Turnos" },
    { key: "caja.pedidos_kg", label: "Pedidos x KG" },
    { key: "caja.whatsapp", label: "WhatsApp CRM" },  // ← Aquí
  ],
}
```

**Roles por defecto:**
```typescript
"caja.whatsapp": ["OWNER", "MANAGER", "CASHIER"]
```

---

## Variables de Entorno

### Backend (`.env`)

```bash
# ─── OpenAI (REQUERIDO para el bot) ───
OPENAI_API_KEY=sk-proj-...

# ─── Otros (ya existentes) ───
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**IMPORTANTE:** Sin `OPENAI_API_KEY`, el módulo de WhatsApp lanzará error al intentar procesar mensajes.

---

## Dependencias

### Backend

```json
{
  "@whiskeysockets/baileys": "^6.7.9",
  "@hapi/boom": "^10.0.1",
  "openai": "^4.73.0"
}
```

### Frontend

```json
{
  "react-qr-code": "^2.0.15"
}
```

---

## Notas Técnicas

### Limitaciones Actuales

1. **Historial de Mensajes:** El CRM solo muestra el `lastMessage` de cada sesión. Para ver el historial completo, el operador debe revisar WhatsApp en el celular.

2. **Mensajes No Textuales:** El bot rechaza audios, imágenes, stickers, etc. con un mensaje amable pidiendo que escriban texto.

3. **Reconexión:** Si la conexión se pierde, el sistema reintenta hasta 5 veces con backoff exponencial. Después de 5 fallos, limpia la sesión y el usuario debe reconectar manualmente.

4. **Persistencia de Historial:** El historial de conversación con OpenAI se mantiene en memoria (Map). Si el servidor se reinicia, se pierde el contexto. Las sesiones en DB persisten.

5. **QR Expiration:** Los QR Codes de WhatsApp expiran después de ~2 minutos. Si el usuario no escanea a tiempo, debe hacer click en "Conectar WhatsApp" nuevamente.

### Mejores Prácticas

1. **Turno Abierto = Bot Activo:** El bot solo puede vender cuando hay un turno abierto. Esto evita tomar pedidos fuera del horario de atención.

2. **Handoff Explícito:** Cuando un operador envía un mensaje desde el CRM, el bot se pausa automáticamente. Esto evita respuestas duplicadas o confusas.

3. **Estados de Chat:** Los estados (TALKING, PENDING, COMPLETED, NO_REPLY) permiten al operador priorizar qué chats requieren atención humana.

4. **Polling Adaptativo:** El frontend ajusta la frecuencia de polling según el estado de conexión para optimizar recursos.

5. **Validación de Productos:** Antes de crear un pedido, el bot valida que todos los productos existan y estén disponibles.

---

## Migración de Base de Datos

Para aplicar los cambios de Prisma:

```bash
cd backend
npx prisma migrate dev --name add_whatsapp_crm
```

Esto crea:
- Tabla `wa_session_states`
- Enum `WaChatState`
- Enum `OrderSource`
- Campos `source` y `waJid` en `kg_orders`

---

## Testing Manual

### 1. Conectar WhatsApp
1. Abrir turno de caja
2. Ir a pestaña "WhatsApp"
3. Click "Conectar WhatsApp"
4. Escanear QR desde WhatsApp del celular del negocio
5. Verificar que el status cambie a "open"

### 2. Probar Bot en Modo Venta
1. Desde otro celular, enviar mensaje al WhatsApp del negocio
2. Preguntar por un producto (ej: "Hola, tienen milanesas?")
3. Verificar que el bot responda con precios
4. Confirmar un pedido (ej: "Quiero 2kg de milanesas, retiro en el local, pago efectivo")
5. Verificar que el pedido aparezca en el sidebar del CRM
6. Verificar que el pedido esté en la base de datos con `source: "WHATSAPP"`

### 3. Probar Handoff
1. Desde el CRM, seleccionar un chat
2. Escribir un mensaje y enviarlo
3. Verificar que el badge cambie a "Bot pausado"
4. Responder desde el cliente
5. Verificar que el bot NO responda automáticamente
6. Click en "▶ Reactivar bot"
7. Verificar que el bot vuelva a responder

### 4. Probar Modo Informativo
1. Cerrar el turno de caja
2. Enviar mensaje desde otro celular
3. Verificar que el bot informe que el local está cerrado
4. Verificar que NO pueda crear pedidos

---

## Troubleshooting

### Error: "OPENAI_API_KEY no está configurada"
**Solución:** Agregar `OPENAI_API_KEY=sk-proj-...` al archivo `.env` del backend.

### Error: "WhatsApp no conectado" (503)
**Solución:** Verificar que el status sea "open". Si está "disconnected", hacer click en "Conectar WhatsApp".

### QR Code no aparece
**Solución:** 
1. Verificar que el backend esté corriendo
2. Hacer polling a `/api/whatsapp/status` cada 2s
3. Si después de 30s no aparece, desconectar y reconectar

### Bot no responde a mensajes
**Solución:**
1. Verificar que `isPaused = false` en la sesión
2. Verificar que haya un turno abierto (si se espera modo venta)
3. Revisar logs del backend para errores de OpenAI
4. Verificar que el mensaje sea de texto (no audio/imagen)

### Pedidos no aparecen en el sidebar
**Solución:**
1. Verificar que el `shiftId` sea correcto
2. Verificar que el pedido tenga `source: "WHATSAPP"`
3. Hacer refresh manual con el botón de actualizar

### Conexión se cae constantemente
**Solución:**
1. Verificar conexión a internet del servidor
2. Revisar logs para ver el `DisconnectReason`
3. Si es `loggedOut`, el usuario cerró sesión desde el celular → reconectar
4. Si supera 5 reintentos, limpiar `.wa-auth/{tenantId}/` y reconectar

---

## Roadmap Futuro (No Implementado)

- [ ] Historial completo de mensajes en el CRM (no solo lastMessage)
- [ ] Soporte para mensajes multimedia (imágenes de productos)
- [ ] Webhooks para notificaciones en tiempo real (en lugar de polling)
- [ ] Métricas y analytics (tiempo de respuesta, tasa de conversión, etc.)
- [ ] Templates de mensajes predefinidos para operadores
- [ ] Integración con Google Maps para validar direcciones de delivery
- [ ] Cron job automático para check-no-reply (actualmente manual)
- [ ] Multi-agente: diferentes bots para diferentes líneas de negocio

---

## Conclusión

El módulo WhatsApp CRM de GastroDash 2.0 es una solución completa y funcional que permite a negocios gastronómicos automatizar ventas por WhatsApp sin depender de la API oficial de Meta. La arquitectura es escalable, multi-tenant, y permite un handoff fluido entre bot y humano.

**Características destacadas:**
✅ Conexión simple con QR Code
✅ IA conversacional con OpenAI
✅ Creación automática de pedidos
✅ CRM web en tiempo real
✅ Handoff humano-bot sin fricciones
✅ Aislamiento total entre tenants
✅ Sistema de permisos granular

**Estado actual:** ✅ **PRODUCCIÓN READY**
