# 🚀 Guía de Deployment - GastroDash 2.0

## 📦 Arquitectura de Deployment

- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Express + Prisma)
- **Base de datos**: Railway PostgreSQL

---

## 🔧 Backend en Railway

### 1. Crear nuevo proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en "New Project"
3. Selecciona "Deploy from GitHub repo"
4. Conecta este repositorio: `wgonzaleznadal-png/gastrodash-new`
5. Railway detectará automáticamente la configuración de `backend/railway.json`

### 2. Agregar PostgreSQL

1. En tu proyecto Railway, click en "+ New"
2. Selecciona "Database" → "PostgreSQL"
3. Railway creará automáticamente la variable `DATABASE_URL`

### 3. Configurar Variables de Entorno

En Railway, ve a tu servicio backend → Variables y agrega:

```bash
# Database (auto-generada por Railway)
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=tu-secret-super-seguro-minimo-32-caracteres-aqui
JWT_EXPIRES_IN=7d

# Server
PORT=4000
NODE_ENV=production

# CORS - Actualizar después de deployment de Vercel
FRONTEND_URL=https://tu-app.vercel.app

# OpenAI (para WhatsApp Bot)
OPENAI_API_KEY=sk-tu-api-key-de-openai
```

### 4. Configurar Root Directory

En Railway → Settings → Root Directory:
```
backend
```

### 5. Deploy

Railway hará automáticamente:
1. `npm ci` - Instalar dependencias
2. `npx prisma generate` - Generar cliente Prisma
3. `npm run build` - Compilar TypeScript
4. `npx prisma migrate deploy` - Aplicar migraciones
5. `npm start` - Iniciar servidor

**URL del backend**: Railway te dará una URL como `https://tu-app.up.railway.app`

---

## 🌐 Frontend en Vercel

### 1. Importar Proyecto

1. Ve a [vercel.com](https://vercel.com)
2. Click en "Add New" → "Project"
3. Importa el repositorio: `wgonzaleznadal-png/gastrodash-new`
4. Vercel detectará automáticamente Next.js

### 2. Configurar Build Settings

**Root Directory**: `frontend`

**Build Command**: `npm run build` (auto-detectado)

**Output Directory**: `.next` (auto-detectado)

**Install Command**: `npm install` (auto-detectado)

### 3. Configurar Variables de Entorno

En Vercel → Settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app
```

⚠️ **Importante**: Usa la URL de Railway del paso anterior

### 4. Deploy

Click en "Deploy" y Vercel hará:
1. Instalar dependencias
2. Compilar Next.js
3. Optimizar assets
4. Desplegar a CDN global

**URL del frontend**: `https://tu-app.vercel.app`

---

## 🔄 Actualizar CORS en Backend

Después de obtener la URL de Vercel, actualiza en Railway:

```bash
FRONTEND_URL=https://tu-app.vercel.app
```

Railway redesplegará automáticamente.

---

## ✅ Verificación Post-Deployment

### Backend Health Check
```bash
curl https://tu-backend.up.railway.app/health
# Debe responder: {"status":"ok","service":"gastrodash-api"}
```

### Frontend
1. Abre `https://tu-app.vercel.app`
2. Deberías ver la página de login
3. Verifica que no haya errores de CORS en la consola

### Base de Datos
```bash
# En Railway, abre la terminal del servicio backend
npx prisma studio
```

---

## 🔐 Seed de Datos Iniciales

Para crear el primer usuario y datos de prueba:

1. En Railway → Backend Service → Terminal
2. Ejecuta:
```bash
npx prisma db seed
```

Esto creará:
- Tenant de prueba
- Usuario admin
- Productos de ejemplo
- Categorías

---

## 📊 Monitoreo

### Railway
- Logs en tiempo real
- Métricas de CPU/RAM
- Reinicio automático en caso de fallo

### Vercel
- Analytics integrado
- Web Vitals
- Error tracking

---

## 🔄 CI/CD Automático

Ambas plataformas tienen CI/CD automático:

- **Push a `main`** → Deploy automático en producción
- **Pull Request** → Preview deployment automático
- **Rollback** → Un click en el dashboard

---

## 💰 Costos Estimados

### Railway (Backend + PostgreSQL)
- **Hobby Plan**: $5/mes (500 horas de ejecución)
- **Developer Plan**: $20/mes (ilimitado)

### Vercel (Frontend)
- **Hobby**: Gratis (uso personal)
- **Pro**: $20/mes (uso comercial)

---

## 🆘 Troubleshooting

### Error: "Cannot connect to database"
- Verifica que `DATABASE_URL` esté configurada en Railway
- Asegúrate que PostgreSQL esté corriendo

### Error: "CORS policy"
- Verifica que `FRONTEND_URL` en Railway coincida con la URL de Vercel
- Revisa que no haya espacios o caracteres extra

### Error: "Prisma Client not generated"
- Railway debería ejecutar `npx prisma generate` automáticamente
- Si falla, verifica los logs de build

### Frontend no conecta con Backend
- Verifica `NEXT_PUBLIC_API_URL` en Vercel
- Asegúrate que la URL del backend sea correcta (sin trailing slash)

---

## 📝 Comandos Útiles

### Railway CLI
```bash
# Instalar
npm i -g @railway/cli

# Login
railway login

# Ver logs
railway logs

# Ejecutar comando en producción
railway run npx prisma studio
```

### Vercel CLI
```bash
# Instalar
npm i -g vercel

# Login
vercel login

# Deploy manual
vercel --prod

# Ver logs
vercel logs
```

---

## 🔒 Seguridad

- ✅ Variables de entorno nunca en el código
- ✅ JWT_SECRET único y seguro (mínimo 32 caracteres)
- ✅ CORS configurado correctamente
- ✅ Rate limiting habilitado
- ✅ Helmet para headers de seguridad
- ✅ Tenant isolation en todas las queries

---

## 📚 Recursos

- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
