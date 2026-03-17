"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Text, Stack, Group, Button, ActionIcon, Badge, Loader, Center,
  Select, TextInput, Paper, ScrollArea, Tooltip, Divider,
} from "@mantine/core";
import Drawer from "@/components/layout/Drawer";
import {
  IconTruck, IconPlus, IconCash, IconCheck, IconUser, IconMapPin,
  IconPhone, IconReceipt, IconCreditCard,
} from "@tabler/icons-react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import { getStatusLabel, getStatusColor } from "@/lib/orderStatus";
import styles from "./DeliveryCommandCenter.module.css";

interface DeliveryOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  deliveryAddress?: string | null;
  deliveryPhone?: string | null;
  lat?: number | null;
  lng?: number | null;
  paymentMethod: string;
  cadetePaidAmount: string;
  cadeteId?: string | null;
  cadete?: { id: string; name: string } | null;
  status: string;
  isPaid?: boolean;
  totalPrice: string;
  totalAmount: string;
  items: Array<{
    id: string;
    product: { id: string; name: string; pricePerKg: string };
    weightKg: string;
    subtotal: string;
  }>;
  createdAt: string;
}

interface Cadete {
  id: string;
  name: string;
  phone?: string | null;
}

interface CadeteSummary {
  pendingOrders: DeliveryOrder[];
  deliveredOrders: DeliveryOrder[];
  totalDebt: number;
}

interface DeliveryCommandCenterProps {
  shiftId: string;
  orders: any[];
  onRefresh: () => void;
  canAssignAndCollect?: boolean;
}

const MAP_CONTAINER = { width: "100%", height: "100%" };
const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 }; // Buenos Aires

export default function DeliveryCommandCenter({ shiftId, orders, onRefresh, canAssignAndCollect = true }: DeliveryCommandCenterProps) {
  
  // 1. El Delivery maneja su propia lista de cadetes
  const [cadetes, setCadetes] = useState<Cadete[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCadetes = useCallback(async () => {
    try {
      const res = await api.get("/api/shifts/cadetes/list");
      setCadetes(res.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCadetes();
  }, [fetchCadetes]);

  // Modales
  const [cadeteModalOpen, setCadeteModalOpen] = useState(false);
  const [newCadeteName, setNewCadeteName] = useState("");
  const [newCadetePhone, setNewCadetePhone] = useState("");
  const [creatingCadete, setCreatingCadete] = useState(false);

  // Rendición drawer
  const [rendicionDrawerOpen, setRendicionDrawerOpen] = useState(false);
  const [selectedCadete, setSelectedCadete] = useState<Cadete | null>(null);
  const [cadeteSummary, setCadeteSummary] = useState<CadeteSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded: mapLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const handleCreateCadete = async () => {
    if (!newCadeteName.trim()) return;
    setCreatingCadete(true);
    try {
      await api.post("/api/shifts/cadetes", {
        name: newCadeteName.trim(),
        phone: newCadetePhone.trim() || undefined,
      });
      notifications.show({ title: "Cadete creado", message: newCadeteName, color: "green" });
      setCadeteModalOpen(false);
      setNewCadeteName("");
      setNewCadetePhone("");
      fetchCadetes(); // Solo recargamos los cadetes internamente
    } catch (err) {
      showApiError(err, "Error al crear cadete");
    } finally {
      setCreatingCadete(false);
    }
  };

  const handleAssignCadete = async (orderId: string, cadeteId: string) => {
    try {
      await api.patch(`/api/shifts/orders/${orderId}/assign-cadete`, { cadeteId });
      notifications.show({ title: "Cadete asignado", message: "Pedido en camino", color: "blue" });
      onRefresh(); // Le avisa al padre que se asignó un pedido para que recargue la lista
    } catch (err) {
      showApiError(err, "Error al asignar cadete");
    }
  };

  const openRendicionDrawer = async (cadete: Cadete) => {
    setSelectedCadete(cadete);
    setRendicionDrawerOpen(true);
    setLoadingSummary(true);
    try {
      const res = await api.get(`/api/shifts/${shiftId}/cadete/${cadete.id}/summary`);
      setCadeteSummary(res.data);
    } catch (err) {
      showApiError(err, "Error al cargar resumen");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleRenderOrder = async (orderId: string, amount: number) => {
    try {
      await api.patch(`/api/shifts/orders/${orderId}/render`, { cadetePaidAmount: amount });
      notifications.show({ title: "Pedido rendido", message: fmt(amount), color: "green" });
      onRefresh(); // Le avisa al padre que un pedido se rindió
      if (selectedCadete) {
        openRendicionDrawer(selectedCadete);
      }
    } catch (err) {
      showApiError(err, "Error al rendir pedido");
    }
  };

  // 1. EL CANDADO: Creamos una lista que SOLO tiene delivery
  const deliveryOnlyOrders = orders.filter((o) => o.isDelivery === true);

  // 2. REEMPLAZÁ LOS FILTROS VIEJOS POR ESTOS:
  const pendingOrders = deliveryOnlyOrders.filter(
    (o) => o.status !== "CANCELLED" && o.status !== "DELIVERED" && !o.cadeteId
  );
  const assignedOrders = deliveryOnlyOrders.filter(
    (o) => o.cadeteId && o.status !== "CANCELLED" && o.status !== "DELIVERED"
  );
  const mapOrders = deliveryOnlyOrders.filter(
    (o) => o.status !== "CANCELLED" && o.status !== "DELIVERED"
  );

  // 3. ACTUALIZÁ LA LÓGICA DE CADETES:
  const activeCadeteIds = [...new Set(deliveryOnlyOrders.filter((o) => o.cadeteId).map((o) => o.cadeteId!))];
  const activeCadetes = cadetes.filter((c) => activeCadeteIds.includes(c.id));

  // 4. REEMPLAZÁ EL GETCADETEDEBT (El sumar.si):
  const getCadeteDebt = (cadeteId: string) => {
    return deliveryOnlyOrders
      .filter(o => 
        o.cadeteId === cadeteId && 
        o.paymentMethod === "EFECTIVO" && 
        !o.isPaid
      )
      .reduce((sum, o) => sum + Number(o.totalAmount || o.totalPrice), 0);
  };

  const getCadeteOrderCount = (cadeteId: string) => {
    return deliveryOnlyOrders.filter(
      (o) => o.cadeteId === cadeteId && o.status !== "CANCELLED"
    ).length;
  };

  // Map center: use first order with coords, or default
  const firstWithCoords = mapOrders.find((o) => o.lat && o.lng);
  const mapCenter = firstWithCoords
    ? { lat: firstWithCoords.lat!, lng: firstWithCoords.lng! }
    : DEFAULT_CENTER;

  // Ya no usamos loading state acá porque el padre se encarga de cargar los datos

  return (
    <div className={styles.deliveryLayout}>
      {/* A. ZONA CENTRAL: MAPA */}
      <div className={styles.mapZone}>
        {apiKey && mapLoaded ? (
          <GoogleMap
            mapContainerStyle={MAP_CONTAINER}
            center={mapCenter}
            zoom={13}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
            }}
          >
            {mapOrders
              .filter((o) => o.lat && o.lng)
              .map((order) => (
                <MarkerF
                  key={order.id}
                  position={{ lat: order.lat!, lng: order.lng! }}
                  label={{
                    text: `#${order.orderNumber}`,
                    color: "#ffffff",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                />
              ))}
          </GoogleMap>
        ) : (
          <div className={styles.mapPlaceholder}>
            <Stack align="center" gap="sm">
              <IconMapPin size={48} color="#999" />
              <Text size="sm" c="dimmed" ta="center">
                {!apiKey
                  ? "Configurá NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para ver el mapa"
                  : "Cargando mapa..."}
              </Text>
              {mapOrders.length > 0 && (
                <Text size="xs" c="dimmed">
                  {mapOrders.length} pedido(s) delivery activo(s)
                </Text>
              )}
            </Stack>
          </div>
        )}
      </div>

      {/* B. COLUMNA DERECHA: ASIGNACIÓN */}
      <div className={styles.assignmentZone}>
        <Text fw={700} size="sm" c="dimmed" mb="sm">
          ASIGNAR PEDIDOS ({pendingOrders.length} pendiente{pendingOrders.length !== 1 ? "s" : ""})
        </Text>
        <ScrollArea style={{ flex: 1 }} offsetScrollbars>
          <Stack gap="xs">
            {pendingOrders.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No hay pedidos delivery pendientes
              </Text>
            ) : (
              pendingOrders.map((order) => (
                <Paper key={order.id} p="sm" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge size="xs" color="orange">#{order.orderNumber}</Badge>
                      <Text size="sm" fw={600}>{order.customerName}</Text>
                    </Group>
                    <Text fw={700} size="sm" c="orange">{fmt(Number(order.totalAmount || order.totalPrice))}</Text>
                  </Group>
                  {order.deliveryAddress && (
                    <Group gap={4} mb="xs">
                      <IconMapPin size={12} color="#999" />
                      <Text size="xs" c="dimmed" lineClamp={1}>{order.deliveryAddress}</Text>
                    </Group>
                  )}
                  {canAssignAndCollect && (
                    <Select
                      size="xs"
                      placeholder="Asignar cadete..."
                      data={cadetes.map((c) => ({ value: c.id, label: c.name }))}
                      onChange={(val) => val && handleAssignCadete(order.id, val)}
                      clearable={false}
                    />
                  )}
                </Paper>
              ))
            )}

            {assignedOrders.length > 0 && (
              <>
                <Text fw={700} size="xs" c="dimmed" mt="md">
                  EN CAMINO ({assignedOrders.length})
                </Text>
                {assignedOrders.map((order) => (
                  <Paper key={order.id} p="sm" radius="md" withBorder style={{ opacity: 0.7 }}>
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Badge size="xs" color="blue">#{order.orderNumber}</Badge>
                        <Text size="sm" fw={600}>{order.customerName}</Text>
                      </Group>
                      <Badge size="xs" variant="light" color="blue">
                        {order.cadete?.name}
                      </Badge>
                    </Group>
                    {canAssignAndCollect && (
                      <Button
                        size="compact-xs"
                        color="green"
                        variant="light"
                        fullWidth
                        leftSection={<IconCheck size={12} />}
                        onClick={async () => {
                          try {
                            await api.patch(`/api/orders/${order.id}/status`, { status: "DELIVERED" });
                            notifications.show({ title: "Completado", message: `Pedido #${order.orderNumber} entregado al moto`, color: "green" });
                            onRefresh();
                          } catch (err) {
                            showApiError(err, "Error al marcar como completado");
                          }
                        }}
                      >
                        Completado
                      </Button>
                    )}
                  </Paper>
                ))}
              </>
            )}
          </Stack>
        </ScrollArea>
      </div>

      {/* C. DOCK INFERIOR: CARDS DE CADETES */}
      <div className={styles.cadeteDock}>
        <ScrollArea type="auto" offsetScrollbars>
          <div className={styles.cadeteCardsRow}>
            {/* Card: Agregar Cadete */}
            {canAssignAndCollect && (
            <Paper
              className={styles.cadeteCardAdd}
              p="md"
              radius="md"
              onClick={() => setCadeteModalOpen(true)}
              style={{ cursor: "pointer" }}
            >
              <Stack align="center" justify="center" gap="xs" style={{ height: "100%" }}>
                <IconPlus size={24} color="#999" />
                <Text size="xs" c="dimmed" fw={600}>+ Agregar Cadete</Text>
              </Stack>
            </Paper>
            )}

            {/* Cards de cadetes activos */}
            {activeCadetes.map((cadete) => {
              const debt = getCadeteDebt(cadete.id);
              const count = getCadeteOrderCount(cadete.id);
              return (
                <Paper key={cadete.id} className="gd-card" p="md" radius="md" style={{ minWidth: 200 }}>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconUser size={16} color="#3b82f6" />
                        <Text fw={700} size="sm">{cadete.name}</Text>
                      </Group>
                      <Badge size="xs" variant="light" color="gray">{count} pedido{count !== 1 ? "s" : ""}</Badge>
                    </Group>
                    {debt > 0 && (
                      <Text fw={800} size="lg" c="orange" ta="center">
                        {fmt(debt)}
                      </Text>
                    )}
                    {debt === 0 && (
                      <Text size="sm" c="dimmed" ta="center">Sin deuda</Text>
                    )}
                    {canAssignAndCollect && (
                      <Button
                        size="xs"
                        variant="light"
                        color="orange"
                        fullWidth
                        leftSection={<IconReceipt size={14} />}
                        onClick={() => openRendicionDrawer(cadete)}
                      >
                        Cobrar / Detalle
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })}

            {/* Cadetes sin pedidos: mostrar solo si hay cadetes registrados sin actividad */}
            {cadetes
              .filter((c) => !activeCadeteIds.includes(c.id))
              .slice(0, 3)
              .map((cadete) => (
                <Paper key={cadete.id} className="gd-card" p="md" radius="md" style={{ minWidth: 180, opacity: 0.5 }}>
                  <Stack gap="xs" align="center" justify="center" style={{ height: "100%" }}>
                    <IconUser size={16} color="#999" />
                    <Text size="xs" c="dimmed" fw={600}>{cadete.name}</Text>
                    <Text size="xs" c="dimmed">Sin pedidos</Text>
                  </Stack>
                </Paper>
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Drawer: Crear Cadete */}
      <Drawer
        opened={cadeteModalOpen}
        onClose={() => setCadeteModalOpen(false)}
        title="Nuevo Cadete"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre"
            placeholder="Ej: Raúl"
            value={newCadeteName}
            onChange={(e) => setNewCadeteName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Teléfono (opcional)"
            placeholder="Ej: 11-2345-6789"
            value={newCadetePhone}
            onChange={(e) => setNewCadetePhone(e.currentTarget.value)}
          />
          <Button
            color="orange"
            fullWidth
            loading={creatingCadete}
            onClick={handleCreateCadete}
            disabled={!newCadeteName.trim()}
            leftSection={<IconPlus size={16} />}
          >
            Crear Cadete
          </Button>
        </Stack>
      </Drawer>

      {/* Drawer: Rendición del Cadete */}
      <Drawer
        opened={rendicionDrawerOpen}
        onClose={() => {
          setRendicionDrawerOpen(false);
          setSelectedCadete(null);
          setCadeteSummary(null);
        }}
        title={selectedCadete ? `Rendición — ${selectedCadete.name}` : "Rendición"}
      >
        {loadingSummary ? (
          <Center h={200}><Loader color="orange" /></Center>
        ) : cadeteSummary ? (
          <Stack gap="md" style={{ height: "100%" }}>
            {/* A. LISTA COMPLETA DE PEDIDOS (Historial del Viaje) */}
            <Text size="sm" fw={700} c="dimmed">HISTORIAL DEL VIAJE</Text>
            <ScrollArea style={{ flex: 1 }} offsetScrollbars>
              <Stack gap="xs">
                {[...cadeteSummary.pendingOrders, ...cadeteSummary.deliveredOrders]
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map((order) => {
                    const isAlreadyPaid = order.status === "PAID";
                    const isPending = !isAlreadyPaid && order.status !== "DELIVERED" && order.paymentMethod === "EFECTIVO";
                    const isDigital = order.paymentMethod !== "EFECTIVO";
                    
                    return (
                      <Paper key={order.id} p="sm" radius="md" withBorder style={{ opacity: (isPending || isAlreadyPaid) ? 1 : 0.6 }}>
                        <Group justify="space-between" mb="xs">
                          <Group gap="xs">
                            <Badge size="xs" color={isAlreadyPaid ? "green" : (isPending ? "orange" : "gray")}>
                              #{order.orderNumber}
                            </Badge>
                            <Text size="sm" fw={600}>{order.customerName}</Text>
                          </Group>
                          <Badge size="xs" color={isDigital ? "blue" : (isAlreadyPaid ? "green" : "orange")} variant="light">
                            {isAlreadyPaid ? "PAGADO EN CAJA" : order.paymentMethod}
                          </Badge>
                        </Group>
                        <Group justify="space-between" align="center">
                          <Text fw={700} size="sm">{fmt(Number(order.totalPrice))}</Text>
                          
                          {isAlreadyPaid ? (
                            <Group gap={4}>
                              <IconCheck size={16} color="#22c55e" />
                              <Text size="xs" c="green" fw={600}>Cobrado</Text>
                            </Group>
                          ) : isDigital ? (
                            order.status === "DELIVERED" ? (
                              <Group gap={4}>
                                <IconCheck size={16} color="#22c55e" />
                                <Text size="xs" c="green" fw={600}>Entregado</Text>
                              </Group>
                            ) : (
                              <Button
                                size="compact-xs"
                                color="blue"
                                variant="light"
                                leftSection={<IconCheck size={12} />}
                                onClick={async () => {
                                  try {
                                    await api.patch(`/api/shifts/orders/${order.id}/render`, { cadetePaidAmount: 0 });
                                    notifications.show({ title: "Pedido entregado", message: "Marcado como entregado", color: "green" });
                                    onRefresh();
                                    if (selectedCadete) {
                                      openRendicionDrawer(selectedCadete);
                                    }
                                  } catch (err) {
                                    showApiError(err, "Error al marcar como entregado");
                                  }
                                }}
                              >
                                Marcar Entregado
                              </Button>
                            )
                          ) : isPending ? (
                            <Button
                              size="compact-xs"
                              color="green"
                              variant="light"
                              leftSection={<IconCash size={12} />}
                              onClick={() => handleRenderOrder(order.id, Number(order.totalPrice))}
                            >
                              Cobrar
                            </Button>
                          ) : (
                            <IconCheck size={16} color="#22c55e" />
                          )}
                        </Group>
                      </Paper>
                    );
                  })}

                {cadeteSummary.pendingOrders.length === 0 && cadeteSummary.deliveredOrders.length === 0 && (
                  <Text size="sm" c="dimmed" ta="center" py="lg">
                    Este cadete no tiene pedidos asignados en este turno.
                  </Text>
                )}
              </Stack>
            </ScrollArea>

            {/* B. RESUMEN FINANCIERO (Bottom Section) */}
            <Divider />
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Envíos Realizados</Text>
                <Text fw={600}>{cadeteSummary.pendingOrders.length + cadeteSummary.deliveredOrders.length}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Total Mercado Pago / Transferencia</Text>
                <Text fw={600} c="blue">
                  {fmt(
                    [...cadeteSummary.pendingOrders, ...cadeteSummary.deliveredOrders]
                      .filter((o) => o.paymentMethod !== "EFECTIVO")
                      .reduce((sum, o) => sum + Number(o.totalPrice), 0)
                  )}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="lg" fw={700}>Total Efectivo a Rendir</Text>
                <Text size="xl" fw={800} c="orange">
                  {fmt(cadeteSummary.totalDebt)}
                </Text>
              </Group>
            </Stack>

            {/* C. BOTÓN DE ACCIÓN GLOBAL */}
            {cadeteSummary.totalDebt > 0 && (
              <Button
                size="lg"
                color="green"
                fullWidth
                leftSection={<IconCash size={20} />}
                onClick={async () => {
                  const toPay = cadeteSummary.pendingOrders.filter(o => o.status !== "PAID");
                  for (const order of toPay) {
                    await handleRenderOrder(order.id, Number(order.totalPrice));
                  }
                }}
              >
                Cobrar Todo (Efectivo) — {fmt(cadeteSummary.totalDebt)}
              </Button>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">No se pudo cargar el resumen.</Text>
        )}
      </Drawer>
    </div>
  );
}