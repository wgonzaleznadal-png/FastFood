import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  WAMessageContent,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { prisma } from "@/lib/prisma";
import { createError } from "@/middleware/errorHandler";
import { handleIncomingMessage } from "./whatsapp.ai";
import path from "path";
import fs from "fs";

// ─── STORES EN MEMORIA ────────────────────────────────────────────────────────
const sockets = new Map<string, WASocket>();
const qrCodes = new Map<string, string>();
const pairingCodes = new Map<string, string>();
const connectionStates = new Map<string, "disconnected" | "connecting" | "open">();
const retryCounters = new Map<string, number>();
const MAX_RETRIES = 5;

const AUTH_BASE = path.resolve(process.cwd(), ".wa-auth");

function getAuthDir(tenantId: string) {
  if (!/^c[a-z0-9]{24,}$/.test(tenantId)) {
    throw new Error("Invalid tenant ID format");
  }
  const dir = path.join(AUTH_BASE, tenantId);
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(path.resolve(AUTH_BASE))) {
    throw new Error("Path traversal detected");
  }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function log(tenantId: string, msg: string) {
  console.log(`[WA:${tenantId}] ${msg}`);
}

// ─── CONEXIÓN PRINCIPAL (NO BLOQUEANTE) ──────────────────────────────────────
export async function connectWhatsApp(tenantId: string, phoneNumber?: string): Promise<{ qr?: string; pairingCode?: string; status: string }> {
  // Si ya existe un socket, devolver estado actual
  if (sockets.has(tenantId)) {
    const state = connectionStates.get(tenantId);
    if (state === "open") return { status: "open" };
    if (state === "connecting") {
      return {
        status: "connecting",
        qr: qrCodes.get(tenantId),
        pairingCode: pairingCodes.get(tenantId),
      };
    }
  }

  log(tenantId, "Iniciando conexión...");
  connectionStates.set(tenantId, "connecting");
  retryCounters.set(tenantId, 0);

  // Lanzar la conexión en background (NO await bloqueante)
  _startSocket(tenantId, phoneNumber).catch((err) => {
    console.error(`[WA:${tenantId}] Error fatal al iniciar socket:`, err);
    connectionStates.set(tenantId, "disconnected");
  });

  // Retornar inmediatamente — el frontend pollea /status para recibir el QR o pairing code
  return { status: "connecting" };
}

async function _startSocket(tenantId: string, phoneNumber?: string) {
  console.log(`[WA:${tenantId}] 🚀 _startSocket iniciado`);
  const authDir = getAuthDir(tenantId);
  if (process.env.NODE_ENV === "development") {
    console.log(`[WA:${tenantId}] Auth dir: ${authDir}`);
  }
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    version: [2, 3000, 1033893291], 
    browser: ["Windows", "Chrome", "20.0.0446"],
    printQRInTerminal: false,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: undefined,
    keepAliveIntervalMs: 10_000,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  console.log(`[WA:${tenantId}] Socket creado, registrando event listeners...`);

  // Si se provee número de teléfono, usar pairing code en lugar de QR
  if (phoneNumber && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        pairingCodes.set(tenantId, code);
        if (process.env.NODE_ENV === "development") {
          log(tenantId, `📱 Pairing code generado: ${code}`);
        }
      } catch (err) {
        console.error(`[WA:${tenantId}] Error al generar pairing code:`, err);
      }
    }, 3000);
  }

  sockets.set(tenantId, sock);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    log(tenantId, `connection.update → connection=${connection ?? "-"}, qr=${qr ? "RECIBIDO" : "-"}`);

    if (qr) {
      qrCodes.set(tenantId, qr);
      pairingCodes.delete(tenantId);
      connectionStates.set(tenantId, "connecting");
      log(tenantId, "📱 QR disponible — escaneá desde WhatsApp o desde el frontend");
    }

    if (connection === "close") {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const errorMsg = (lastDisconnect?.error as Boom)?.message || "desconocido";
      log(tenantId, `❌ Conexión cerrada. Razón: ${reason} (${errorMsg})`);

      connectionStates.set(tenantId, "disconnected");
      qrCodes.delete(tenantId);
      pairingCodes.delete(tenantId);
      sockets.delete(tenantId);

      if (reason === DisconnectReason.loggedOut) {
        log(tenantId, "Sesión cerrada por el usuario. Limpiando auth...");
        fs.rmSync(authDir, { recursive: true, force: true });
        retryCounters.delete(tenantId);
        return;
      }

      // Reconexión con límite de intentos
      const retries = (retryCounters.get(tenantId) ?? 0) + 1;
      retryCounters.set(tenantId, retries);

      if (retries > MAX_RETRIES) {
        log(tenantId, `⛔ Se superó el límite de ${MAX_RETRIES} reintentos. Limpiando auth y deteniendo.`);
        fs.rmSync(authDir, { recursive: true, force: true });
        retryCounters.delete(tenantId);
        return;
      }

      const delay = Math.min(retries * 3000, 15000);
      log(tenantId, `🔄 Reintento ${retries}/${MAX_RETRIES} en ${delay / 1000}s...`);
      setTimeout(() => _startSocket(tenantId, phoneNumber), delay);
    }

    if (connection === "open") {
      connectionStates.set(tenantId, "open");
      qrCodes.delete(tenantId);
      pairingCodes.delete(tenantId);
      retryCounters.delete(tenantId);
      log(tenantId, "✅ ¡WhatsApp Conectado!");
    }
  });

  console.log(`[WA:${tenantId}] ✅ Registrando listener de messages.upsert`);
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[WA:${tenantId}] 📨 messages.upsert event - type: ${type}, count: ${messages.length}`);
    if (type !== "notify") {
      console.log(`[WA:${tenantId}] Tipo ${type} ignorado (solo procesamos 'notify')`);
      return;
    }
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (process.env.NODE_ENV === "development") {
        console.log(`[WA:${tenantId}] Procesando mensaje de ${jid}, fromMe: ${msg.key.fromMe}`);
      }
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") {
        console.log(`[WA:${tenantId}] Mensaje ignorado (grupo o broadcast)`);
        continue;
      }

      // Mensajes enviados desde el teléfono del negocio
      if (msg.key.fromMe) {
        const text = extractText(msg.message);
        if (process.env.NODE_ENV === "development") {
          console.log(`[WA:${tenantId}] Mensaje del operador: ${text?.substring(0, 50)}`);
        }
        if (text) await handleOperatorMessage(tenantId, jid, text);
        continue;
      }

      const text = extractText(msg.message);
      const pushName = msg.pushName || "Cliente";
      if (process.env.NODE_ENV === "development") {
        console.log(`[WA:${tenantId}] 💬 Mensaje de cliente ${pushName} (${jid}): ${text?.substring(0, 50)}`);
      }


      // Mensaje NO de texto (audio, imagen, sticker, etc.) → rechazo amable
      if (!text) {
        await sendMessage(tenantId, jid,
          "¡Hola! Por el momento solo puedo leer mensajes de texto. " +
          "¿Podrías escribirme lo que necesitás? 😊"
        );
        continue;
      }

      // IMPORTANTE: Crear/actualizar la sesión ANTES de guardar el mensaje (foreign key)
      const session = await prisma.waSessionState.upsert({
        where: { tenantId_jid: { tenantId, jid } },
        update: { lastMessage: text.substring(0, 200), lastInteractionAt: new Date(), chatState: "TALKING" },
        create: { tenantId, jid, lastMessage: text.substring(0, 200), chatState: "TALKING" },
      });

      // Ahora sí guardamos el mensaje (la sesión ya existe)
      await (prisma as any).waMessage.create({
        data: { tenantId, jid, fromMe: false, text },
      });

      if (session.isPaused) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[WA:${tenantId}] ⏸️  Chat ${jid} pausado (humano). Ignorando AI.`);
        }
        continue;
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`[WA:${tenantId}] 🤖 Llamando a la IA para responder...`);
      }
      try {
        const aiResponse = await handleIncomingMessage(tenantId, jid, text, pushName);
        if (process.env.NODE_ENV === "development") {
          console.log(`[WA:${tenantId}] 📤 Respuesta de IA: ${aiResponse?.substring(0, 100)}`);
        }
        if (aiResponse) await sendMessage(tenantId, jid, aiResponse);
      } catch (err) {
        console.error(`[WA:${tenantId}] ❌ AI Error para ${jid}:`, err);
        await sendMessage(tenantId, jid, "Disculpá, tuve un problema técnico. Probá de nuevo en un momento. 🙏").catch(() => {});
      }
    }
  });
}

// ─── HELPERS Y QUERIES ────────────────────────────────────────────────────────
export async function handleOperatorMessage(tenantId: string, jid: string, text: string) {
  const lower = text.toLowerCase().trim();
  const isPaused = lower !== "asistente";
  await prisma.waSessionState.upsert({
    where: { tenantId_jid: { tenantId, jid } },
    update: { isPaused, lastMessage: isPaused ? text.substring(0, 200) : "[Bot reactivado]", lastInteractionAt: new Date() },
    create: { tenantId, jid, isPaused, lastMessage: text.substring(0, 200) },
  });
}

export async function sendMessage(tenantId: string, jid: string, text: string) {
  const sock = sockets.get(tenantId);
  if (!sock) throw createError("WhatsApp no conectado", 503);
  await sock.sendMessage(jid, { text });
  
  await (prisma as any).$transaction([
    (prisma as any).waMessage.create({
      data: { tenantId, jid, fromMe: true, text },
    }),
    (prisma as any).waSessionState.upsert({
      where: { tenantId_jid: { tenantId, jid } },
      update: { lastMessage: text.substring(0, 200), lastInteractionAt: new Date() },
      create: { tenantId, jid, lastMessage: text.substring(0, 200) },
    }),
  ]);
}

function extractText(message: WAMessageContent | null | undefined): string | null {
  if (!message) return null;
  return message.conversation || message.extendedTextMessage?.text || null;
}

export async function listSessions(tenantId: string) {
  return prisma.waSessionState.findMany({ where: { tenantId }, orderBy: { lastInteractionAt: "desc" } });
}

export async function getSession(tenantId: string, jid: string) {
  return prisma.waSessionState.findUnique({ where: { tenantId_jid: { tenantId, jid } } });
}

export async function updateSessionState(tenantId: string, jid: string, data: any) {
  return prisma.waSessionState.update({
    where: { tenantId_jid: { tenantId, jid } },
    data: { ...data, lastInteractionAt: new Date() },
  });
}

export function getConnectionStatus(tenantId: string) {
  return {
    status: connectionStates.get(tenantId) || "disconnected",
    qr: qrCodes.get(tenantId),
    pairingCode: pairingCodes.get(tenantId),
  };
}

export async function disconnectWhatsApp(tenantId: string) {
  console.log(`[WA:${tenantId}] 🔌 DESCONECTANDO WhatsApp...`);
  const sock = sockets.get(tenantId);
  if (!sock) {
    console.log(`[WA:${tenantId}] ⚠️  No hay socket para desconectar`);
    throw createError("WhatsApp no conectado", 404);
  }
  console.log(`[WA:${tenantId}] Ejecutando logout...`);
  await sock.logout();
  console.log(`[WA:${tenantId}] Limpiando maps...`);
  sockets.delete(tenantId);
  connectionStates.delete(tenantId);
  qrCodes.delete(tenantId);
  pairingCodes.delete(tenantId);
  retryCounters.delete(tenantId);
  console.log(`[WA:${tenantId}] ✅ Desconectado y sesión eliminada.`);
}

export async function listWhatsAppOrders(tenantId: string, shiftId: string) {
  const orders = await prisma.order.findMany({
    where: { tenantId, shiftId, source: "WHATSAPP" },
    include: {
      cadete: true,
      items: { include: { product: { select: { id: true, name: true, pricePerKg: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    ...o,
    totalPrice: o.totalPrice.toString(),
    cadetePaidAmount: o.cadetePaidAmount.toString(),
    totalAmount: o.totalPrice.toString(),
    items: o.items.map((item) => ({
      ...item,
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      subtotal: item.subtotal.toString(),
      product: item.product ? {
        ...item.product,
        pricePerKg: item.product.pricePerKg?.toString() ?? "0",
      } : null,
    })),
  }));
}

export async function checkNoReplySessions(tenantId: string) {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.waSessionState.updateMany({
    where: { tenantId, chatState: "TALKING", isPaused: false, lastInteractionAt: { lt: tenMinAgo } },
    data: { chatState: "NO_REPLY" },
  });
}

export async function getMessages(tenantId: string, jid: string, limit = 100) {
  return (prisma as any).waMessage.findMany({
    where: { tenantId, jid },
    orderBy: { timestamp: "asc" },
    take: limit,
  });
}