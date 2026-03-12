# ✅ Checklist de Deployment - GastroDash 2.0

## 📦 Repositorio

- ✅ Código pusheado a: `https://github.com/wgonzaleznadal-png/gastrodash-new`
- ✅ Branch principal: `main`
- ✅ Build exitoso (Backend + Frontend)
- ✅ TypeScript sin errores
- ✅ Documentación completa

---

## 📚 Documentación Incluida

- ✅ `README.md` - Descripción general del proyecto
- ✅ `DEPLOYMENT.md` - Guía completa de deployment
- ✅ `QUICK_START_DEPLOYMENT.md` - Guía rápida paso a paso (10 min)
- ✅ `ENV_VARIABLES.md` - Documentación detallada de variables de entorno
- ✅ `DEPLOYMENT_CHECKLIST.md` - Este archivo

---

## 🚂 Railway (Backend) - Checklist

### Configuración Inicial
- [ ] Crear cuenta en https://railway.app
- [ ] Crear nuevo proyecto
- [ ] Conectar repositorio: `wgonzaleznadal-png/gastrodash-new`
- [ ] Configurar Root Directory: `backend`

### Base de Datos
- [ ] Agregar PostgreSQL al proyecto
- [ ] Verificar que `DATABASE_URL` se generó automáticamente

### Variables de Entorno
- [ ] `DATABASE_URL` - Auto-generada ✅
- [ ] `JWT_SECRET` - Generar con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `JWT_EXPIRES_IN` - Configurar: `7d`
- [ ] `NODE_ENV` - Configurar: `production`
- [ ] `PORT` - Configurar: `4000`
- [ ] `FRONTEND_URL` - Agregar después de desplegar Vercel
- [ ] `OPENAI_API_KEY` - (Opcional) Para WhatsApp Bot

### Deployment
- [ ] Esperar que el build termine (2-3 min)
- [ ] Copiar la URL generada (ej: `https://gastrodash-backend-production.up.railway.app`)
- [ ] Verificar health check: `https://tu-url.up.railway.app/health`

### Seed de Datos
- [ ] Abrir Terminal en Railway
- [ ] Ejecutar: `npx prisma db seed`
- [ ] Verificar que se crearon datos de prueba

---

## 🌐 Vercel (Frontend) - Checklist

### Configuración Inicial
- [ ] Crear cuenta en https://vercel.com
- [ ] Importar proyecto desde GitHub
- [ ] Seleccionar repositorio: `wgonzaleznadal-png/gastrodash-new`
- [ ] Configurar Root Directory: `frontend`

### Variables de Entorno
- [ ] `NEXT_PUBLIC_API_URL` - URL de Railway (sin trailing slash)

### Deployment
- [ ] Click en "Deploy"
- [ ] Esperar que el build termine (2-3 min)
- [ ] Copiar la URL generada (ej: `https://gastrodash-new.vercel.app`)

---

## 🔄 Conexión Backend ↔ Frontend

### Actualizar CORS en Railway
- [ ] Volver a Railway → Variables
- [ ] Agregar/Actualizar `FRONTEND_URL` con la URL de Vercel
- [ ] Esperar redeploy automático (30 seg)

---

## 🧪 Verificación Final

### Backend
- [ ] Abrir: `https://tu-backend.up.railway.app/health`
- [ ] Debe responder: `{"status":"ok","service":"gastrodash-api"}`

### Frontend
- [ ] Abrir: `https://tu-app.vercel.app`
- [ ] Debe mostrar página de login
- [ ] No debe haber errores de CORS en consola

### Login de Prueba
- [ ] Email: `admin@test.com`
- [ ] Password: `admin123`
- [ ] Debe entrar al dashboard

### Funcionalidades Básicas
- [ ] Crear un turno de caja
- [ ] Crear un producto
- [ ] Crear un pedido
- [ ] Cerrar turno

---

## 📝 URLs Importantes

### Producción
```
Frontend: https://_____________________.vercel.app
Backend:  https://_____________________.up.railway.app
Health:   https://_____________________.up.railway.app/health
```

### Dashboards
```
Railway:  https://railway.app/dashboard
Vercel:   https://vercel.com/dashboard
GitHub:   https://github.com/wgonzaleznadal-png/gastrodash-new
```

### Credenciales de Prueba
```
Email:    admin@test.com
Password: admin123
```

---

## 🔐 Seguridad Post-Deployment

- [ ] Cambiar credenciales de prueba
- [ ] Crear usuario real para producción
- [ ] Eliminar usuario de prueba
- [ ] Verificar que `JWT_SECRET` sea único y seguro
- [ ] Configurar límites de gasto en OpenAI (si aplica)
- [ ] Revisar logs de Railway y Vercel

---

## 🎨 Personalización

- [ ] Cambiar nombre del negocio en configuración
- [ ] Agregar logo personalizado
- [ ] Configurar productos reales
- [ ] Configurar categorías
- [ ] Crear usuarios del equipo
- [ ] Configurar métodos de pago

---

## 📱 Funcionalidades Opcionales

### WhatsApp Bot
- [ ] Obtener API Key de OpenAI
- [ ] Configurar `OPENAI_API_KEY` en Railway
- [ ] Probar bot con un número de prueba

### Dominio Personalizado
- [ ] Comprar dominio (ej: `tuempresa.com`)
- [ ] Configurar en Vercel: `app.tuempresa.com`
- [ ] Configurar en Railway: `api.tuempresa.com`
- [ ] Actualizar variables de entorno

### Google Maps (Delivery)
- [ ] Obtener API Key de Google Maps
- [ ] Configurar en frontend
- [ ] Habilitar APIs necesarias

### MercadoPago
- [ ] Crear cuenta de MercadoPago
- [ ] Obtener credenciales
- [ ] Configurar en backend

---

## 🔧 Mantenimiento

### Actualizaciones
- [ ] Configurar notificaciones de GitHub
- [ ] Revisar logs semanalmente
- [ ] Actualizar dependencias mensualmente

### Backups
- [ ] Railway hace backups automáticos de PostgreSQL
- [ ] Considerar backups adicionales para datos críticos

### Monitoreo
- [ ] Revisar métricas en Railway
- [ ] Revisar analytics en Vercel
- [ ] Configurar alertas de errores

---

## 🆘 Soporte

### Documentación
- Ver `QUICK_START_DEPLOYMENT.md` para guía paso a paso
- Ver `ENV_VARIABLES.md` para detalles de configuración
- Ver `DEPLOYMENT.md` para troubleshooting

### Logs
- Railway: Click en servicio → Logs
- Vercel: Click en deployment → Logs

### Problemas Comunes
- CORS error → Verificar `FRONTEND_URL` en Railway
- API not responding → Verificar `NEXT_PUBLIC_API_URL` en Vercel
- Database error → Verificar que PostgreSQL esté corriendo

---

## 🎉 ¡Listo para Producción!

Una vez completado este checklist, tu GastroDash 2.0 estará:
- ✅ Desplegado en producción
- ✅ Conectado a base de datos
- ✅ Con CORS configurado
- ✅ Con datos de prueba
- ✅ Listo para usar

---

**Fecha de deployment**: _______________  
**Desplegado por**: _______________  
**Versión**: 2.0  
**Commit**: `4aece84`
