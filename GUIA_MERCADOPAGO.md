# 💳 Guía de Integración: Mercado Pago

## 📋 Requisitos Previos

1. **Cuenta de Mercado Pago** (personal o empresarial)
2. **Aplicación creada** en el panel de desarrolladores
3. **Credenciales de prueba** (para testing)
4. **Credenciales de producción** (para ventas reales)

---

## 🔑 Paso 1: Obtener Credenciales

### 1.1 Crear Aplicación

1. Andá a: https://www.mercadopago.com.ar/developers/panel/app
2. Clickeá **"Crear aplicación"**
3. Completá los datos:
   - **Nombre:** GastroDash
   - **Modelo de integración:** Checkout Pro
   - **Descripción:** Sistema de pedidos para negocio gastronómico
4. Clickeá **"Crear aplicación"**

### 1.2 Obtener Credenciales de Prueba

1. En el panel de tu aplicación, andá a **"Credenciales"**
2. Seleccioná **"Credenciales de prueba"**
3. Copiá:
   - **Public Key:** `TEST-...`
   - **Access Token:** `TEST-...`

### 1.3 Obtener Credenciales de Producción

⚠️ **IMPORTANTE:** Solo usá estas credenciales cuando estés listo para cobrar de verdad.

1. En el panel, andá a **"Credenciales"**
2. Seleccioná **"Credenciales de producción"**
3. Copiá:
   - **Public Key:** `APP_USR-...`
   - **Access Token:** `APP_USR-...`

---

## 💻 Paso 2: Configurar el Backend

### 2.1 Instalar SDK de Mercado Pago

```bash
cd backend
npm install mercadopago
```

### 2.2 Agregar Credenciales al `.env`

Editá `/backend/.env`:

```env
# Mercado Pago - PRUEBA
MP_ACCESS_TOKEN=TEST-1234567890-...
MP_PUBLIC_KEY=TEST-...

# Mercado Pago - PRODUCCIÓN (comentar mientras probás)
# MP_ACCESS_TOKEN=APP_USR-1234567890-...
# MP_PUBLIC_KEY=APP_USR-...

# URL del frontend (para redirecciones)
FRONTEND_URL=http://localhost:3000
```

### 2.3 Crear Servicio de Mercado Pago

Creá `/backend/src/modules/payments/mercadopago.service.ts`:

```typescript
import { MercadoPagoConfig, Preference } from "mercadopago";
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "",
});

const preferenceClient = new Preference(client);

export async function createPaymentPreference(
  tenantId: string,
  orderId: string
) {
  // Buscar el pedido
  const order = await prisma.kgOrder.findFirst({
    where: { id: orderId, tenantId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) throw createError("Pedido no encontrado", 404);

  // Crear items para Mercado Pago
  const items = order.items.map((item) => ({
    id: item.product.id,
    title: item.product.name,
    description: `${item.weightKg} kg`,
    quantity: 1,
    unit_price: Number(item.subtotal),
    currency_id: "ARS",
  }));

  // Crear preferencia de pago
  const preference = await preferenceClient.create({
    body: {
      items,
      payer: {
        name: order.customerName,
        phone: {
          number: order.deliveryPhone || "",
        },
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/dashboard/caja?payment=success&orderId=${orderId}`,
        failure: `${process.env.FRONTEND_URL}/dashboard/caja?payment=failure&orderId=${orderId}`,
        pending: `${process.env.FRONTEND_URL}/dashboard/caja?payment=pending&orderId=${orderId}`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: `${process.env.BACKEND_URL || "http://localhost:4000"}/api/payments/webhook`,
      statement_descriptor: "GASTRODASH",
    },
  });

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
  };
}

export async function handlePaymentWebhook(data: any) {
  // Mercado Pago envía notificaciones cuando cambia el estado del pago
  const { type, data: paymentData } = data;

  if (type === "payment") {
    const paymentId = paymentData.id;
    
    // Acá podrías consultar el estado del pago y actualizar el pedido
    // Por ahora solo logueamos
    console.log("[MercadoPago] Webhook recibido:", { type, paymentId });
  }

  return { received: true };
}
```

### 2.4 Crear Router de Pagos

Creá `/backend/src/modules/payments/payments.router.ts`:

```typescript
import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "@/middleware/tenantGuard";
import { createPaymentPreference, handlePaymentWebhook } from "./mercadopago.service";

const router = Router();

// Crear preferencia de pago (requiere autenticación)
router.post(
  "/create-preference",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderId } = req.body;
      const result = await createPaymentPreference(req.auth!.tenantId, orderId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Webhook de Mercado Pago (NO requiere autenticación)
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    await handlePaymentWebhook(req.body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("[MercadoPago] Error en webhook:", err);
    res.status(500).send("Error");
  }
});

export default router;
```

### 2.5 Registrar Router en App

Editá `/backend/src/app.ts`:

```typescript
import paymentsRouter from "./modules/payments/payments.router";

// ... después de los otros routers
app.use("/api/payments", paymentsRouter);
```

---

## 🎨 Paso 3: Configurar el Frontend

### 3.1 Agregar Public Key al `.env.local`

Editá `/frontend/.env.local`:

```env
NEXT_PUBLIC_MP_PUBLIC_KEY=TEST-...
```

### 3.2 Instalar SDK de Mercado Pago (Frontend)

```bash
cd frontend
npm install @mercadopago/sdk-react
```

### 3.3 Crear Componente de Pago

Creá `/frontend/src/components/payments/MercadoPagoButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@mantine/core";
import { IconBrandPaypal } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";

interface MercadoPagoButtonProps {
  orderId: string;
  amount: number;
  onSuccess?: () => void;
}

export default function MercadoPagoButton({ orderId, amount, onSuccess }: MercadoPagoButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await api.post("/api/payments/create-preference", { orderId });
      const { initPoint, sandboxInitPoint } = res.data;

      // Abrir Mercado Pago en nueva ventana
      const paymentUrl = process.env.NODE_ENV === "production" ? initPoint : sandboxInitPoint;
      window.open(paymentUrl, "_blank");

      notifications.show({
        title: "Redirigiendo a Mercado Pago",
        message: "Se abrió una nueva ventana para completar el pago",
        color: "blue",
      });

      onSuccess?.();
    } catch (err) {
      showApiError(err, "Error al generar link de pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      leftSection={<IconBrandPaypal size={18} />}
      color="blue"
      onClick={handlePay}
      loading={loading}
      fullWidth
    >
      Pagar con Mercado Pago (${amount.toLocaleString("es-AR")})
    </Button>
  );
}
```

### 3.4 Usar el Componente

Ejemplo en el drawer de pago de `/frontend/src/components/caja/KgOrdersModule.tsx`:

```tsx
import MercadoPagoButton from "@/components/payments/MercadoPagoButton";

// Dentro del drawer de pago:
{paymentMethod === "mercadopago" && selectedOrderId && (
  <MercadoPagoButton
    orderId={selectedOrderId}
    amount={paymentAmount}
    onSuccess={() => {
      setPaymentDrawerOpen(false);
      fetchOrders();
    }}
  />
)}
```

---

## 🧪 Paso 4: Probar con Tarjetas de Prueba

Mercado Pago te da **tarjetas de prueba** para simular pagos:

### Tarjetas Aprobadas

| Tarjeta | Número | CVV | Vencimiento |
|---------|--------|-----|-------------|
| Visa | 4509 9535 6623 3704 | 123 | 11/25 |
| Mastercard | 5031 7557 3453 0604 | 123 | 11/25 |

### Tarjetas Rechazadas

| Tarjeta | Número | Motivo |
|---------|--------|--------|
| Visa | 4013 5406 8274 6260 | Fondos insuficientes |
| Mastercard | 5031 4332 1540 6351 | Rechazada |

**Datos del titular (para testing):**
- Nombre: APRO (aprobado) o OTHE (rechazado)
- DNI: 12345678
- Email: test_user_123@testuser.com

---

## 🔔 Paso 5: Configurar Webhooks (Opcional pero Recomendado)

Los webhooks te notifican cuando un pago cambia de estado.

### 5.1 Exponer tu Backend (para testing local)

Usá **ngrok** para exponer tu backend:

```bash
npm install -g ngrok
ngrok http 4000
```

Te va a dar una URL como: `https://abc123.ngrok.io`

### 5.2 Configurar Webhook en Mercado Pago

1. Andá a: https://www.mercadopago.com.ar/developers/panel/app
2. Seleccioná tu aplicación
3. Andá a **"Webhooks"**
4. Agregá la URL: `https://abc123.ngrok.io/api/payments/webhook`
5. Seleccioná eventos: **"Pagos"**

### 5.3 Procesar Notificaciones

Ya está implementado en `mercadopago.service.ts` → `handlePaymentWebhook()`

Cuando un pago se aprueba, podés:
- Actualizar el estado del pedido a `PAID`
- Enviar notificación por WhatsApp
- Marcar como "enviado a cocina"

---

## 💰 Comisiones de Mercado Pago

**Argentina (2024):**
- **Tarjeta de débito:** 3.49% + IVA
- **Tarjeta de crédito:** 4.99% + IVA (1 pago)
- **Cuotas sin interés:** 6% - 12% + IVA (según cuotas)

**Ejemplo:**
- Pedido de $50.000
- Comisión (débito): $50.000 × 3.49% = $1.745
- **Recibís:** $48.255

---

## 🚀 Paso 6: Ir a Producción

Cuando estés listo para cobrar de verdad:

1. **Cambiá las credenciales en `.env`:**
   ```env
   MP_ACCESS_TOKEN=APP_USR-... (producción)
   MP_PUBLIC_KEY=APP_USR-... (producción)
   ```

2. **Actualizá la URL del webhook:**
   - Usá tu dominio real: `https://tu-dominio.com/api/payments/webhook`

3. **Verificá tu cuenta de Mercado Pago:**
   - Completá la verificación de identidad
   - Agregá cuenta bancaria para recibir el dinero

4. **Probá con una compra real pequeña** ($100) antes de lanzar

---

## ✅ Checklist Final

- [ ] Aplicación creada en Mercado Pago
- [ ] Credenciales de prueba configuradas
- [ ] SDK instalado (backend y frontend)
- [ ] Servicio de pagos implementado
- [ ] Componente de botón de pago creado
- [ ] Probado con tarjetas de prueba
- [ ] Webhook configurado (opcional)
- [ ] Listo para producción

---

## 🆘 Problemas Comunes

**"Invalid access token"**
→ Verificá que el `MP_ACCESS_TOKEN` en `.env` sea correcto

**"Preference creation failed"**
→ Verificá que los items tengan `unit_price` mayor a 0

**El botón no abre Mercado Pago**
→ Verificá que `NEXT_PUBLIC_MP_PUBLIC_KEY` esté en `.env.local`

**El webhook no recibe notificaciones**
→ Verificá que la URL sea accesible desde internet (usá ngrok para testing local)

**"Pago aprobado pero pedido no se actualiza"**
→ Implementá la lógica en `handlePaymentWebhook()` para actualizar el pedido cuando `type === "payment"` y `status === "approved"`

---

## 📚 Recursos

- **Documentación oficial:** https://www.mercadopago.com.ar/developers/es/docs
- **Panel de desarrolladores:** https://www.mercadopago.com.ar/developers/panel
- **Tarjetas de prueba:** https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards
