# 🔐 Variables de Entorno - GastroDash 2.0

## 📋 Resumen Rápido

### Railway (Backend)
```bash
DATABASE_URL=postgresql://...  # Auto-generada por Railway
JWT_SECRET=tu-secret-super-seguro-minimo-32-caracteres-random
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://tu-app.vercel.app
OPENAI_API_KEY=sk-tu-key-opcional
# Opcional: límite de requests / 15 min (default producción 8000). Subí si tenés mucho polling.
# API_RATE_LIMIT_MAX=12000
```

### Vercel (Frontend)
```bash
NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app
```

---

## 🚂 Railway - Variables Detalladas

### DATABASE_URL (Auto-generada)
**Descripción**: URL de conexión a PostgreSQL  
**Generada por**: Railway al agregar PostgreSQL  
**Formato**: `postgresql://user:password@host:port/database`  
**Acción**: No tocar, Railway la configura automáticamente

---

### JWT_SECRET (REQUERIDA)
**Descripción**: Clave secreta para firmar tokens JWT  
**Tipo**: String  
**Mínimo**: 32 caracteres  
**Ejemplo**: `8f3a9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0`

**Generar una segura**:
```bash
# En tu terminal local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O usa: https://generate-secret.vercel.app/32

⚠️ **IMPORTANTE**: 
- Nunca compartas este secret
- Usa uno diferente para producción y desarrollo
- Si lo cambias, todos los usuarios deberán hacer login nuevamente

---

### JWT_EXPIRES_IN (REQUERIDA)
**Descripción**: Tiempo de expiración de los tokens  
**Tipo**: String  
**Formato**: Notación de tiempo (s, m, h, d)  
**Valor recomendado**: `7d` (7 días)

**Opciones**:
- `1h` - 1 hora
- `24h` - 24 horas
- `7d` - 7 días (recomendado)
- `30d` - 30 días

---

### NODE_ENV (REQUERIDA)
**Descripción**: Entorno de ejecución  
**Tipo**: String  
**Valor**: `production`

⚠️ **No cambiar** - Railway necesita esto en `production`

---

### PORT (REQUERIDA)
**Descripción**: Puerto donde corre el servidor  
**Tipo**: Number  
**Valor**: `4000`

ℹ️ Railway puede sobrescribir esto automáticamente

---

### FRONTEND_URL (REQUERIDA)
**Descripción**: URL del frontend para configurar CORS  
**Tipo**: String (URL completa)  
**Formato**: `https://tu-dominio.com`

**Ejemplos**:
- Vercel: `https://gastrodash-new.vercel.app`
- Dominio custom: `https://www.fastfood.com.ar`
- Varios orígenes: `https://www.fastfood.com.ar,https://fastfood.com.ar`

⚠️ **IMPORTANTE**:
- Sin trailing slash al final (❌ `https://app.com/`)
- Debe ser HTTPS en producción
- Debe coincidir exactamente con el origen (incluyendo `www` si aplica: `https://www.fastfood.com.ar`)

**Cuándo configurar**:
1. Primero despliega el frontend en Vercel
2. Copia la URL que te da Vercel
3. Agrégala aquí en Railway
4. Railway redesplegará automáticamente

---

### OPENAI_API_KEY (OPCIONAL)
**Descripción**: API Key de OpenAI para el bot de WhatsApp  
**Tipo**: String  
**Formato**: `sk-...`

**Obtener una**:
1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API Key
3. Cópiala (solo se muestra una vez)

**Costo estimado**: 
- ~$0.002 por conversación
- ~$5/mes para 2,500 conversaciones

⚠️ **Si no la configuras**:
- El bot de WhatsApp no funcionará
- El resto del sistema funciona normalmente

---

## 🌐 Vercel - Variables Detalladas

### NEXT_PUBLIC_API_URL (REQUERIDA)
**Descripción**: URL del backend para hacer requests  
**Tipo**: String (URL completa)  
**Formato**: `https://tu-backend.com`

**Ejemplos**:
- Railway: `https://gastrodash-backend-production.up.railway.app`
- Dominio custom: `https://api.tuempresa.com`

⚠️ **IMPORTANTE**:
- **Debe incluir `https://`** (❌ `fastfood-production.up.railway.app` → ✅ `https://fastfood-production.up.railway.app`)
- Sin el protocolo, el navegador trata la URL como ruta relativa y las peticiones van al dominio del frontend (404)
- Sin trailing slash al final (❌ `https://api.com/`)
- Debe coincidir con la URL de Railway

**Cuándo configurar**:
1. Primero despliega el backend en Railway
2. Copia la URL que te da Railway
3. Agrégala aquí en Vercel
4. Vercel redesplegará automáticamente

ℹ️ **Nota**: El prefijo `NEXT_PUBLIC_` hace que esta variable sea accesible en el navegador

---

## 🔄 Orden de Configuración

### Primera vez:

1. **Railway**: Configura todo EXCEPTO `FRONTEND_URL`
2. **Vercel**: Configura `NEXT_PUBLIC_API_URL` con la URL de Railway
3. **Railway**: Agrega `FRONTEND_URL` con la URL de Vercel

### Cambio de dominio:

1. Actualiza el dominio en Vercel o Railway
2. Actualiza la variable correspondiente en la otra plataforma
3. Espera el redeploy automático (30-60 segundos)

---

## 🧪 Variables para Desarrollo Local

### Backend (.env)
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/gastrodash?schema=public"
JWT_SECRET="dev-secret-change-in-production-min-32-chars"
JWT_EXPIRES_IN="7d"
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
OPENAI_API_KEY="sk-tu-key-opcional"
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## ✅ Checklist de Variables

### Railway Backend
- [ ] `DATABASE_URL` - Auto-generada ✅
- [ ] `JWT_SECRET` - Generada con crypto ✅
- [ ] `JWT_EXPIRES_IN` - Configurada en `7d` ✅
- [ ] `NODE_ENV` - Configurada en `production` ✅
- [ ] `PORT` - Configurada en `4000` ✅
- [ ] `FRONTEND_URL` - URL de Vercel sin trailing slash ✅
- [ ] `OPENAI_API_KEY` - (Opcional) Configurada si usas WhatsApp ✅

### Vercel Frontend
- [ ] `NEXT_PUBLIC_API_URL` - URL de Railway sin trailing slash ✅

---

## 🆘 Troubleshooting

### Error: "Invalid JWT Secret"
- Verifica que `JWT_SECRET` tenga al menos 32 caracteres
- Regenera uno nuevo con el comando de crypto

### Error: "CORS policy"
- Verifica que `FRONTEND_URL` en Railway coincida EXACTAMENTE con la URL de Vercel
- Sin espacios, sin trailing slash, con https://

### Error: "Cannot connect to API"
- Verifica que `NEXT_PUBLIC_API_URL` en Vercel coincida con la URL de Railway
- Verifica que el backend esté corriendo (abre /health en el navegador)

### Error: "Database connection failed"
- Verifica que PostgreSQL esté agregado en Railway
- `DATABASE_URL` debe estar presente en las variables
- Espera 1-2 minutos después de agregar la DB

### WhatsApp Bot no responde
- Verifica que `OPENAI_API_KEY` esté configurada
- Verifica que la key sea válida en OpenAI
- Revisa los logs en Railway para ver errores

---

## 🔒 Seguridad

### ✅ Buenas Prácticas
- Usa secrets diferentes para dev y producción
- Nunca compartas `JWT_SECRET`
- Nunca commitees archivos `.env` al repositorio
- Rota `JWT_SECRET` cada 3-6 meses
- Usa API Keys con límites de gasto en OpenAI

### ❌ Nunca Hagas Esto
- Hardcodear secrets en el código
- Compartir secrets en Slack/Discord/Email
- Usar el mismo secret en múltiples proyectos
- Commitear `.env` al repositorio
- Usar secrets débiles o predecibles

---

## 📚 Referencias

- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
