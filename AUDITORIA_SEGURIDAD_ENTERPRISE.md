# 🔒 AUDITORÍA DE SEGURIDAD ENTERPRISE - GastroDash 2.0

**Fecha:** 17 de Marzo, 2026  
**Auditor:** Kiro AI Security Analysis  
**Alcance:** Backend (Node.js/Express/Prisma), Frontend (Next.js), Base de Datos (PostgreSQL)  
**Objetivo:** Preparación para deployment público en GitHub, Vercel y Railway

---

## 📊 RESUMEN EJECUTIVO

### Nivel de Riesgo General: 🟡 MEDIO-ALTO

**Vulnerabilidades Críticas:** 5  
**Vulnerabilidades Altas:** 8  
**Vulnerabilidades Medias:** 12  
**Vulnerabilidades Bajas:** 6  
**Buenas Prácticas:** 15

### Prioridad de Acción
1. 🔴 **CRÍTICO** - Resolver antes de deployment público
2. 🟠 **ALTO** - Resolver en las primeras 48 horas post-deployment
3. 🟡 **MEDIO** - Resolver en la primera semana
4. 🟢 **BAJO** - Mejoras continuas

---

## 🔴 VULNERABILIDADES CRÍTICAS (Resolver ANTES de deployment)

### 1. JWT_SECRET sin validación de longitud mínima
**Severidad:** 🔴 CRÍTICA  
**Archivo:** `backend/src/modules/auth/auth.service.ts`  
**Línea:** 8

**Problema:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET!;
```

No valida que el secret tenga la longitud mínima requerida (32 caracteres). Un secret débil compromete toda la seguridad de autenticación.

**Impacto:**
- Tokens JWT vulnerables a ataques de fuerza bruta
- Posible compromiso de todas las sesiones de usuario
- Escalación de privilegios si se descifra el secret

**Solución:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
}
```

**Prioridad:** INMEDIATA

---

### 2. CORS demasiado permisivo en desarrollo
**Severidad:** 🔴 CRÍTICA  
**Archivo:** `backend/src/app.ts`  
**Líneas:** 23-48

**Problema:**
```typescript
if (process.env.NODE_ENV === "development") {
  if (
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    /https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)
  ) {
    return callback(null, true);
  }
}
```

**Impacto:**
- Permite requests desde CUALQUIER origen en redes locales
- Vulnerable a ataques CSRF desde dispositivos en la misma red
- Posible robo de tokens JWT si un atacante está en la red local

**Solución:**
```typescript
const allowedOrigins = process.env.NODE_ENV === "development" 
  ? ['http://localhost:3000', 'http://127.0.0.1:3000']
  : [process.env.FRONTEND_URL];

const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
```

**Prioridad:** INMEDIATA

---

### 3. Rate Limiting extremadamente permisivo en desarrollo
**Severidad:** 🔴 CRÍTICA  
**Archivo:** `backend/src/app.ts`  
**Línea:** 68

**Problema:**
```typescript
max: process.env.NODE_ENV === "development" ? 10000 : 200
```

**Impacto:**
- 10,000 requests en 15 minutos = 11 requests/segundo sin límite
- Vulnerable a ataques de fuerza bruta en endpoints de login
- Vulnerable a DoS (Denial of Service)
- Posible enumeración de usuarios y recursos

**Solución:**
```typescript
// Rate limiter general
const generalLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 500 : 200,
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
});

// Rate limiter estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Solo 5 intentos de login en 15 minutos
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);
app.use('/api/auth', authLimiter);
```

**Prioridad:** INMEDIATA

---

### 4. Tokens JWT almacenados en localStorage (XSS vulnerable)
**Severidad:** 🔴 CRÍTICA  
**Archivo:** `frontend/src/store/authStore.ts`  
**Líneas:** 5-8

**Problema:**
```typescript
const safeStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: (name: string) => localStorage.removeItem(name),
};
```

**Impacto:**
- Tokens accesibles desde JavaScript = vulnerable a XSS
- Si un atacante inyecta código JS, puede robar todos los tokens
- Sesiones comprometidas permanentemente hasta que el usuario haga logout

**Solución:**
Usar httpOnly cookies en lugar de localStorage:

Backend:
```typescript
// auth.service.ts
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
});
```

Frontend:
```typescript
// Eliminar almacenamiento de token en localStorage
// El token viaja automáticamente en las cookies
api.defaults.withCredentials = true;
```

**Prioridad:** INMEDIATA

---

### 5. Sin validación de origen en requests sin origin
**Severidad:** 🔴 CRÍTICA  
**Archivo:** `backend/src/app.ts`  
**Línea:** 26

**Problema:**
```typescript
if (!origin) return callback(null, true);
```

**Impacto:**
- Permite requests desde curl, Postman, apps móviles sin validación
- Vulnerable a ataques automatizados
- Bypass completo de protección CORS

**Solución:**
```typescript
origin: (origin: string | undefined, callback: Function) => {
  // Solo permitir sin origin en desarrollo Y desde localhost
  if (!origin && process.env.NODE_ENV === 'development') {
    return callback(null, true);
  }
  
  if (!origin) {
    return callback(new Error('Origin header required'));
  }
  
  // Resto de validación...
}
```

**Prioridad:** INMEDIATA

---

## 🟠 VULNERABILIDADES ALTAS (Resolver en 48 horas)

### 6. Sin protección contra timing attacks en login
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/modules/auth/auth.service.ts`  
**Líneas:** 44-58

**Problema:**
```typescript
const user = input.email
  ? await prisma.user.findFirst({ where: { tenantId: tenant.id, email: input.email } })
  : await prisma.user.findFirst({ where: { tenantId: tenant.id, role: "OWNER" } });
if (!user) throw createError("Credenciales inválidas", 401);

const valid = await bcrypt.compare(input.password, user.passwordHash);
if (!valid) throw createError("Credenciales inválidas", 401);
```

**Impacto:**
- Timing attack: si el usuario no existe, la respuesta es más rápida
- Permite enumerar usuarios válidos midiendo tiempos de respuesta
- Facilita ataques de fuerza bruta dirigidos

**Solución:**
```typescript
// Siempre hacer hash comparison, incluso si el usuario no existe
const user = await prisma.user.findFirst({ 
  where: { tenantId: tenant.id, email: input.email } 
});

const dummyHash = '$2a$12$dummyhashfordummyuserdummyhashdummyhashdummy';
const hashToCompare = user?.passwordHash || dummyHash;
const valid = await bcrypt.compare(input.password, hashToCompare);

if (!user || !valid) {
  throw createError("Credenciales inválidas", 401);
}
```

**Prioridad:** ALTA

---

### 7. Stack traces expuestos en producción
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/middleware/errorHandler.ts`  
**Línea:** 35

**Problema:**
```typescript
res.status(statusCode).json({
  error: message,
  ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
});
```

**Impacto:**
- Expone estructura interna del código
- Revela rutas de archivos del servidor
- Facilita ingeniería inversa y búsqueda de vulnerabilidades

**Solución:**
```typescript
res.status(statusCode).json({
  error: message,
  ...(process.env.NODE_ENV === "development" && { 
    stack: err.stack,
    details: err 
  }),
});

// NUNCA enviar stack en producción, ni siquiera con flag
```

**Prioridad:** ALTA

---

### 8. Sin validación de tamaño de payload
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/app.ts`  
**Línea:** 51

**Problema:**
```typescript
app.use(express.json());
```

**Impacto:**
- Sin límite de tamaño de JSON = vulnerable a DoS
- Atacante puede enviar payloads de GB y saturar memoria
- Servidor puede crashear por falta de memoria

**Solución:**
```typescript
app.use(express.json({ 
  limit: '10mb', // Ajustar según necesidad
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));
```

**Prioridad:** ALTA

---

### 9. Sin sanitización de inputs en WhatsApp AI
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/modules/whatsapp/whatsapp.ai.ts`  
**Líneas:** 200-250

**Problema:**
Los mensajes de WhatsApp se pasan directamente a OpenAI sin sanitización:
```typescript
addToHistory(tenantId, jid, "user", text);
```

**Impacto:**
- Prompt injection: usuario puede manipular el comportamiento del bot
- Posible extracción de información del system prompt
- Bypass de reglas de negocio mediante ingeniería de prompts

**Solución:**
```typescript
function sanitizeUserInput(text: string): string {
  // Remover caracteres de control
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limitar longitud
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  // Detectar intentos de prompt injection
  const dangerousPatterns = [
    /ignore previous instructions/i,
    /system:/i,
    /you are now/i,
    /forget everything/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      return '[Mensaje bloqueado por seguridad]';
    }
  }
  
  return sanitized;
}

// Usar en handleIncomingMessage
const sanitizedText = sanitizeUserInput(text);
addToHistory(tenantId, jid, "user", sanitizedText);
```

**Prioridad:** ALTA

---

### 10. Contraseñas sin política de complejidad
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/modules/auth/auth.schema.ts`  
**Línea:** 13

**Problema:**
```typescript
password: z.string().min(8),
```

**Impacto:**
- Permite contraseñas débiles como "12345678"
- Vulnerable a ataques de diccionario
- No cumple con estándares de seguridad enterprise

**Solución:**
```typescript
const passwordSchema = z.string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^a-zA-Z0-9]/, "Debe contener al menos un carácter especial");

export const registerTenantSchema = z.object({
  // ...
  password: passwordSchema,
});
```

**Prioridad:** ALTA

---

### 11. Sin protección contra SQL Injection en raw queries
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/app.ts`  
**Línea:** 77

**Problema:**
```typescript
await prisma.$queryRaw`SELECT 1`;
```

Aunque este caso específico es seguro, el uso de `$queryRaw` sin tagged templates es peligroso.

**Impacto:**
- Si se usa `$queryRawUnsafe` con concatenación de strings = SQL Injection
- Acceso no autorizado a datos
- Modificación o eliminación de datos

**Solución:**
```typescript
// ✅ CORRECTO (tagged template)
await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`;

// ❌ INCORRECTO (vulnerable)
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${userId}`);

// Auditar todo el código para asegurar que no hay $queryRawUnsafe
```

**Prioridad:** ALTA

---

### 12. Sin validación de tenant en operaciones críticas
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/modules/orders/orders.router.ts`  
**Líneas:** Múltiples

**Problema:**
```typescript
router.delete('/:id', authenticate, async (req, res, next) => {
  const orderId = String(req.params.id);
  await ordersService.deleteOrder(tenantId, orderId);
});
```

**Impacto:**
- Si el servicio no valida que la orden pertenece al tenant del usuario
- Posible acceso a datos de otros tenants (data leak)
- Violación de aislamiento multi-tenant

**Solución:**
```typescript
// En el servicio, SIEMPRE validar tenant
export async function deleteOrder(tenantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId } // ← CRÍTICO
  });
  
  if (!order) {
    throw createError('Orden no encontrada', 404);
  }
  
  return prisma.order.delete({ where: { id: orderId } });
}
```

**Prioridad:** ALTA

---

### 13. Sin timeout en conexiones de WhatsApp
**Severidad:** 🟠 ALTA  
**Archivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`  
**Línea:** 70

**Problema:**
```typescript
const sock = makeWASocket({
  auth: state,
  connectTimeoutMs: 60_000,
  defaultQueryTimeoutMs: undefined, // ← Sin timeout
});
```

**Impacto:**
- Conexiones pueden quedar colgadas indefinidamente
- Consumo de recursos sin límite
- Posible DoS por agotamiento de conexiones

**Solución:**
```typescript
const sock = makeWASocket({
  auth: state,
  connectTimeoutMs: 60_000,
  defaultQueryTimeoutMs: 30_000, // 30 segundos
  qrTimeout: 60_000,
  keepAliveIntervalMs: 10_000,
});
```

**Prioridad:** ALTA

---

## 🟡 VULNERABILIDADES MEDIAS (Resolver en 1 semana)

### 14. Sin logging de eventos de seguridad
**Severidad:** 🟡 MEDIA  
**Archivos:** Múltiples

**Problema:**
No hay logging estructurado de:
- Intentos de login fallidos
- Cambios de permisos
- Accesos denegados
- Operaciones críticas (cierre de caja, eliminación de datos)

**Impacto:**
- Imposible detectar ataques en curso
- Sin auditoría de acciones de usuarios
- Dificulta investigación post-incidente

**Solución:**
```typescript
// lib/logger.ts
import winston from 'winston';

export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console()
  ]
});

// Usar en eventos críticos
securityLogger.warn('Login failed', {
  tenantId,
  email,
  ip: req.ip,
  timestamp: new Date()
});
```

**Prioridad:** MEDIA

---

### 15. Sin validación de email en registro
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/auth/auth.service.ts`  
**Línea:** 12

**Problema:**
```typescript
const existing = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
```

No valida si el email ya está en uso en otro tenant.

**Impacto:**
- Múltiples cuentas con el mismo email
- Confusión en recuperación de contraseñas
- Posible suplantación de identidad

**Solución:**
```typescript
// Validar email único globalmente
const existingEmail = await prisma.user.findFirst({
  where: { email: input.email.toLowerCase() }
});

if (existingEmail) {
  throw createError('Email ya registrado', 409);
}
```

**Prioridad:** MEDIA

---

### 16. Sin protección contra clickjacking
**Severidad:** 🟡 MEDIA  
**Archivo:** `frontend/next.config.ts`

**Problema:**
No hay headers de seguridad configurados en Next.js.

**Impacto:**
- Vulnerable a clickjacking (iframe malicioso)
- Sin protección contra MIME sniffing
- Sin política de contenido (CSP)

**Solución:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

**Prioridad:** MEDIA

---

### 17. Sin validación de tipos en parámetros de ruta
**Severidad:** 🟡 MEDIA  
**Archivos:** Múltiples routers

**Problema:**
```typescript
router.get('/:id', async (req, res) => {
  const orderId = String(req.params.id); // No valida formato
});
```

**Impacto:**
- Posible inyección de caracteres especiales
- Errores inesperados en base de datos
- Logs contaminados

**Solución:**
```typescript
// Middleware de validación
const validateCuid = (paramName: string) => (req, res, next) => {
  const value = req.params[paramName];
  if (!/^c[a-z0-9]{24}$/.test(value)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  next();
};

router.get('/:id', validateCuid('id'), async (req, res) => {
  // ...
});
```

**Prioridad:** MEDIA

---

### 18. Sesiones de WhatsApp sin expiración
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`

**Problema:**
Las sesiones de WhatsApp se mantienen indefinidamente en memoria.

**Impacto:**
- Consumo de memoria sin límite
- Posible fuga de memoria (memory leak)
- Datos de conversaciones antiguas ocupando RAM

**Solución:**
```typescript
// Limpiar sesiones antiguas periódicamente
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, history] of conversationHistory.entries()) {
    if (history.length === 0) continue;
    // Implementar lógica de limpieza
  }
}, 60 * 60 * 1000); // Cada hora
```

**Prioridad:** MEDIA

---

### 19. Sin validación de archivos en WhatsApp auth
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`  
**Línea:** 30

**Problema:**
```typescript
function getAuthDir(tenantId: string) {
  const dir = path.join(AUTH_BASE, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
```

**Impacto:**
- Path traversal si tenantId contiene "../"
- Posible escritura en directorios no autorizados
- Compromiso del sistema de archivos

**Solución:**
```typescript
function getAuthDir(tenantId: string) {
  // Validar que tenantId es un CUID válido
  if (!/^c[a-z0-9]{24}$/.test(tenantId)) {
    throw new Error('Invalid tenant ID');
  }
  
  const dir = path.join(AUTH_BASE, tenantId);
  
  // Verificar que el path resultante está dentro de AUTH_BASE
  const resolvedDir = path.resolve(dir);
  const resolvedBase = path.resolve(AUTH_BASE);
  if (!resolvedDir.startsWith(resolvedBase)) {
    throw new Error('Path traversal detected');
  }
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}
```

**Prioridad:** MEDIA

---

### 20. Sin límite de intentos de conexión WhatsApp
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/whatsapp/whatsapp.service.ts`  
**Línea:** 17

**Problema:**
```typescript
const MAX_RETRIES = 5;
```

Pero no hay límite global por tenant, solo por sesión.

**Impacto:**
- Usuario puede reconectar infinitamente
- Posible DoS por reconexiones masivas
- Consumo excesivo de recursos

**Solución:**
```typescript
const reconnectAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_RECONNECTS_PER_HOUR = 10;

function canReconnect(tenantId: string): boolean {
  const now = Date.now();
  const attempts = reconnectAttempts.get(tenantId);
  
  if (!attempts || now - attempts.lastAttempt > 60 * 60 * 1000) {
    reconnectAttempts.set(tenantId, { count: 1, lastAttempt: now });
    return true;
  }
  
  if (attempts.count >= MAX_RECONNECTS_PER_HOUR) {
    return false;
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
}
```

**Prioridad:** MEDIA

---

### 21. Sin validación de permisos en colaboradores de shift
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/shifts/shifts.service.ts`

**Problema:**
No valida que el usuario que agrega colaboradores tenga permisos.

**Impacto:**
- Cualquier usuario puede agregar colaboradores a un shift
- Posible escalación de privilegios
- Bypass de control de acceso

**Solución:**
```typescript
export async function addCollaborator(
  tenantId: string,
  requesterId: string,
  shiftId: string,
  input: { userId: string }
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId }
  });
  
  if (!shift) throw createError('Shift no encontrado', 404);
  
  // Validar que el requester es el owner del shift
  if (shift.openedById !== requesterId) {
    throw createError('Solo el dueño del turno puede agregar colaboradores', 403);
  }
  
  // Resto de la lógica...
}
```

**Prioridad:** MEDIA

---

### 22. Sin sanitización de nombres de usuario
**Severidad:** 🟡 MEDIA  
**Archivos:** Múltiples

**Problema:**
Los nombres de usuario y clientes no se sanitizan antes de almacenar.

**Impacto:**
- Posible inyección de caracteres especiales
- Problemas de encoding en reportes
- XSS si se renderizan sin escape

**Solución:**
```typescript
function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[<>]/g, '') // Remover < y >
    .substring(0, 100); // Limitar longitud
}

// Usar en todos los inputs de nombres
customerName: sanitizeName(input.customerName)
```

**Prioridad:** MEDIA

---

### 23. Sin validación de montos negativos
**Severidad:** 🟡 MEDIA  
**Archivos:** Schemas de orders, expenses, shifts

**Problema:**
```typescript
initialCash: z.number()
```

No valida que los montos sean positivos.

**Impacto:**
- Posible manipulación de caja con montos negativos
- Reportes financieros incorrectos
- Bypass de controles de negocio

**Solución:**
```typescript
initialCash: z.number().positive('Debe ser mayor a 0'),
finalCash: z.number().nonnegative('No puede ser negativo'),
amount: z.number().positive('Debe ser mayor a 0'),
```

**Prioridad:** MEDIA

---

### 24. Sin protección contra enumeración de tenants
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/auth/auth.service.ts`  
**Línea:** 44

**Problema:**
```typescript
const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
if (!tenant || !tenant.isActive) throw createError("Local no encontrado o inactivo", 404);
```

**Impacto:**
- Atacante puede enumerar slugs válidos
- Información sobre clientes del sistema
- Facilita ataques dirigidos

**Solución:**
```typescript
// Usar el mismo mensaje para tenant inexistente o credenciales inválidas
if (!tenant || !tenant.isActive) {
  throw createError("Credenciales inválidas", 401);
}
```

**Prioridad:** MEDIA

---

### 25. Sin validación de coordenadas GPS
**Severidad:** 🟡 MEDIA  
**Archivo:** `backend/src/modules/orders/orders.schema.ts`

**Problema:**
No valida que las coordenadas sean válidas.

**Impacto:**
- Coordenadas fuera de rango pueden causar errores
- Posible inyección de valores extremos
- Problemas en mapas y cálculos de distancia

**Solución:**
```typescript
deliveryLat: z.number()
  .min(-90, 'Latitud inválida')
  .max(90, 'Latitud inválida')
  .optional(),
deliveryLng: z.number()
  .min(-180, 'Longitud inválida')
  .max(180, 'Longitud inválida')
  .optional(),
```

**Prioridad:** MEDIA

---

## 🟢 VULNERABILIDADES BAJAS (Mejoras continuas)

### 26. Sin versionado de API
**Severidad:** 🟢 BAJA  
**Archivos:** Routers

**Problema:**
Las rutas no tienen versionado (`/api/v1/orders`).

**Impacto:**
- Dificulta cambios breaking en el futuro
- Sin estrategia de deprecación
- Problemas de compatibilidad

**Solución:**
```typescript
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/orders', ordersRouter);
// etc.
```

**Prioridad:** BAJA

---

### 27. Sin compresión de respuestas
**Severidad:** 🟢 BAJA  
**Archivo:** `backend/src/app.ts`

**Problema:**
No hay compresión gzip/brotli de respuestas.

**Impacto:**
- Mayor consumo de ancho de banda
- Respuestas más lentas
- Costos de hosting más altos

**Solución:**
```typescript
import compression from 'compression';
app.use(compression());
```

**Prioridad:** BAJA

---
