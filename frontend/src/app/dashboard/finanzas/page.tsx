"use client";

import { useEffect, useState } from "react";
import {
  Paper, Text, Stack, Group, ThemeIcon, SimpleGrid, Tabs,
  Badge, Button, Select, NumberInput, Textarea, TextInput,
  Table, Loader, Center, Alert, Progress, Grid, Divider, ScrollArea,
} from "@mantine/core";
import Drawer from "@/components/layout/Drawer";
import PageHeader from "@/components/layout/PageHeader";
import {
  IconReportMoney, IconTrendingUp, IconTrendingDown,
  IconPlus, IconCircleCheck, IconAlertTriangle,
  IconReceipt, IconScale, IconMotorbike, IconBuildingStore, IconWallet,
  IconCash, IconTruck, IconEye,
} from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt, moneyNumberInputProps } from "@/lib/format";

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  period: string;
  isPaid: boolean;
  dueDate?: string;
}

interface ConsolidatorData {
  summary: {
    totalSales: number;
    totalInitialCash: number;
    totalExpenses: number;
    netResult: number;
    shiftCount: number;
    totalDifference: number;
    kpis: {
      ticketPromedio: number;
      totalVolumeKg: number;
      deliverySales: number;
      retiroSales: number;
      totalOrdersCount: number;
      volumeByProduct?: Record<string, number>;
    };
    charts: {
      salesByMethod: Record<string, number>;
      salesByDay: Record<string, number>;
    };
  };
  shifts: Array<{
    id: string;
    openedAt: string;
    closedAt: string;
    openedBy: { name: string };
    totalSales: number;
    initialCash: number;
    finalCash: number;
    difference: number;
    status: string;
  }>;
}

// ─── Constants & Schemas ────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { value: "RENT",        label: "Alquiler" },
  { value: "SALARY",      label: "Sueldos" },
  { value: "TAX",         label: "Impuestos" },
  { value: "UTILITY",     label: "Servicios" },
  { value: "SUPPLIER",    label: "Proveedores" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "OTHER",       label: "Otros" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

// Mapeo de colores para métodos de pago
const METHOD_COLORS: Record<string, string> = {
  "EFECTIVO": "green",
  "MERCADO PAGO": "blue",
  "TARJETA": "violet",
};

const expenseSchema = z.object({
  category: z.string().min(1, "Seleccioná una categoría"),
  description: z.string().min(1, "Ingresá una descripción"),
  amount: z.number().positive("El monto debe ser positivo"),
  period: z.string().min(1, "Ingresá el período (ej: 2025-01)"),
  notes: z.string().optional(),
});
type ExpenseForm = z.infer<typeof expenseSchema>;

// ─── Component ──────────────────────────────────────────────────────────────
interface ShiftDetail {
  shift: any;
  totalSales: number;
  totalExpenses: number;
  paymentMethods: Array<{ id: string; name: string; amount: number }>;
  orders: Array<{ id: string; orderNumber: number; customerName: string; totalPrice: string; paymentMethod: string; isPaid: boolean; isDelivery: boolean; status: string; createdAt: string; items?: Array<{ id: string; productName: string; quantity: number; unitType: string; unitPrice: number; subtotal: number }> }>;
  expenses: Array<{ id: string; description: string; amount: number; notes: string | null; createdAt: string }>;
  counts: { total: number; paid: number; cancelled: number; delivery: number; local: number };
  cashSalesLocal: number;
  cashSalesDelivery: number;
  /** Egresos de caja del encargado de delivery (mismo userId al cerrar rendición) */
  deliveryCadeteEgresos?: number;
  productSummary?: Array<{ name: string; kg: number; units: number; revenue: number }>;
  totalVolumeKg?: number;
}

export default function FinanzasPage() {
  const [consolidator, setConsolidator] = useState<ConsolidatorData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>("consolidador");
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [shiftDetailOpen, setShiftDetailOpen] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openShiftDetail = async (shiftId: string) => {
    setShiftDetailOpen(true);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/shifts/${shiftId}/summary`);
      setShiftDetail(res.data);
    } catch (err) {
      showApiError(err, "Error al cargar detalle del turno");
    } finally {
      setLoadingDetail(false);
    }
  };

  const form = useForm<ExpenseForm>({ resolver: zodResolver(expenseSchema) });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [consRes, expRes] = await Promise.all([
        api.get(`/finance/consolidator?period=${period}`),
        api.get(`/finance/expenses?period=${period}`),
      ]);
      setConsolidator(consRes.data);
      setExpenses(expRes.data);
    } catch (err) {
      showApiError(err, "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [period]);

  const handleCreateExpense = async (data: ExpenseForm) => {
    setSubmitting(true);
    try {
      await api.post("/finance/expenses", { ...data, period });
      notifications.show({ title: "Gasto registrado", message: "El gasto fue guardado.", color: "green" });
      setDrawerOpen(false);
      form.reset();
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo guardar el gasto");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await api.put(`/finance/expenses/${id}`, { isPaid: true, paidAt: new Date().toISOString() });
      notifications.show({ title: "Marcado como pagado", message: "", color: "green" });
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo actualizar");
    }
  };

  if (loading) {
    return <Center h={300}><Loader color="orange" /></Center>;
  }

  const summary = consolidator?.summary;
  const netPositive = (summary?.netResult ?? 0) >= 0;
  const diffColor = (summary?.totalDifference ?? 0) < 0 ? "red" : (summary?.totalDifference ?? 0) > 0 ? "green" : "gray";

  // Helpers para los gráficos de la vista de operaciones
  const methodsEntries = Object.entries(summary?.charts?.salesByMethod || {});
  const totalMethods = methodsEntries.reduce((acc, [, val]) => acc + val, 0);

  return (
    <div>
      <PageHeader
        actions={
          <TextInput
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.currentTarget.value)}
            styles={{ input: { width: 160, fontWeight: 600 } }}
          />
        }
      >
        <Tabs value={activeTab} onChange={setActiveTab} variant="pills" color="orange">
          <Tabs.List>
            <Tabs.Tab value="consolidador" leftSection={<IconReportMoney size={16} />}>
              Dashboard Contable
            </Tabs.Tab>
            <Tabs.Tab value="gastos" leftSection={<IconTrendingDown size={16} />}>
              Gastos Estructurales
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </PageHeader>

      {/* ── CONSOLIDADOR TAB (LA TORRE DE CONTROL) ── */}
      {activeTab === "consolidador" && (
        <Stack gap="lg" mt="lg">
          
          {/* NIVEL 1: SALUD FINANCIERA */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Paper className="gd-card gd-card--stat">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text className="gd-stat-label">Ingresos Brutos</Text>
                  <Text className="gd-stat-value" c="dark">{fmt(summary?.totalSales ?? 0)}</Text>
                  <Text size="xs" c="dimmed">{summary?.shiftCount ?? 0} turnos procesados</Text>
                </Stack>
                <ThemeIcon color="gray" variant="light" size="lg" radius="md">
                  <IconTrendingUp size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="gd-card gd-card--stat">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text className="gd-stat-label">Gastos del Período</Text>
                  <Text className="gd-stat-value" c="red">{fmt(summary?.totalExpenses ?? 0)}</Text>
                  <Text size="xs" c="dimmed">{expenses.length} egresos registrados</Text>
                </Stack>
                <ThemeIcon color="red" variant="light" size="lg" radius="md">
                  <IconTrendingDown size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="gd-card gd-card--stat">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text className="gd-stat-label">Resultado Neto</Text>
                  <Text className="gd-stat-value" style={{ color: netPositive ? "var(--gd-brand-accent)" : "#ef4444" }}>
                    {fmt(summary?.netResult ?? 0)}
                  </Text>
                  <Text size="xs" c="dimmed">Ingresos - Gastos</Text>
                </Stack>
                <ThemeIcon color={netPositive ? "orange" : "red"} variant="light" size="lg" radius="md">
                  <IconReportMoney size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="gd-card gd-card--stat">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text className="gd-stat-label">Descuadre de Cajas</Text>
                  <Text className="gd-stat-value" c={diffColor}>
                    {fmt(summary?.totalDifference ?? 0)}
                  </Text>
                  <Text size="xs" c="dimmed">Diferencia física acumulada</Text>
                </Stack>
                <ThemeIcon color={diffColor} variant="light" size="lg" radius="md">
                  <IconAlertTriangle size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          {/* NIVEL 2: INTELIGENCIA OPERATIVA */}
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            
            {/* TICKET PROMEDIO */}
            <Paper className="gd-card" p="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm" c="dimmed" tt="uppercase">Ticket Promedio</Text>
                <IconReceipt size={20} color="#9ca3af" />
              </Group>
              <Group align="flex-end" gap="xs">
                <Text size="2rem" fw={800} c="dark">{fmt(summary?.kpis?.ticketPromedio ?? 0)}</Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>Basado en {summary?.kpis?.totalOrdersCount ?? 0} ventas totales</Text>
            </Paper>

            {/* VOLUMEN DESPACHADO */}
            <Paper className="gd-card" p="md">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="sm" c="dimmed" tt="uppercase">Volumen Comida</Text>
                <IconScale size={20} color="#9ca3af" />
              </Group>
              <Group align="flex-end" gap="xs">
                <Text size="2rem" fw={800} c="dark">
                  {Number(summary?.kpis?.totalVolumeKg ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 1 })}
                </Text>
                <Text size="lg" fw={600} c="dimmed" pb={4}>Kg</Text>
              </Group>
              {summary?.kpis?.volumeByProduct && Object.keys(summary.kpis.volumeByProduct).length > 0 && (
                <Stack gap={4} mt="sm">
                  {Object.entries(summary.kpis.volumeByProduct as Record<string, number>)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, kg]) => (
                      <Group key={name} justify="space-between">
                        <Text size="xs" c="dimmed">{name}</Text>
                        <Text size="xs" fw={600}>{Number(kg).toLocaleString("es-AR", { maximumFractionDigits: 1 })} Kg</Text>
                      </Group>
                    ))
                  }
                </Stack>
              )}
            </Paper>

            {/* RENDIMIENTO DE CANALES */}
            <Paper className="gd-card" p="md">
              <Text fw={700} size="sm" c="dimmed" tt="uppercase" mb="md">Canales de Venta</Text>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconMotorbike size={18} color="#f97316" />
                    <Text size="sm" fw={600}>Delivery</Text>
                  </Group>
                  <Text fw={700}>{fmt(summary?.kpis?.deliverySales ?? 0)}</Text>
                </Group>
                <Progress 
                  value={summary?.totalSales ? ((summary.kpis?.deliverySales ?? 0) / summary.totalSales) * 100 : 0} 
                  color="orange" 
                  size="sm" 
                  radius="xl" 
                />
                
                <Group justify="space-between" mt="xs">
                  <Group gap="xs">
                    <IconBuildingStore size={18} color="#3b82f6" />
                    <Text size="sm" fw={600}>Local (Retiro)</Text>
                  </Group>
                  <Text fw={700}>{fmt(summary?.kpis?.retiroSales ?? 0)}</Text>
                </Group>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* NIVEL 3: DESGLOSE DE MÉTODOS DE PAGO */}
          <Paper className="gd-card" p="lg">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="gray" size="md"><IconWallet size={16} /></ThemeIcon>
                <Text fw={700} size="md">Composición de Ingresos (Métodos de Pago)</Text>
              </Group>
              <Text fw={800} size="lg">{fmt(totalMethods)}</Text>
            </Group>

            {/* Barra de Progreso Apilada */}
            <Progress.Root size="xl" radius="xl" mb="md">
              {methodsEntries.map(([method, amount]) => {
                if (amount === 0) return null;
                const percent = (amount / totalMethods) * 100;
                const color = METHOD_COLORS[method] || "gray";
                return (
                  <Progress.Section key={method} value={percent} color={color}>
                    <Progress.Label>{percent > 10 ? `${Math.round(percent)}%` : ""}</Progress.Label>
                  </Progress.Section>
                );
              })}
            </Progress.Root>

            {/* Leyendas */}
            <Grid>
              {methodsEntries.sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                <Grid.Col span={{ base: 12, sm: 4 }} key={method}>
                  <Group justify="space-between" p="xs" style={{ border: "1px solid var(--gd-border)", borderRadius: "var(--gd-radius-md)" }}>
                    <Group gap="xs">
                      <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: `var(--mantine-color-${METHOD_COLORS[method] || "gray"}-filled)` }} />
                      <Text size="sm" fw={600}>{method}</Text>
                    </Group>
                    <Text size="sm" fw={700}>{fmt(amount)}</Text>
                  </Group>
                </Grid.Col>
              ))}
            </Grid>
          </Paper>

          {/* NIVEL 4: HISTORIAL DE TURNOS */}
          <Text fw={700} size="lg" mt="md">Historial de Cajas</Text>
          {!consolidator?.shifts.length ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="gray" radius="md">
              No hay turnos cerrados en este período.
            </Alert>
          ) : (
            <Paper className="gd-card" p={0} style={{ overflow: "hidden" }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Cajero</Table.Th>
                    <Table.Th>Apertura</Table.Th>
                    <Table.Th>Cierre</Table.Th>
                    <Table.Th>Ventas del Turno</Table.Th>
                    <Table.Th>Caja Inicial</Table.Th>
                    <Table.Th>Caja Final</Table.Th>
                    <Table.Th>Diferencia</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {consolidator.shifts.map((shift) => (
                    <Table.Tr key={shift.id} style={{ cursor: "pointer" }} onClick={() => openShiftDetail(shift.id)}>
                      <Table.Td fw={600}>{shift.openedBy?.name ?? "—"}</Table.Td>
                      <Table.Td>
                        {new Date(shift.openedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                      </Table.Td>
                      <Table.Td>
                        {shift.closedAt
                          ? new Date(shift.closedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </Table.Td>
                      <Table.Td fw={600} c="dark">{fmt(shift.totalSales)}</Table.Td>
                      <Table.Td>{fmt(Number(shift.initialCash))}</Table.Td>
                      <Table.Td>{fmt(Number(shift.finalCash ?? 0))}</Table.Td>
                      <Table.Td>
                        <Badge 
                          color={Number(shift.difference) < 0 ? "red" : Number(shift.difference) > 0 ? "green" : "gray"}
                          variant="light"
                        >
                          {fmt(Number(shift.difference ?? 0))}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Stack>
      )}

      {/* ── DRAWER: DETALLE DE TURNO ── */}
      <Drawer
        opened={shiftDetailOpen}
        onClose={() => { setShiftDetailOpen(false); setShiftDetail(null); }}
        title="Detalle del Turno"
        size="lg"
      >
        {loadingDetail ? (
          <Center h={200}><Loader color="orange" /></Center>
        ) : shiftDetail ? (
          <ScrollArea h="calc(100vh - 120px)" offsetScrollbars>
            <Stack gap="md">
              {/* Header */}
              <Group justify="space-between">
                <Text size="sm">Cajero: <Text span fw={700}>{shiftDetail.shift?.openedBy?.name ?? "—"}</Text></Text>
                <Badge color={shiftDetail.shift?.status === "CLOSED" ? "gray" : "green"} variant="light">
                  {shiftDetail.shift?.status === "CLOSED" ? "Cerrado" : "Abierto"}
                </Badge>
              </Group>
              <Group gap="xl">
                <Text size="sm" c="dimmed">
                  Apertura: {shiftDetail.shift?.openedAt ? new Date(shiftDetail.shift.openedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </Text>
                <Text size="sm" c="dimmed">
                  Cierre: {shiftDetail.shift?.closedAt ? new Date(shiftDetail.shift.closedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </Text>
              </Group>

              <Divider />

              {/* Resumen de pedidos */}
              <Paper p="md" radius="md" withBorder>
                <Text size="sm" fw={700} mb="xs">Resumen de Pedidos</Text>
                <SimpleGrid cols={2} spacing="xs">
                  <Group gap="xs"><Text size="sm" c="dimmed">Total:</Text><Text size="sm" fw={700}>{shiftDetail.counts.total}</Text></Group>
                  <Group gap="xs"><Text size="sm" c="dimmed">Cobrados:</Text><Text size="sm" fw={700} c="green">{shiftDetail.counts.paid}</Text></Group>
                  <Group gap="xs"><Text size="sm" c="dimmed">Retiro:</Text><Text size="sm" fw={600}>{shiftDetail.counts.local}</Text></Group>
                  <Group gap="xs"><Text size="sm" c="dimmed">Delivery:</Text><Text size="sm" fw={600}>{shiftDetail.counts.delivery}</Text></Group>
                  {shiftDetail.counts.cancelled > 0 && (
                    <Group gap="xs"><Text size="sm" c="dimmed">Cancelados:</Text><Text size="sm" fw={600} c="red">{shiftDetail.counts.cancelled}</Text></Group>
                  )}
                </SimpleGrid>
              </Paper>

              {/* Ventas por método */}
              <div>
                <Text size="sm" fw={700} mb="xs">Ventas por Método de Pago</Text>
                <Stack gap={4}>
                  {shiftDetail.paymentMethods.map((pm) => (
                    <Group key={pm.id} justify="space-between" p="xs" style={{ background: "var(--gd-bg-secondary)", borderRadius: "6px" }}>
                      <Text size="sm">{pm.name}</Text>
                      <Text size="sm" fw={600}>{fmt(pm.amount)}</Text>
                    </Group>
                  ))}
                  <Group justify="flex-end" mt={4}>
                    <Text size="sm" fw={700}>Total Ventas: <Text span c="green" fw={700}>{fmt(shiftDetail.totalSales)}</Text></Text>
                  </Group>
                </Stack>
              </div>

              <Divider />

              {/* Egresos */}
              {shiftDetail.expenses.length > 0 && (
                <>
                  <div>
                    <Text size="sm" fw={700} mb="xs">Egresos de Caja Chica</Text>
                    <Stack gap={4}>
                      {shiftDetail.expenses.map((exp) => (
                        <Group key={exp.id} justify="space-between" p="xs" style={{ background: "var(--gd-bg-secondary)", borderRadius: "6px" }}>
                          <Stack gap={0}>
                            <Text size="sm">{exp.description}</Text>
                            {exp.notes && <Text size="xs" c="dimmed">{exp.notes}</Text>}
                          </Stack>
                          <Text size="sm" fw={600} c="red">-{fmt(exp.amount)}</Text>
                        </Group>
                      ))}
                      <Group justify="flex-end" mt={4}>
                        <Text size="sm" fw={700}>Total Egresos: <Text span c="red" fw={700}>-{fmt(shiftDetail.totalExpenses)}</Text></Text>
                      </Group>
                    </Stack>
                  </div>
                  <Divider />
                </>
              )}

              {/* Rendición Delivery */}
              {shiftDetail.shift?.deliverySettlementAmount && Number(shiftDetail.shift.deliverySettlementAmount) > 0 && (() => {
                const deliveryAmt = Number(shiftDetail.shift.deliverySettlementAmount);
                const cadeteEgresos = Number(shiftDetail.deliveryCadeteEgresos ?? 0);
                const deliveryGross = Number(shiftDetail.cashSalesDelivery || 0);
                const expDb =
                  shiftDetail.shift.deliverySettlementExpectedCash != null &&
                  shiftDetail.shift.deliverySettlementExpectedCash !== ""
                    ? Number(shiftDetail.shift.deliverySettlementExpectedCash)
                    : NaN;
                const deliveryExpected =
                  !Number.isNaN(expDb) && expDb > 0 ? expDb : deliveryGross - cadeteEgresos;
                let deliveryDiff: number | null = null;
                if (
                  shiftDetail.shift.deliverySettlementDifference != null &&
                  shiftDetail.shift.deliverySettlementDifference !== ""
                ) {
                  deliveryDiff = Number(shiftDetail.shift.deliverySettlementDifference);
                } else if (deliveryAmt > 0 && deliveryExpected > 0) {
                  deliveryDiff = deliveryAmt - deliveryExpected;
                }
                return (
                  <>
                    <Paper p="md" radius="md" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                      <Group gap="xs" mb="xs">
                        <IconTruck size={16} color="#3b82f6" />
                        <Text size="sm" fw={700}>Rendición Delivery</Text>
                      </Group>
                      <Stack gap={6}>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Encargado</Text>
                          <Text size="sm" fw={600}>{shiftDetail.shift.deliverySettlementBy || "—"}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Efectivo cobrado (delivery)</Text>
                          <Text size="sm" fw={600} c="orange">{fmt(deliveryGross)}</Text>
                        </Group>
                        {cadeteEgresos > 0 && (
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">Egresos de caja del encargado</Text>
                            <Text size="sm" fw={600} c="red">-{fmt(cadeteEgresos)}</Text>
                          </Group>
                        )}
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Neto a rendir (sistema)</Text>
                          <Text size="sm" fw={700} c="orange">{fmt(deliveryExpected)}</Text>
                        </Group>
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">Entregó al cajero</Text>
                          <Text size="sm" fw={700} c="blue">{fmt(deliveryAmt)}</Text>
                        </Group>
                        {deliveryDiff != null && deliveryDiff !== 0 && (
                          <Alert
                            color={deliveryDiff < 0 ? "red" : "yellow"}
                            icon={<IconAlertTriangle size={14} />}
                            p="xs"
                            radius="md"
                          >
                            <Text size="xs" fw={600}>
                              {deliveryDiff < 0
                                ? `Falta en rendición: ${fmt(Math.abs(deliveryDiff))}`
                                : `Sobró en rendición: ${fmt(deliveryDiff)}`}
                            </Text>
                          </Alert>
                        )}
                        {deliveryDiff === 0 && (
                          <Text size="xs" c="dimmed">Cuadre exacto con el neto esperado (cobrado − egresos del encargado).</Text>
                        )}
                        {shiftDetail.shift.deliverySettlementAt && (
                          <Text size="xs" c="dimmed">
                            Registrado:{" "}
                            {new Date(shiftDetail.shift.deliverySettlementAt).toLocaleString("es-AR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                    <Divider />
                  </>
                );
              })()}

              {/* Cuadre de caja */}
              {shiftDetail.shift?.status === "CLOSED" && (
                <Paper p="md" radius="md" withBorder>
                  <Text size="sm" fw={700} mb="sm">Cuadre de Caja</Text>
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Caja Inicial</Text>
                      <Text size="sm" fw={600}>{fmt(Number(shiftDetail.shift.initialCash))}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">+ Efectivo Local</Text>
                      <Text size="sm" fw={600} c="green">{fmt(shiftDetail.cashSalesLocal ?? 0)}</Text>
                    </Group>
                    {shiftDetail.totalExpenses > 0 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">− Egresos</Text>
                        <Text size="sm" fw={600} c="red">-{fmt(shiftDetail.totalExpenses)}</Text>
                      </Group>
                    )}
                    {shiftDetail.shift.deliverySettlementAmount && Number(shiftDetail.shift.deliverySettlementAmount) > 0 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">+ Rendición Delivery</Text>
                        <Text size="sm" fw={600} c="blue">{fmt(Number(shiftDetail.shift.deliverySettlementAmount))}</Text>
                      </Group>
                    )}
                    <Divider my={4} />
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>Esperado</Text>
                      <Text size="sm" fw={700} c="orange">{fmt(Number(shiftDetail.shift.expectedCash))}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>Contado</Text>
                      <Text size="sm" fw={700}>{fmt(Number(shiftDetail.shift.finalCash))}</Text>
                    </Group>
                    <Divider my={4} />
                    <Group justify="space-between">
                      <Text fw={700}>
                        {Number(shiftDetail.shift.difference) === 0 ? "✓ CUADRE PERFECTO" : Number(shiftDetail.shift.difference) > 0 ? "⚠ SOBRA" : "⚠ FALTA"}
                      </Text>
                      <Text fw={800} size="lg" c={Number(shiftDetail.shift.difference) === 0 ? "green" : Number(shiftDetail.shift.difference) > 0 ? "blue" : "red"}>
                        {fmt(Math.abs(Number(shiftDetail.shift.difference ?? 0)))}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              )}

              <Divider />

              {/* Resumen de productos vendidos */}
              {shiftDetail.productSummary && shiftDetail.productSummary.length > 0 && (
                <>
                  <Paper p="md" radius="md" withBorder>
                    <Group gap="xs" mb="sm">
                      <IconScale size={16} />
                      <Text size="sm" fw={700}>Productos Vendidos</Text>
                      {shiftDetail.totalVolumeKg != null && (
                        <Badge variant="light" color="orange" size="sm">{Number(shiftDetail.totalVolumeKg).toLocaleString("es-AR", { maximumFractionDigits: 1 })} Kg total</Badge>
                      )}
                    </Group>
                    <Stack gap={4}>
                      {shiftDetail.productSummary.map((p: any) => (
                        <Group key={p.name} justify="space-between" p="xs" style={{ background: "var(--gd-bg-secondary)", borderRadius: "6px" }}>
                          <Text size="sm" fw={600}>{p.name}</Text>
                          <Group gap="md">
                            {p.kg > 0 && <Text size="xs" c="dimmed">{p.kg.toLocaleString("es-AR", { maximumFractionDigits: 1 })} Kg</Text>}
                            {p.units > 0 && <Text size="xs" c="dimmed">{p.units} uds</Text>}
                            <Text size="sm" fw={700}>{fmt(p.revenue)}</Text>
                          </Group>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                  <Divider />
                </>
              )}

              {/* Lista de pedidos */}
              <div>
                <Text size="sm" fw={700} mb="xs">Todos los Pedidos del Turno</Text>
                <Stack gap={4}>
                  {shiftDetail.orders.map((order: any) => (
                    <Paper key={order.id} p="xs" radius="sm" style={{ border: "1px solid var(--gd-border)" }}>
                      <Group justify="space-between" mb={order.items?.length > 0 ? 4 : 0}>
                        <Group gap="sm">
                          <Text size="sm" fw={700} c="dimmed">#{order.orderNumber}</Text>
                          <Text size="sm" fw={600}>{order.customerName}</Text>
                          <Badge size="xs" variant="light" color={order.isDelivery ? "orange" : "blue"}>
                            {order.isDelivery ? "Delivery" : "Retiro"}
                          </Badge>
                          {order.status === "CANCELLED" && <Badge size="xs" color="red">Cancelado</Badge>}
                        </Group>
                        <Group gap="sm">
                          <Badge size="xs" variant="outline" color="gray">{order.paymentMethod}</Badge>
                          <Text size="sm" fw={700} c={order.isPaid ? "dark" : "dimmed"}>
                            {fmt(Number(order.totalPrice))}
                          </Text>
                        </Group>
                      </Group>
                      {order.items?.length > 0 && (
                        <Stack gap={2} ml="md">
                          {order.items.map((item: any) => (
                            <Group key={item.id} gap="xs">
                              <Text size="xs" c="dimmed">•</Text>
                              <Text size="xs" c="dimmed">{item.productName}</Text>
                              <Text size="xs" c="dimmed">
                                {item.unitType === "KG" ? `${item.quantity} Kg` : `x${item.quantity}`}
                              </Text>
                              <Text size="xs" fw={600}>{fmt(item.subtotal)}</Text>
                            </Group>
                          ))}
                        </Stack>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </div>
            </Stack>
          </ScrollArea>
        ) : (
          <Text c="dimmed">No se encontraron datos del turno.</Text>
        )}
      </Drawer>

      {/* ── GASTOS TAB (Se mantiene igual para gestión operativa) ── */}
      {activeTab === "gastos" && (
        <div style={{ marginTop: "var(--gd-space-6)" }}>
          <Group justify="space-between" mb="md">
            <Text fw={600} size="sm" c="dimmed">
              {expenses.length} gastos en {period}
            </Text>
            <Button color="orange" size="sm" leftSection={<IconPlus size={16} />} onClick={() => setDrawerOpen(true)}>
              Nuevo gasto
            </Button>
          </Group>

          {!expenses.length ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="gray" radius="md">
              No hay gastos estructurales registrados en este período.
            </Alert>
          ) : (
            <Paper className="gd-card" p={0} style={{ overflow: "hidden" }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Categoría</Table.Th>
                    <Table.Th>Descripción</Table.Th>
                    <Table.Th>Monto</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {expenses.map((exp) => (
                    <Table.Tr key={exp.id}>
                      <Table.Td>
                        <Badge size="sm" variant="light" color="gray">
                          {CATEGORY_LABELS[exp.category] ?? exp.category}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{exp.description}</Table.Td>
                      <Table.Td fw={600}>{fmt(Number(exp.amount))}</Table.Td>
                      <Table.Td>
                        {exp.isPaid ? (
                          <Badge color="green" size="sm" leftSection={<IconCircleCheck size={12} />}>Pagado</Badge>
                        ) : (
                          <Badge color="orange" size="sm">Pendiente</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {!exp.isPaid && (
                          <Button size="xs" variant="light" color="green" onClick={() => handleMarkPaid(exp.id)}>
                            Marcar pagado
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </div>
      )}

      {/* ── DRAWER: NUEVO GASTO ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => { setDrawerOpen(false); form.reset(); }}
        title="Registrar gasto estructural"
      >
        <form onSubmit={form.handleSubmit(handleCreateExpense)} noValidate>
          <Stack gap="md">
            <Select
              label="Categoría"
              placeholder="Seleccioná una categoría"
              data={EXPENSE_CATEGORIES}
              error={form.formState.errors.category?.message}
              onChange={(val) => form.setValue("category", val ?? "")}
            />
            <TextInput
              label="Descripción"
              placeholder="Ej: Alquiler local enero"
              error={form.formState.errors.description?.message}
              {...form.register("description")}
            />
            <NumberInput
              label="Monto ($)"
              placeholder="0,00"
              min={0}
              error={form.formState.errors.amount?.message}
              onChange={(val) => form.setValue("amount", typeof val === "string" ? parseFloat(val) || 0 : val)}
              {...moneyNumberInputProps}
            />
            <TextInput
              label="Período"
              placeholder="2025-01"
              description="Formato: YYYY-MM"
              defaultValue={period}
              error={form.formState.errors.period?.message}
              {...form.register("period")}
            />
            <Textarea label="Notas (opcional)" rows={2} {...form.register("notes")} />
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => { setDrawerOpen(false); form.reset(); }}>Cancelar</Button>
              <Button type="submit" color="orange" loading={submitting} leftSection={<IconPlus size={16} />}>Guardar gasto</Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </div>
  );
}