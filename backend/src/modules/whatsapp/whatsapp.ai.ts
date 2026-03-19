import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { sanitizeName } from "@/lib/sanitize";
import { expensesService } from "@/modules/expenses/expenses.service";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no está configurada. Agregala al archivo .env");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ─── SANITIZE USER INPUT (prompt injection protection) ────────────────────────
function sanitizeUserInput(text: string): string {
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, "");
  if (sanitized.length > 1000) sanitized = sanitized.substring(0, 1000);
  const dangerousPatterns = [
    /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
    /system\s*:/i,
    /you\s+are\s+now/i,
    /forget\s+everything/i,
    /disregard\s+(all\s+)?(previous|prior)/i,
    /new\s+instructions\s*:/i,
    /act\s+as\s+if/i,
  ];
  for (const p of dangerousPatterns) {
    if (p.test(sanitized)) return "[Mensaje bloqueado por seguridad]";
  }
  return sanitized;
}

// ─── CONVERSATION HISTORY (in-memory per jid, capped) ────────────────────────
const conversationHistory = new Map<string, Array<{ role: "user" | "assistant" | "system"; content: string }>>();
const conversationLastAccess = new Map<string, number>();
const MAX_HISTORY = 20;
const HISTORY_TTL_MS = 60 * 60 * 1000; // 1 hora

function getHistory(tenantId: string, jid: string) {
  const key = `${tenantId}:${jid}`;
  if (!conversationHistory.has(key)) conversationHistory.set(key, []);
  return conversationHistory.get(key)!;
}

function addToHistory(tenantId: string, jid: string, role: "user" | "assistant", content: string) {
  const key = `${tenantId}:${jid}`;
  conversationLastAccess.set(key, Date.now());
  const history = getHistory(tenantId, jid);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

function cleanupStaleHistory() {
  const now = Date.now();
  for (const [key, lastAccess] of conversationLastAccess.entries()) {
    if (now - lastAccess > HISTORY_TTL_MS) {
      conversationHistory.delete(key);
      conversationLastAccess.delete(key);
    }
  }
}
setInterval(cleanupStaleHistory, HISTORY_TTL_MS);

// ─── FORMAT CURRENCY ──────────────────────────────────────────────────────────
function fmt(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── TOOL DEFINITIONS ─────────────────────────────────────────────────────────
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "checkAvailability",
      description: "Obtiene la lista COMPLETA de productos disponibles para venta. Siempre devuelve todos los productos activos.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmWaOrder",
      description: "Confirma y crea un pedido de WhatsApp. Se usa cuando el cliente confirmó todos los detalles.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { 
                  type: "string",
                  description: "El ID ÚNICO del producto (ej: 'cmlz...'). DEBE ser el campo 'id' exacto obtenido de checkAvailability. NUNCA uses el nombre del producto."
                },
                weightKg: { type: "number" },
              },
              required: ["productId", "weightKg"],
            },
            description: "Lista de productos con su peso en kg",
          },
          customerName: { type: "string", description: "Nombre del cliente" },
          isDelivery: { type: "boolean", description: "true si es envío, false si es retiro" },
          deliveryAddress: { type: "string", description: "Dirección de entrega (solo si isDelivery)" },
          paymentMethod: { type: "string", enum: ["EFECTIVO", "MERCADOPAGO"], description: "Método de pago elegido por el cliente" },
        },
        required: ["items", "customerName", "isDelivery"],
      },
    },
  },
];

// ─── TOOL EXECUTORS ───────────────────────────────────────────────────────────
async function executeCheckAvailability(tenantId: string): Promise<string> {
  const products = await prisma.product.findMany({
    where: { tenantId, unitType: 'KG', isAvailable: true, isAvailableForBot: true },
    select: { id: true, name: true, pricePerKg: true },
    orderBy: { name: "asc" },
  });

  if (products.length === 0) {
    return JSON.stringify({ 
      available: false, 
      message: "No hay productos disponibles en este momento.",
      products: [],
    });
  }

  return JSON.stringify({
    available: true,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      pricePerKg: fmt(Number(p.pricePerKg)),
      pricePerKgNumber: Number(p.pricePerKg),
    })),
  });
}

async function executeConfirmWaOrder(
  tenantId: string,
  jid: string,
  data: {
    items: Array<{ productId: string; weightKg: number }>;
    customerName: string;
    isDelivery: boolean;
    deliveryAddress?: string;
    paymentMethod?: string;
  }
): Promise<string> {
  const deliveryPhone = jid.split('@')[0];
  const customerName = sanitizeName(data.customerName);
  
  // 1. Buscar turno abierto (Tu lógica original)
  const openShift = await prisma.shift.findFirst({
    where: { tenantId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });

  if (!openShift) {
    return JSON.stringify({ success: false, error: "No hay turno abierto. No se puede crear el pedido." });
  }

  // 🔎 2. BUSCAR PEDIDO EXISTENTE (Para evitar duplicados en la Lista General)
  // Buscamos un pedido PENDING de este mismo chat en el turno actual
  const existingOrder = await prisma.order.findFirst({
    where: { 
      tenantId, 
      waJid: jid, 
      status: "PENDING",
      shiftId: openShift.id 
    }
  });

  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId, unitType: 'KG', isAvailable: true, isAvailableForBot: true },
  });

  if (products.length !== productIds.length) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[WhatsApp AI] Validation failed: expected ${productIds.length}, found ${products.length}`);
    }
    return JSON.stringify({ success: false, error: "Uno o más productos no están disponibles." });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 4. Calcular totales y preparar items
  let totalPrice = 0;
  const itemsData = data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
    const pricePerKg = Number(product.pricePerKg!);
    const subtotal = Math.round(pricePerKg * item.weightKg * 100) / 100;
    totalPrice += subtotal;
    return {
      productId: item.productId,
      unitType: 'KG' as const,
      quantity: item.weightKg,
      unitPrice: pricePerKg,
      subtotal,
      destination: product.destination || 'COCINA',
    };
  });

  let order;
  try {
    if (existingOrder) {
      // 🔄 5. RAMA DE ACTUALIZACIÓN: El cliente cambió de opinión
      // Limpiamos los items viejos antes de poner los nuevos
      await prisma.orderItem.deleteMany({ where: { orderId: existingOrder.id } });
      
      order = await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          customerName,
          isDelivery: data.isDelivery,
          // Lógica "Mozo Estrella": Si retira, dirección va a null
          deliveryAddress: data.isDelivery ? data.deliveryAddress : null,
          paymentMethod: data.paymentMethod || "EFECTIVO",
          totalPrice,
          items: { create: itemsData },
        },
      });
      if (process.env.NODE_ENV === "development") console.log("[WhatsApp AI] Order updated:", order.id);

    } else {
      // 🆕 6. RAMA DE CREACIÓN (Tu lógica original)
      const lastOrder = await prisma.order.findFirst({
        where: { shiftId: openShift.id },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const nextOrderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      order = await prisma.order.create({
        data: {
          tenantId,
          shiftId: openShift.id,
          orderNumber: nextOrderNumber,
          customerName,
          isDelivery: data.isDelivery,
          deliveryAddress: data.isDelivery ? data.deliveryAddress : null,
          deliveryPhone,
          paymentMethod: data.paymentMethod || "EFECTIVO",
          isSentToKitchen: true,
          status: "PENDING",
          totalPrice,
          source: "WHATSAPP",
          waJid: jid,
          items: { create: itemsData },
        },
      });
      if (process.env.NODE_ENV === "development") console.log("[WhatsApp AI] Order created:", order.id);
    }
  } catch (err: any) {
    console.error("[WhatsApp AI] DB error:", err.message);
    return JSON.stringify({ success: false, error: "Error en base de datos" });
  }

  // 7. Finalizar (Tu lógica original)
  await prisma.waSessionState.update({
    where: { tenantId_jid: { tenantId, jid } },
    data: { chatState: "COMPLETED" },
  });

  return JSON.stringify({
    success: true,
    message: `Pedido #${order.orderNumber} ${existingOrder ? 'actualizado' : 'registrado'} exitosamente. Total: ${fmt(totalPrice)}`
  });
}

async function executeCreateWaExpense(
  tenantId: string,
  data: { amount: number; description: string; category?: string }
): Promise<string> {
  try {
    const openShift = await prisma.shift.findFirst({
      where: { tenantId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });

    await expensesService.createExpense(tenantId, {
      type: "CASH",
      description: data.description.trim(),
      amount: data.amount,
      currency: "ARS",
      isPaid: true,
      category: data.category || "Otros",
      shiftId: openShift?.id,
    });

    return JSON.stringify({
      success: true,
      message: `Gasto de ${fmt(data.amount)} en "${data.description}" cargado correctamente.`,
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || "Error al cargar";
    return JSON.stringify({ success: false, error: msg });
  }
}

// ─── MAIN AI HANDLER ───────────────────────────────────────────────────────────

export async function handleIncomingMessage(
  tenantId: string,
  jid: string,
  text: string,
  customerName?: string
): Promise<string | null> {
  // 1. OBTENER MENÚ REAL DEL TENANT AL INSTANTE
  const products = await prisma.product.findMany({
    where: { tenantId, unitType: 'KG', isAvailable: true, isAvailableForBot: true },
    select: { id: true, name: true, pricePerKg: true },
    orderBy: { name: "asc" },
  });

  const menuTexto = products.map(p => `- ${p.name}: ${fmt(Number(p.pricePerKg))}/kg [ID: ${p.id}]`).join("\n");

  const openShift = await prisma.shift.findFirst({
    where: { tenantId, status: "OPEN" },
  });

  const isOpen = !!openShift;
  const phoneNumber = jid.split('@')[0];
  
  const systemPrompt = isOpen
    ? `Sos el asistente del negocio. Respondé a TODOS los usuarios que escriban. NUNCA rechaces por número de teléfono. NUNCA digas "no estás registrado" ni "no pude identificar tu número".

🥘 PEDIDOS (menú por kg):
MENÚ: ${menuTexto}
- Si piden comida: guialos con el menú, pedí nombre/retiro o delivery/pago, y cuando confirmen ejecutá confirmWaOrder con el ID del producto (ej: cmlz...).

💰 FINANZAS (gastos):
- Si dicen "cargame X de gasto en Y" o "gasto de X en Y" (ej: "500 de nafta", "cargame 3000 en delivery"):
  1. Extraé monto y descripción.
  2. Preguntá: "¿Confirmo: $X en Y?"
  3. Si dicen "si", "dale", "ok" → ejecutá createWaExpense con amount y description.

🚨 REGLAS:
- Usá el ID del producto en confirmWaOrder, NUNCA el nombre.
- Para gastos: description = concepto (nafta, delivery, limpieza, etc), amount = número.`
    : `Local cerrado. Informá horarios con mucha onda. Respondé a todos los usuarios.
Si piden cargar un gasto ("cargame X en Y"), extraé monto y descripción, preguntá "¿Confirmo: $X en Y?" y si confirman ejecutá createWaExpense.`;

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "confirmWaOrder",
        description: "Confirma un pedido de comida en el sistema.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  weightKg: { type: "number" },
                },
                required: ["productId", "weightKg"],
              },
            },
            customerName: { type: "string" },
            isDelivery: { type: "boolean" },
            deliveryAddress: { type: "string" },
            paymentMethod: { type: "string", enum: ["EFECTIVO", "MERCADOPAGO"] },
          },
          required: ["items", "customerName", "isDelivery"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createWaExpense",
        description: "Registra un gasto (caja chica). Usar cuando el usuario confirme un gasto.",
        parameters: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Monto en pesos" },
            description: { type: "string", description: "Concepto: nafta, delivery, limpieza, etc" },
            category: { type: "string", description: "Opcional: categoría del gasto" },
          },
          required: ["amount", "description"],
        },
      },
    },
  ];

  const sanitizedText = sanitizeUserInput(text);
  const history = getHistory(tenantId, jid);
  addToHistory(tenantId, jid, "user", sanitizedText);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.3, // Precisión quirúrgica
    max_tokens: 500,
  });

  const choice = response.choices[0];
  let assistantMessage = choice.message;

  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const functionCalls = assistantMessage.tool_calls.filter(tc => tc.type === "function");

    if (functionCalls.length > 0) {
      const toolResultMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      for (const toolCall of functionCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        let result: string;

        if (toolCall.function.name === "confirmWaOrder") {
          result = await executeConfirmWaOrder(tenantId, jid, args);
        } else if (toolCall.function.name === "createWaExpense") {
          result = await executeCreateWaExpense(tenantId, args);
        } else {
          result = JSON.stringify({ error: "Unknown tool" });
        }

        toolResultMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
      }

      const followUp = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...messages, assistantMessage, ...toolResultMessages],
        temperature: 0.3,
      });

      const finalText = followUp.choices[0].message.content || "";
      addToHistory(tenantId, jid, "assistant", finalText);
      return finalText;
    }
  }

  const finalText = assistantMessage.content || "";
  addToHistory(tenantId, jid, "assistant", finalText);
  return finalText;
}