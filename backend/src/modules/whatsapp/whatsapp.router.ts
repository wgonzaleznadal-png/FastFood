import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requireRole } from "@/middleware/tenantGuard";
import { requireModule } from "@/middleware/moduleGuard";
import { sendMessageSchema, updateSessionSchema } from "./whatsapp.schema";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getConnectionStatus,
  sendMessage,
  listSessions,
  getSession,
  updateSessionState,
  listWhatsAppOrders,
  checkNoReplySessions,
  getMessages,
} from "./whatsapp.service";

const router = Router();
router.use(authenticate);
router.use(requireModule("caja"));

// ─── CONNECTION ───────────────────────────────────────────────────────────────

router.post("/connect", requireRole("OWNER", "MANAGER", "CASHIER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // IMPORTANTE: Solo le pasamos el tenantId, el service se encarga del resto
    const result = await connectWhatsApp(req.auth!.tenantId);
    res.json(result);
  } catch (err) { 
    console.error("[WA Router] Error en /connect:", err);
    next(err); 
  }
});

router.post("/disconnect", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await disconnectWhatsApp(req.auth!.tenantId);
    res.json({ status: "disconnected" });
  } catch (err) { console.error("[WA Router] Error en /disconnect:", err); next(err); }
});

router.get("/status", requireRole("OWNER", "MANAGER", "CASHIER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(getConnectionStatus(req.auth!.tenantId));
  } catch (err) { console.error("[WA Router] Error en /status:", err); next(err); }
});

// ─── SESSIONS (CRM) ──────────────────────────────────────────────────────────

router.get("/sessions", requireRole("OWNER", "MANAGER", "CASHIER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await listSessions(req.auth!.tenantId);
    res.json(sessions);
  } catch (err) { console.error("[WA Router] Error en /sessions:", err); next(err); }
});

router.get("/messages/:jid", requireRole("OWNER", "MANAGER", "CASHIER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jid = decodeURIComponent(String(req.params.jid));
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 100;
    const messages = await getMessages(req.auth!.tenantId, jid, limit);
    res.json(messages);
  } catch (err) { console.error("[WA Router] Error en /messages/:jid:", err); next(err); }
});

router.get("/sessions/:jid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await getSession(req.auth!.tenantId, decodeURIComponent(String(req.params.jid)));
    if (!session) {
      res.status(404).json({ error: "Sesión no encontrada" });
      return;
    }
    res.json(session);
  } catch (err) { console.error("[WA Router] Error en /sessions/:jid:", err); next(err); }
});

router.patch("/sessions", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateSessionSchema.parse(req.body);
    const session = await updateSessionState(req.auth!.tenantId, input.jid, {
      isPaused: input.isPaused,
      chatState: input.chatState,
    });
    res.json(session);
  } catch (err) { console.error("[WA Router] Error en PATCH /sessions:", err); next(err); }
});

// ─── SEND MESSAGE (Human intervention from CRM) ──────────────────────────────

router.post("/send", requireRole("OWNER", "MANAGER", "CASHIER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = sendMessageSchema.parse(req.body);
    await sendMessage(req.auth!.tenantId, input.jid, input.text);

    // Auto-pause bot when human sends from CRM
    await updateSessionState(req.auth!.tenantId, input.jid, { isPaused: true });

    res.json({ sent: true });
  } catch (err) { console.error("[WA Router] Error en /send:", err); next(err); }
});

// ─── REACTIVATE BOT ──────────────────────────────────────────────────────────

router.post("/reactivate", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jid } = req.body;
    if (!jid) {
      res.status(400).json({ error: "jid es requerido" });
      return;
    }
    const session = await updateSessionState(req.auth!.tenantId, jid, { isPaused: false });
    res.json(session);
  } catch (err) { console.error("[WA Router] Error en /reactivate:", err); next(err); }
});

// ─── WHATSAPP ORDERS (filtered by source: WHATSAPP) ──────────────────────────

router.get("/orders/:shiftId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await listWhatsAppOrders(req.auth!.tenantId, String(req.params.shiftId));
    res.json(orders);
  } catch (err) { console.error("[WA Router] Error en /orders:", err); next(err); }
});

// ─── NO_REPLY CHECKER (manual trigger or cron) ──────────────────────────────

router.post("/check-no-reply", requireRole("OWNER", "MANAGER"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await checkNoReplySessions(req.auth!.tenantId);
    res.json({ checked: true });
  } catch (err) { console.error("[WA Router] Error en /check-no-reply:", err); next(err); }
});

export default router;
