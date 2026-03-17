import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

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

// ─── CONVERSATION HISTORY (in-memory per jid, capped) ────────────────────────
const conversationHistory = new Map<string, Array<{ role: "user" | "assistant" | "system"; content: string }>>();
const MAX_HISTORY = 20;

function getHistory(tenantId: string, jid: string) {
  const key = `${tenantId}:${jid}`;
  if (!conversationHistory.has(key)) conversationHistory.set(key, []);
  return conversationHistory.get(key)!;
}

function addToHistory(tenantId: string, jid: string, role: "user" | "assistant", content: string) {
  const history = getHistory(tenantId, jid);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

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
          customerName: data.customerName,
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
          customerName: data.customerName,
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

// ─── MAIN AI HANDLER: PLAZA NADAL "MODO VENDEDOR ELITE" ────────────────────────

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
    ? `Sos el "Mozo Estrella" de Plaza Nadal. Tu objetivo es vender con eficiencia y calidez correntina.

🥘 MENÚ REAL DE HOY (Verdad Absoluta):
${menuTexto}

🚨 REGLAS DE ORO:
1. RECONOCIMIENTO: Si el cliente dice "arroz", se refiere a "Arroz con Pollo". Usá siempre los nombres del menú.
2. STOCK: Los productos de arriba TIENEN stock. No inventes faltantes ni límites de peso.
3. SUGERENCIA GASTRO (Sutil):
   - Para 2 personas: ¿Querés 1 kg o 1.5 kg? 🥘
   - Para 3 personas: ¿Querés 1.5 kg o 2 kg? (Te recomiendo 2 kg para que no falte 😉)
   - El objetivo es vender ese 1/2 kg extra sin ser pesado.

📋 FLUJO DE CIERRE (MÁXIMA VELOCIDAD):
1. Una vez elegidos los productos, mandá esta PLANTILLA:
   "¡Espectacular elección! Para marchar tu pedido ya mismo, completame estos datos:
   - *Nombre*:
   - *¿Retiro o Delivery?*: (Si es delivery, pasame dirección)
   - *Pago*: ¿Efectivo o Mercado Pago?"

2. "TUCS" (IMPACTO INMEDIATO):
   - Cuando tengas todo, hacé el resumen y preguntá "¿Confirmamos?".
   - Si dice "si", "dale", "ok", EJECUTÁ 'confirmWaOrder' DE UNA. No avises que vas a registrar.

🚨 REGLA TÉCNICA: Usá el ID largo (ej: 'cmlz...') en 'confirmWaOrder', NUNCA el nombre.`
    : `Local cerrado. Informá horarios con mucha onda.`;

  // 2. SOLO DEJAMOS LA HERRAMIENTA DE CONFIRMACIÓN (Eliminamos checkAvailability)
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "confirmWaOrder",
        description: "Confirma el pedido en el sistema.",
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
  ];

  const history = getHistory(tenantId, jid);
  addToHistory(tenantId, jid, "user", text);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
  ];

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: isOpen ? tools : undefined,
    tool_choice: isOpen ? "auto" : undefined,
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