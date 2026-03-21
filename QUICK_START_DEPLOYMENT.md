# ⚡ Quick Start - Deployment en 10 minutos

## 📋 Pre-requisitos

- Cuenta en [Railway](https://railway.app) (gratis)
- Cuenta en [Vercel](https://vercel.com) (gratis)
- Este repositorio: `https://github.com/wgonzaleznadal-png/FastFood`

---

## 🚂 PASO 1: Backend en Railway (5 minutos)

### 1.1 Crear Proyecto
1. Ve a https://railway.app
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Busca y selecciona: `wgonzaleznadal-png/FastFood`

### 1.2 Configurar Root Directory
1. Click en el servicio creado
2. Ve a **Settings** → **Root Directory**
3. Escribe: `backend`
4. Click **Save**

### 1.3 Agregar PostgreSQL
1. En tu proyecto, click en **"+ New"**
2. Selecciona **"Database"** → **"Add PostgreSQL"**
3. Railway conectará automáticamente `DATABASE_URL`

### 1.4 Variables de Entorno
1. Click en tu servicio backend
2. Ve a **Variables**
3. Click en **"+ New Variable"** y agrega:

```bash
JWT_SECRET=cambia-esto-por-un-secret-super-seguro-minimo-32-caracteres-random
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=4000
OPENAI_API_KEY=sk-tu-key-de-openai-opcional
```

4. Para `FRONTEND_URL`, déjalo vacío por ahora (lo agregaremos después)

### 1.5 Deploy
1. Railway desplegará automáticamente
2. Espera 2-3 minutos
3. Copia la URL generada (ej: `https://gastrodash-backend-production.up.railway.app`)

### 1.6 Verificar
Abre en tu navegador:
```
https://tu-backend-url.up.railway.app/health
```

Deberías ver:
```json
{"status":"ok","service":"gastrodash-api"}
```

✅ **Backend listo!**

---

## 🌐 PASO 2: Frontend en Vercel (3 minutos)

### 2.1 Importar Proyecto
1. Ve a https://vercel.com
2. Click en **"Add New..."** → **"Project"**
3. Click en **"Import Git Repository"**
4. Busca: `wgonzaleznadal-png/FastFood`
5. Click **"Import"**

### 2.2 Configurar Build
En la pantalla de configuración:

**Framework Preset**: Next.js (auto-detectado) ✅

**Root Directory**: 
- Click en **"Edit"**
- Escribe: `frontend`
- Click **"Continue"**

### 2.3 Variables de Entorno
En **"Environment Variables"**:

**Name**: `NEXT_PUBLIC_API_URL`  
**Value**: `https://tu-backend-url.up.railway.app` (la URL de Railway del Paso 1.5)

⚠️ **Sin trailing slash al final!**

### 2.4 Deploy
1. Click en **"Deploy"**
2. Espera 2-3 minutos
3. Vercel te dará una URL (ej: `https://fast-food-ecru-three.vercel.app`)

✅ **Frontend listo!**

---

## 🔄 PASO 3: Conectar Frontend con Backend (1 minuto)

### 3.1 Actualizar CORS en Railway
1. Vuelve a Railway
2. Click en tu servicio backend
3. Ve a **Variables**
4. Agrega o edita:

```bash
FRONTEND_URL=https://tu-app.vercel.app
```

(Usa la URL exacta que te dio Vercel)

5. Railway redesplegará automáticamente (30 segundos)

✅ **Todo conectado!**

---

## 🎉 PASO 4: Verificar que Todo Funciona

### 4.1 Abrir la App
1. Ve a tu URL de Vercel: `https://tu-app.vercel.app`
2. Deberías ver la página de login

### 4.2 Crear Datos Iniciales
1. Ve a Railway → Tu servicio backend
2. Click en **"Terminal"** (arriba a la derecha)
3. Ejecuta:
```bash
npx prisma db seed
```

Esto creará:
- ✅ Tenant de prueba
- ✅ Usuario admin (email: admin@test.com, password: admin123)
- ✅ Productos de ejemplo
- ✅ Categorías

### 4.3 Login
1. Vuelve a tu app en Vercel
2. Usa las credenciales:
   - **Email**: `admin@test.com`
   - **Password**: `admin123`

3. Deberías entrar al dashboard ✨

---

## 🎯 URLs Finales

Guarda estas URLs:

- **Frontend**: `https://tu-app.vercel.app`
- **Backend**: `https://tu-backend.up.railway.app`
- **Backend Health**: `https://tu-backend.up.railway.app/health`
- **Railway Dashboard**: https://railway.app/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## 🔧 Configuración Adicional (Opcional)

### Dominio Personalizado en Vercel
1. Vercel → Settings → Domains
2. Agrega tu dominio (ej: `app.tuempresa.com`)
3. Configura DNS según instrucciones
4. Actualiza `FRONTEND_URL` en Railway

### Dominio Personalizado en Railway
1. Railway → Settings → Networking
2. Agrega tu dominio (ej: `api.tuempresa.com`)
3. Configura DNS según instrucciones
4. Actualiza `NEXT_PUBLIC_API_URL` en Vercel

### Configurar WhatsApp Bot
1. Necesitas una API Key de OpenAI
2. Agrégala en Railway: `OPENAI_API_KEY=sk-...`
3. El bot se activará automáticamente

---

## 🆘 Problemas Comunes

### "Cannot connect to database"
- Verifica que PostgreSQL esté agregado en Railway
- Espera 1-2 minutos después de agregar la DB

### "CORS error" en el frontend
- Verifica que `FRONTEND_URL` en Railway sea exactamente igual a la URL de Vercel
- Sin espacios, sin trailing slash
- Espera 30 segundos después de cambiar la variable

### "API not responding"
- Verifica que el backend esté corriendo en Railway
- Revisa los logs: Railway → Tu servicio → Logs
- Verifica que `NEXT_PUBLIC_API_URL` en Vercel sea correcto

### "Build failed" en Railway
- Revisa que Root Directory sea `backend`
- Verifica los logs de build
- Asegúrate que todas las variables estén configuradas

### "Build failed" en Vercel
- Revisa que Root Directory sea `frontend`
- Verifica que `NEXT_PUBLIC_API_URL` esté configurada
- Revisa los logs de build en Vercel

---

## 📱 Próximos Pasos

1. **Cambiar credenciales**: Crea tu propio usuario y elimina el de prueba
2. **Configurar productos**: Agrega tus productos reales
3. **Personalizar**: Logo, colores, nombre del negocio
4. **Invitar equipo**: Crea usuarios para tu equipo
5. **Configurar WhatsApp**: Si quieres usar el bot

---

## 💡 Tips

- **Logs en tiempo real**: Railway y Vercel tienen logs en vivo
- **Rollback**: Ambas plataformas permiten volver a versiones anteriores
- **Preview deployments**: Cada PR crea un preview automático
- **Auto-deploy**: Cada push a `main` despliega automáticamente

---

## 📞 Soporte

Si algo no funciona:
1. Revisa los logs en Railway y Vercel
2. Verifica que todas las variables estén bien escritas
3. Asegúrate que las URLs no tengan espacios o caracteres extra
4. Espera 1-2 minutos después de cada cambio

---

¡Listo! Tu GastroDash 2.0 está en producción 🚀
