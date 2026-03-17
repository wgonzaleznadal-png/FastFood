"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Text, Stack, Group, Button, ActionIcon, Badge, Loader, Center, Tooltip,
} from "@mantine/core";
import {
  IconBrandWhatsapp, IconSend, IconPlugConnected, IconPlugConnectedX,
  IconRobot, IconPlayerPlay, IconSettings, IconRefresh, IconTruck, IconHome,
} from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import { notifications } from "@mantine/notifications";
import QRCode from "react-qr-code";
import WhatsAppConfigDrawer from "./WhatsAppConfigDrawer";
import ProductAvailabilityDrawer from "./ProductAvailabilityDrawer";
import styles from "./WhatsAppCommandCenter.module.css";

interface WaSession {
  id: string;
  jid: string;
  customerName: string | null;
  chatState: "TALKING" | "PENDING" | "COMPLETED" | "NO_REPLY";
  isPaused: boolean;
  lastMessage: string | null;
  lastInteractionAt: string;
}

interface WaOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  isDelivery: boolean;
  status: string;
  totalAmount: string;
  paymentMethod: string;
  items: Array<{
    id: string;
    product: { name: string; pricePerKg: string };
    weightKg: string;
    subtotal: string;
  }>;
}

interface Props {
  shiftId: string;
}

const STATE_COLORS: Record<string, string> = {
  TALKING: "cyan",
  PENDING: "yellow",
  COMPLETED: "green",
  NO_REPLY: "red",
};

const STATE_LABELS: Record<string, string> = {
  TALKING: "Conversando",
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  NO_REPLY: "Sin respuesta",
};

function stateClass(s: WaSession) {
  if (s.isPaused) return styles.statePaused;
  switch (s.chatState) {
    case "TALKING": return styles.stateTalking;
    case "PENDING": return styles.statePending;
    case "COMPLETED": return styles.stateCompleted;
    case "NO_REPLY": return styles.stateNoReply;
    default: return "";
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string | null, jid: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  return jid.slice(0, 2);
}

interface WaMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: string;
}

export default function WhatsAppCommandCenter({ shiftId }: Props) {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<WaSession[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [orders, setOrders] = useState<WaOrder[]>([]);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [connStatus, setConnStatus] = useState<string>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [productsDrawerOpen, setProductsDrawerOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await api.get("/whatsapp/status");
      setConnStatus(r.data.status || "disconnected");
      setQrCode(r.data.qr || null);
    } catch { /* backend caído — no cambiar estado */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const r = await api.get("/whatsapp/sessions");
      setSessions(r.data);
    } catch { /* silent */ }
  }, []);

  const fetchMessages = useCallback(async (jid: string) => {
    try {
      const r = await api.get(`/whatsapp/messages/${encodeURIComponent(jid)}`);
      setMessages(r.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { /* silent */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await api.get(`/whatsapp/orders/${shiftId}`);
      setOrders(r.data);
    } catch { /* silent */ }
  }, [shiftId]);

  useEffect(() => {
    if (selectedJid) {
      fetchMessages(selectedJid);
    }
  }, [selectedJid, fetchMessages]);

  useEffect(() => {
    let filtered = sessions;
    if (searchQuery) {
      filtered = filtered.filter(s => 
        (s.customerName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.jid.includes(searchQuery) ||
        (s.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (stateFilter) {
      if (stateFilter === "PAUSED") {
        filtered = filtered.filter(s => s.isPaused);
      } else {
        filtered = filtered.filter(s => s.chatState === stateFilter && !s.isPaused);
      }
    }
    setFilteredSessions(filtered);
  }, [sessions, searchQuery, stateFilter]);

  // Initial fetch on mount
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Polling adaptativo según estado de conexión
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (connStatus === "open") {
      // Conectado: poll sesiones + pedidos cada 5s
      fetchSessions();
      fetchOrders();
      if (selectedJid) fetchMessages(selectedJid);
      pollRef.current = setInterval(() => {
        fetchSessions();
        fetchOrders();
        fetchStatus();
        if (selectedJid) fetchMessages(selectedJid);
      }, 2000);
    } else if (connStatus === "connecting") {
      // Esperando QR: poll rápido cada 2s para recibir el QR lo antes posible
      pollRef.current = setInterval(() => {
        fetchStatus();
      }, 2000);
    } else {
      // Desconectado: poll lento cada 15s
      pollRef.current = setInterval(() => {
        fetchStatus();
      }, 15000);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connStatus, selectedJid, fetchStatus, fetchSessions, fetchOrders, fetchMessages]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const r = await api.post("/whatsapp/connect");
      setConnStatus(r.data.status || "connecting");
      setQrCode(r.data.qr || null);
      if (r.data.status === "open") {
        notifications.show({ title: "WhatsApp", message: "Conectado", color: "green" });
      }
    } catch (err) { showApiError(err, "Error al conectar"); }
    finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    try {
      await api.post("/whatsapp/disconnect");
      setConnStatus("disconnected");
      setQrCode(null);
    } catch (err) { showApiError(err, "Error al desconectar"); }
  };

  const handleSend = async () => {
    if (!selectedJid || !inputText.trim()) return;
    setSending(true);
    try {
      await api.post("/whatsapp/send", { jid: selectedJid, text: inputText.trim() });
      setInputText("");
      notifications.show({ title: "Enviado", message: "Mensaje enviado. Bot pausado.", color: "blue" });
      fetchSessions();
      fetchMessages(selectedJid);
    } catch (err) { showApiError(err, "Error al enviar"); }
    finally { setSending(false); }
  };

  const handleReactivate = async (jid: string) => {
    try {
      await api.post("/whatsapp/reactivate", { jid });
      notifications.show({ title: "Bot reactivado", message: "La IA retomó el control", color: "green" });
      fetchSessions();
    } catch (err) { showApiError(err, "Error al reactivar"); }
  };

  const selectedSession = sessions.find((s) => s.jid === selectedJid);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (connStatus !== "open") {
    return (
      <div className={styles.connectionBanner}>
        <IconBrandWhatsapp size={64} color="#25D366" />
        <Text size="lg" fw={600}>WhatsApp CRM</Text>
        <Text size="sm" c="dimmed" maw={400}>
          Conectá tu WhatsApp para activar el telefonista virtual. Escaneá el QR desde la app de WhatsApp del local.
        </Text>
        {qrCode && (
          <div className={styles.qrContainer}>
            <Text size="xs" c="dimmed" mb="xs" ta="center">Escaneá este código QR con WhatsApp</Text>
            <div style={{ background: "white", padding: 16, borderRadius: 8 }}>
              <QRCode value={qrCode} size={220} />
            </div>
          </div>
        )}
        <Button
          leftSection={connecting ? <Loader size={16} color="white" /> : <IconPlugConnected size={18} />}
          color="green"
          size="lg"
          onClick={handleConnect}
          loading={connecting}
        >
          {connecting ? "Conectando..." : connStatus === "connecting" ? "Esperando escaneo..." : "Conectar WhatsApp"}
        </Button>
        <Button variant="subtle" size="xs" color="gray" onClick={() => setConfigOpen(true)} leftSection={<IconSettings size={14} />}>
          Configuración
        </Button>
        <WhatsAppConfigDrawer opened={configOpen} onClose={() => setConfigOpen(false)} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ─── COL 1: Chat List ──────────────────────────────────────────────── */}
      <div className={styles.chatList}>
        <div className={styles.chatListHeader}>
          <div className={styles.chatListHeaderTop}>
            <Text size="xs" fw={700} c="dimmed">CHATS</Text>
            <div className={styles.chatListHeaderActions}>
              <Tooltip label="Productos">
                <ActionIcon variant="subtle" size="sm" color="orange" onClick={() => setProductsDrawerOpen(true)}>
                  <IconSettings size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Desconectar">
                <ActionIcon variant="subtle" size="sm" color="red" onClick={handleDisconnect}>
                  <IconPlugConnectedX size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Configuración">
                <ActionIcon variant="subtle" size="sm" onClick={() => setConfigOpen(true)}>
                  <IconSettings size={14} />
                </ActionIcon>
              </Tooltip>
              <ActionIcon variant="subtle" size="sm" onClick={fetchSessions}>
                <IconRefresh size={14} />
              </ActionIcon>
            </div>
          </div>
          
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <div className={styles.stateFilters}>
            <button
              className={`${styles.stateFilterBtn} ${!stateFilter ? styles.active : ""}`}
              onClick={() => setStateFilter(null)}
            >
              Todos
            </button>
            <button
              className={`${styles.stateFilterBtn} ${stateFilter === "TALKING" ? styles.active : ""}`}
              onClick={() => setStateFilter("TALKING")}
            >
              Activos
            </button>
            <button
              className={`${styles.stateFilterBtn} ${stateFilter === "PENDING" ? styles.active : ""}`}
              onClick={() => setStateFilter("PENDING")}
            >
              Pendientes
            </button>
            <button
              className={`${styles.stateFilterBtn} ${stateFilter === "PAUSED" ? styles.active : ""}`}
              onClick={() => setStateFilter("PAUSED")}
            >
              Pausados
            </button>
          </div>
        </div>
        
        <div className={styles.chatListScroll}>
          {filteredSessions.length === 0 ? (
            <div className={styles.emptyChats}>
              <IconBrandWhatsapp size={32} opacity={0.3} />
              <Text size="xs" c="dimmed">{searchQuery || stateFilter ? "Sin resultados" : "Sin conversaciones"}</Text>
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.jid}
                className={`${styles.chatItem} ${selectedJid === s.jid ? styles.chatItemActive : ""}`}
                onClick={() => { setSelectedJid(s.jid); setTimeout(() => inputRef.current?.focus(), 100); }}
              >
                <div className={styles.chatAvatar}>{getInitials(s.customerName, s.jid)}</div>
                <div className={styles.chatInfo}>
                  <span className={styles.chatName}>{s.customerName || s.jid.split("@")[0]}</span>
                  <span className={styles.chatPreview}>{s.lastMessage || "..."}</span>
                </div>
                <div className={styles.chatMeta}>
                  <span className={styles.chatTime}>{formatTime(s.lastInteractionAt)}</span>
                  <Tooltip label={s.isPaused ? "Pausado" : STATE_LABELS[s.chatState]}>
                    <span className={`${styles.statePill} ${stateClass(s)}`} />
                  </Tooltip>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── COL 2: Chat Viewport ──────────────────────────────────────────── */}
      <div className={styles.chatViewport}>
        {!selectedSession ? (
          <div className={styles.emptyViewport}>
            <IconBrandWhatsapp size={48} opacity={0.2} />
            <Text size="sm" c="dimmed">Seleccioná un chat para ver la conversación</Text>
          </div>
        ) : (
          <>
            <div className={styles.viewportHeader}>
              <div className={styles.viewportHeaderInfo}>
                <div className={styles.chatAvatar}>{getInitials(selectedSession.customerName, selectedSession.jid)}</div>
                <div>
                  <Text size="sm" fw={600}>{selectedSession.customerName || selectedSession.jid.split("@")[0]}</Text>
                  <Group gap={4}>
                    <Badge size="xs" color={STATE_COLORS[selectedSession.chatState]} variant="light">
                      {STATE_LABELS[selectedSession.chatState]}
                    </Badge>
                    {selectedSession.isPaused && (
                      <Badge size="xs" color="gray" variant="light">Bot pausado</Badge>
                    )}
                  </Group>
                </div>
              </div>
              <div className={styles.viewportHeaderActions}>
                {selectedSession.isPaused ? (
                  <Tooltip label="Reactivar bot">
                    <ActionIcon color="green" variant="light" onClick={() => handleReactivate(selectedSession.jid)}>
                      <IconPlayerPlay size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : (
                  <Tooltip label="Bot activo">
                    <ActionIcon color="cyan" variant="light" disabled>
                      <IconRobot size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className={styles.messagesArea}>
              {messages.length === 0 ? (
                <div className={`${styles.messageBubble} ${styles.messageSystem}`}>
                  Sin mensajes en este chat
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`${styles.messageBubble} ${msg.fromMe ? styles.messageOutgoing : styles.messageIncoming}`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <input
                ref={inputRef}
                className={styles.inputField}
                placeholder="Escribí un mensaje (se pausa el bot)..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={sending}
              />
              <ActionIcon
                color="green"
                size="lg"
                variant="filled"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                loading={sending}
              >
                <IconSend size={18} />
              </ActionIcon>
            </div>
          </>
        )}
      </div>

      {/* ─── COL 3: Orders Sidebar ─────────────────────────────────────────── */}
      <div className={styles.ordersSidebar}>
        <div className={styles.sidebarHeader}>
          <Text size="xs" fw={700} c="dimmed">PEDIDOS WPP</Text>
          <ActionIcon variant="subtle" size="sm" onClick={fetchOrders}><IconRefresh size={14} /></ActionIcon>
        </div>
        <div className={styles.sidebarScroll}>
          {orders.length === 0 ? (
            <div className={styles.emptyOrders}>
              <IconBrandWhatsapp size={32} opacity={0.3} />
              <Text size="xs" c="dimmed">Sin pedidos de WhatsApp en este turno</Text>
            </div>
          ) : (
            orders.map((o) => (
              <div key={o.id} className={styles.orderCard}>
                <div className={styles.orderCardHeader}>
                  <Group gap={4}>
                    <Text size="xs" fw={700}>#{o.orderNumber}</Text>
                    <Text size="xs" c="dimmed">{o.customerName}</Text>
                  </Group>
                  <Group gap={4}>
                    <Badge size="xs" color={o.isDelivery ? "orange" : "blue"} variant="light">
                      {o.isDelivery ? <><IconTruck size={10} /> Envío</> : <><IconHome size={10} /> Retiro</>}
                    </Badge>
                    <Badge size="xs" color={o.status === "PAID" ? "green" : o.status === "PENDING" ? "orange" : "gray"}>
                      {o.status === "PAID" ? "Pagado" : o.status === "PENDING" ? "Pendiente" : o.status}
                    </Badge>
                  </Group>
                </div>
                <div className={styles.orderCardItems}>
                  {o.items.map((item) => (
                    <Text key={item.id} size="xs" c="dimmed">
                      {item.product.name} — {item.weightKg}kg — {fmt(Number(item.subtotal))}
                    </Text>
                  ))}
                </div>
                <div className={styles.orderCardTotal}>
                  <Text size="xs" c="dimmed">{o.paymentMethod}</Text>
                  <Text size="sm" fw={700} c="orange">{fmt(Number(o.totalAmount))}</Text>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <WhatsAppConfigDrawer opened={configOpen} onClose={() => setConfigOpen(false)} />
      <ProductAvailabilityDrawer opened={productsDrawerOpen} onClose={() => setProductsDrawerOpen(false)} />
    </div>
  );
}
