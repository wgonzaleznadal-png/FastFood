"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, Card, Badge, Button, Group, Stack, Text, Grid, Center, Loader, SimpleGrid, Divider } from "@mantine/core";
import { IconChefHat, IconGlass, IconCheck, IconClock, IconFlame, IconBike, IconWalk, IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api, showApiError } from "@/lib/api";
import PageHeader from "@/components/layout/PageHeader";

// ─── INTERFACES ────────────────────────────────────────────────────────
interface KitchenOrderItem {
  id: string;
  quantity?: string;
  weightKg?: string;
  notes?: string;
  product: {
    name: string;
    unitType: string;
    preparationTime?: number;
    destination?: string;
  };
}

interface KitchenOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  status: "PENDING" | "IN_PROGRESS" | "READY";
  isDelivery: boolean;
  createdAt: string;
  notes?: string;
  items: KitchenOrderItem[];
}

interface KitchenStats {
  pending: number;
  inProgress: number;
  ready: number;
  total: number;
}

interface ProductKilo {
  name: string;
  totalKg: number;
}

export default function CocinaPage() {
  const [activeTab, setActiveTab] = useState<string>("KITCHEN");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [stats, setStats] = useState<KitchenStats>({ pending: 0, inProgress: 0, ready: 0, total: 0 });
  const [productKilos, setProductKilos] = useState<ProductKilo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const station = activeTab === "KITCHEN" ? "COCINA" : "BARRA";
      const [statsRes, listRes] = await Promise.all([
        api.get(`/orders/kitchen/stats`),
        api.get(`/orders/kitchen/list?station=${station}`)
      ]);
      setStats(statsRes.data.stats);
      setProductKilos(statsRes.data.productKilos);
      setOrders(listRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      notifications.show({
        title: "Comanda actualizada",
        message: newStatus === "IN_PROGRESS" ? "El pedido pasó a preparación" : "El pedido está listo",
        color: newStatus === "IN_PROGRESS" ? "blue" : "green",
      });
      fetchDashboardData();
    } catch (error) {
      showApiError(error);
    }
  };

  return (
    <div>
      <PageHeader>
        <Tabs value={activeTab} onChange={(value) => { setLoading(true); setActiveTab(value || "KITCHEN"); }} variant="pills">
          <Tabs.List>
            <Tabs.Tab value="KITCHEN" leftSection={<IconChefHat size={16} />}>Cocina</Tabs.Tab>
            <Tabs.Tab value="BAR" leftSection={<IconGlass size={16} />}>Barra</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </PageHeader>

      {/* 1. KILAJE: EQUILIBRIO TOTAL Y OPTIMIZACIÓN DE ESPACIO */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb="xl">
        {["Arroz con Pollo", "Paella"].map((prodName) => {
          const data = productKilos.find(pk => pk.name === prodName) || { name: prodName, totalKg: 0 };
          return (
            <Card key={prodName} withBorder radius="md" padding="md" shadow="sm">
              <Group justify="space-between" align="center">
                <Text size="md" fw={500} c="dimmed" style={{ letterSpacing: '0.5px' }}>
                  {data.name}
                </Text>
                <Group gap={6} align="baseline">
                  <Text size="28px" fw={700} c="orange" style={{ lineHeight: 1 }}>
                    {data.totalKg.toFixed(1)}
                  </Text>
                  <Text size="sm" c="dimmed" fw={500}>
                    kg
                  </Text>
                </Group>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      {/* 2. TABLERO KANBAN LIMPIO */}
      {loading ? (
        <Center h={200}><Loader color="orange" /></Center>
      ) : (
        <Grid gutter="xl">
          {/* PENDIENTES */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dimmed">PENDIENTES</Text>
              <Badge color="gray" variant="light">{stats.pending}</Badge>
            </Group>
            <Divider mb="md" />
            <Stack gap="md">
              {orders.filter(o => o.status === "PENDING").map(order => (
                <OrderCard key={order.id} order={order} onAction={() => handleUpdateStatus(order.id, "IN_PROGRESS")} />
              ))}
            </Stack>
          </Grid.Col>

          {/* EN PREPARACIÓN */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dimmed">EN PREPARACIÓN</Text>
              <Badge color="gray" variant="light">{stats.inProgress}</Badge>
            </Group>
            <Divider mb="md" />
            <Stack gap="md">
              {orders.filter(o => o.status === "IN_PROGRESS").map(order => (
                <OrderCard key={order.id} order={order} onAction={() => handleUpdateStatus(order.id, "READY")} isMarchando />
              ))}
            </Stack>
          </Grid.Col>

          {/* LISTOS */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Group justify="space-between" mb="sm">
              <Text size="sm" fw={600} c="dimmed">LISTOS</Text>
              <Badge color="gray" variant="light">{stats.ready}</Badge>
            </Group>
            <Divider mb="md" />
            <Stack gap="md">
              {orders.filter(o => o.status === "READY").map(order => (
                <OrderCard key={order.id} order={order} isReady />
              ))}
            </Stack>
          </Grid.Col>
        </Grid>
      )}
    </div>
  );
}

// ─── TARJETA CON ESTILO GASTRODASH ───────────────────────────────────

function OrderCard({ order, onAction, isMarchando, isReady }: { order: KitchenOrder, onAction?: () => void, isMarchando?: boolean, isReady?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  // Tiempo de cocción base o 15m por defecto
  const prepTime = order.items.reduce((max, i) => Math.max(max, i.product?.preparationTime || 15), 0);

  useEffect(() => {
    const calc = () => {
      const diff = new Date().getTime() - new Date(order.createdAt).getTime();
      setElapsed(Math.floor(diff / 60000));
    };
    calc();
    const interval = setInterval(calc, 20000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  // LÓGICA DE FIEBRE SUAVE (Estilo Mantine)
  const progress = elapsed / prepTime;
  let bgValue = undefined;
  let pillColor = "gray";

  if (!isReady) {
    if (progress >= 1) {
      bgValue = "red.0"; // Un rojo pastel muy suave de fondo
      pillColor = "red";
    } else if (progress >= 0.75) {
      bgValue = "orange.0"; // Un naranja pastel de alerta
      pillColor = "orange";
    } else if (order.status === "PENDING" && progress >= 0.33) {
      bgValue = "yellow.0"; // Un amarillo crema
    }
  }

  return (
    <Card withBorder shadow="sm" radius="md" padding="md" bg={bgValue}>
      <Stack gap="md">
        
        {/* HEADER: # Y NOMBRE */}
        <div>
          <Group justify="space-between" wrap="nowrap" align="center">
            <Text fw={700} size="lg" truncate>
              #{order.orderNumber} {order.customerName}
            </Text>
          </Group>
          <Group gap="xs" mt={4}>
            <Badge 
              variant="dot" 
              color={order.isDelivery ? "blue" : "gray"} 
              size="sm"
            >
              {order.isDelivery ? "Delivery" : "Retiro"}
            </Badge>
            {order.notes && order.notes.includes("[RE-IMPRESIÓN") && (
              <Badge color="red" variant="light" size="sm" leftSection={<IconAlertCircle size={12}/>}>
                Modificada
              </Badge>
            )}
          </Group>
        </div>

        {/* LISTA DE PRODUCTOS (Limpia, sin cards anidadas) */}
        <Stack gap={6}>
          {order.items.map(item => (
            <div key={item.id}>
              <Text fw={600} size="sm">
                {item.quantity}x {item.product?.name}
              </Text>
              {item.notes && <Text size="xs" c="red" fw={500} mt={2}>* {item.notes}</Text>}
            </div>
          ))}
        </Stack>

        {/* FOOTER: TIMER SUTIL Y BOTÓN */}
        <Group justify="space-between" align="center" mt="xs">
          <Badge 
            variant="light" 
            color={pillColor} 
            radius="md" 
            size="md" 
            leftSection={<IconClock size={12} />}
            style={{ textTransform: 'lowercase' }}
          >
            {elapsed} min
          </Badge>
          
          {onAction && (
            <Button 
              size="xs" 
              variant="light"
              color={isMarchando ? "green" : "blue"} 
              onClick={onAction}
            >
              {isMarchando ? "Marcar Listo" : "Iniciar"}
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}