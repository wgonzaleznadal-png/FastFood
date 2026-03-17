"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShiftStore } from "@/store/shiftStore";
import { useAuthStore } from "@/store/authStore";
import {
  Text, Button, Group, Stack, Paper, SimpleGrid, Loader, Center, Divider, Badge, NumberInput, TextInput, Textarea, ScrollArea, Alert,
} from "@mantine/core";
import {
  IconCash, IconTrendingUp, IconTrendingDown, IconWallet, IconX,
  IconCreditCard, IconBuildingBank, IconReceipt, IconPlus,
  IconPrinter, IconTruck, IconAlertTriangle, IconCheck,
} from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import { ThermalPrinter } from "@/lib/thermalPrinter";
import Drawer from "@/components/layout/Drawer";
import PageHeader from "@/components/layout/PageHeader";

interface PaymentMethod {
  id: string;
  name: string;
  icon: any;
  color: string;
  amount: number;
}

interface OrderSummary {
  id: string;
  orderNumber: number;
  customerName: string;
  totalPrice: string;
  paymentMethod: string;
  isPaid: boolean;
  isDelivery: boolean;
  status: string;
  createdAt: string;
}

interface ExpenseSummary {
  id: string;
  description: string;
  amount: number;
  notes: string | null;
  createdAt: string;
}

interface ShiftSummary {
  ingresos: number;
  cashSalesLocal: number;
  cashSalesDelivery: number;
  egresos: number;
  enCaja: number;
  rendicionDelivery: number;
  rendicionDeliveryBy: string | null;
  rendicionDeliveryAt: string | null;
  paymentMethods: PaymentMethod[];
  orders: OrderSummary[];
  expenses: ExpenseSummary[];
  counts: {
    total: number;
    paid: number;
    cancelled: number;
    delivery: number;
    local: number;
  };
}

const BILL_DENOMINATIONS = [
  { key: "20000", value: 20000, label: "$20.000" },
  { key: "10000", value: 10000, label: "$10.000" },
  { key: "2000",  value: 2000,  label: "$2.000" },
  { key: "1000",  value: 1000,  label: "$1.000" },
  { key: "500",   value: 500,   label: "$500" },
  { key: "200",   value: 200,   label: "$200" },
  { key: "100",   value: 100,   label: "$100" },
];

const PAYMENT_ICON_MAP: Record<string, { icon: any; color: string }> = {
  efectivo:     { icon: IconCash, color: "green" },
  mercado_pago: { icon: IconBuildingBank, color: "blue" },
  mercadopago:  { icon: IconBuildingBank, color: "blue" },
  transferencia:{ icon: IconBuildingBank, color: "violet" },
  tarjeta:      { icon: IconCreditCard, color: "blue" },
  credito:      { icon: IconCreditCard, color: "blue" },
  debito:       { icon: IconCreditCard, color: "blue" },
};

export default function SistemaCajaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeShift, clearShift } = useShiftStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [egresoDrawerOpen, setEgresoDrawerOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const [billCounts, setBillCounts] = useState<Record<string, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map((b) => [b.key, 0]))
  );

  const [egresoAmount, setEgresoAmount] = useState<number | string>("");
  const [egresoDescription, setEgresoDescription] = useState("");
  const [egresoNotes, setEgresoNotes] = useState("");
  const [savingEgreso, setSavingEgreso] = useState(false);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "close") setCloseDrawerOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const handleOpenCloseDrawer = () => setCloseDrawerOpen(true);
    window.addEventListener("openCloseDrawer", handleOpenCloseDrawer);
    return () => window.removeEventListener("openCloseDrawer", handleOpenCloseDrawer);
  }, []);

  useEffect(() => {
    if (!activeShift) {
      router.push("/dashboard/caja");
      return;
    }
    fetchSummary();
  }, [activeShift]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSummary = useCallback(async () => {
    if (!activeShift) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/shifts/${activeShift.id}/summary`);
      const data = res.data;

      const cashLocal = Number(data.cashSalesLocal || 0);
      const cashDelivery = Number(data.cashSalesDelivery || 0);
      const egresos = Number(data.totalExpenses || 0);
      const rendicionDelivery = Number(data.shift?.deliverySettlementAmount || activeShift.deliverySettlementAmount || 0);
      // Cajón = Inicial + Efectivo LOCAL + Rendición Delivery - Egresos
      const enCaja = Number(activeShift.initialCash) + cashLocal - egresos + rendicionDelivery;

      const paymentMethods = (data.paymentMethods || []).map((pm: any) => ({
        ...pm,
        icon: PAYMENT_ICON_MAP[pm.id]?.icon || IconCash,
        color: PAYMENT_ICON_MAP[pm.id]?.color || "gray",
      }));

      setSummary({
        ingresos: Number(data.totalSales || 0),
        cashSalesLocal: cashLocal,
        cashSalesDelivery: cashDelivery,
        egresos,
        enCaja,
        rendicionDelivery,
        rendicionDeliveryBy: data.shift?.deliverySettlementBy || null,
        rendicionDeliveryAt: data.shift?.deliverySettlementAt || null,
        paymentMethods,
        orders: data.orders || [],
        expenses: data.expenses || [],
        counts: data.counts || { total: 0, paid: 0, cancelled: 0, delivery: 0, local: 0 },
      });
    } catch (err) {
      showApiError(err, "Error al cargar resumen");
    } finally {
      setLoading(false);
    }
  }, [activeShift]);

  const handleCreateExpense = async () => {
    if (!activeShift || !egresoAmount || !egresoDescription.trim()) {
      notifications.show({ title: "Error", message: "Completá monto y concepto", color: "red" });
      return;
    }
    setSavingEgreso(true);
    try {
      await api.post("/api/shifts/expenses", {
        shiftId: activeShift.id,
        amount: Number(egresoAmount),
        description: egresoDescription.trim(),
        notes: egresoNotes.trim() || undefined,
      });
      notifications.show({ title: "Egreso registrado", message: fmt(Number(egresoAmount)), color: "green" });
      setEgresoDrawerOpen(false);
      setEgresoAmount("");
      setEgresoDescription("");
      setEgresoNotes("");
      fetchSummary();
    } catch (err) {
      showApiError(err, "Error al registrar egreso");
    } finally {
      setSavingEgreso(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await api.delete(`/api/shifts/expenses/${expenseId}`);
      notifications.show({ title: "Egreso eliminado", message: "El egreso fue eliminado", color: "blue" });
      fetchSummary();
    } catch (err) {
      showApiError(err, "Error al eliminar egreso");
    }
  };

  const totalBilletes = BILL_DENOMINATIONS.reduce((s, b) => s + (billCounts[b.key] ?? 0) * b.value, 0);

  const handleCloseShift = async () => {
    if (!activeShift || !summary) return;

    const billNotes = BILL_DENOMINATIONS.filter((b) => (billCounts[b.key] || 0) > 0)
      .map((b) => `${b.label}x${billCounts[b.key]}`)
      .join(", ");

    setClosing(true);
    try {
      const res = await api.post(`/api/shifts/${activeShift.id}/close`, {
        finalCash: totalBilletes,
        notes: billNotes ? `Billetes: ${billNotes}` : undefined,
        billCounts,
      });

      const closeResult = res.data;

      try {
        await ThermalPrinter.quickPrint({
          orderNumber: 0,
          customerName: "",
          items: [],
          createdAt: new Date().toISOString(),
          shiftClosing: {
            cashierName: activeShift.openedBy?.name || user?.name || "Cajero",
            openedAt: activeShift.openedAt,
            closedAt: new Date().toISOString(),
            initialCash: Number(activeShift.initialCash),
            totalSales: summary.ingresos,
            paymentMethods: summary.paymentMethods.map((m) => ({ name: m.name, amount: m.amount })),
            totalExpenses: summary.egresos,
            expenses: summary.expenses.map((e) => ({ description: e.description, amount: e.amount })),
            deliverySettlement: summary.rendicionDelivery > 0 ? {
              amount: summary.rendicionDelivery,
              by: summary.rendicionDeliveryBy || "N/A",
            } : null,
            cashSalesLocal: summary.cashSalesLocal,
            finalCash: totalBilletes,
            expectedCash: Number(closeResult.expectedCash),
            difference: Number(closeResult.difference),
            counts: summary.counts,
            billCounts,
          },
        });
        notifications.show({ title: "Ticket impreso", message: "Cierre de caja enviado a impresora", color: "green" });
      } catch (printErr: any) {
        notifications.show({
          title: "Impresora no disponible",
          message: printErr?.message || "El cierre se guardó pero no se pudo imprimir",
          color: "orange",
        });
      }

      notifications.show({ title: "Caja cerrada", message: "El turno fue cerrado correctamente", color: "green" });
      clearShift();
      router.push("/dashboard/caja");
    } catch (err) {
      showApiError(err, "Error al cerrar caja");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return <Center h={400}><Loader color="orange" /></Center>;
  }

  if (!activeShift || !summary) return null;

  const expectedCash = Number(activeShift.initialCash) + summary.cashSalesLocal - summary.egresos + summary.rendicionDelivery;
  const previewDifference = totalBilletes - expectedCash;

  return (
    <div>
      <PageHeader
        actions={
          <Group gap="sm">
            <Button color="orange" leftSection={<IconTrendingDown size={16} />} onClick={() => setEgresoDrawerOpen(true)}>
              Nuevo Egreso
            </Button>
            <Button color="red" leftSection={<IconX size={16} />} onClick={() => { fetchSummary(); setCloseDrawerOpen(true); }}>
              Cerrar Caja
            </Button>
          </Group>
        }
      />

      {/* Card Caja Activa */}
      <Paper className="gd-card" p="xl" mb="lg">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <div style={{ background: "rgba(34, 197, 94, 0.1)", borderRadius: "12px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconWallet size={32} color="#22c55e" />
            </div>
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={700} size="lg" c="var(--gd-text-primary)">Caja Activa</Text>
                <Badge color="green" variant="dot">Abierta</Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Desde {new Date(activeShift.openedAt).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                {" · "}{summary.counts.total} pedidos
              </Text>
            </Stack>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="xl">
          <Paper p="md" radius="md" style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
            <Text size="xs" c="dimmed" mb={4}>INGRESOS</Text>
            <Text fw={700} size="xl" c="green">{fmt(summary.ingresos)}</Text>
          </Paper>
          <Paper p="md" radius="md" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <Text size="xs" c="dimmed" mb={4}>EGRESOS</Text>
            <Text fw={700} size="xl" c="red">{fmt(summary.egresos)}</Text>
          </Paper>
          <Paper p="md" radius="md" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
            <Text size="xs" c="dimmed" mb={4}>EN CAJA (EFECTIVO)</Text>
            <Text fw={700} size="xl" c="blue">{fmt(summary.enCaja)}</Text>
          </Paper>
        </SimpleGrid>

        {/* Contadores rápidos */}
        <Group gap="lg" mt="md">
          <Group gap={4}>
            <Badge size="sm" color="gray" variant="light">{summary.counts.local} retiro</Badge>
            <Badge size="sm" color="orange" variant="light">{summary.counts.delivery} delivery</Badge>
            {summary.counts.cancelled > 0 && <Badge size="sm" color="red" variant="light">{summary.counts.cancelled} cancelados</Badge>}
          </Group>
          {summary.rendicionDelivery > 0 && (
            <Badge size="sm" color="blue" variant="light" leftSection={<IconTruck size={12} />}>
              Delivery rendido: {fmt(summary.rendicionDelivery)}
            </Badge>
          )}
        </Group>
      </Paper>

      {/* Métodos de pago */}
      <Paper className="gd-card" p="lg">
        <Group gap="xs" mb="md">
          <IconReceipt size={20} />
          <Text fw={700}>Por método de pago</Text>
        </Group>
        <Stack gap="xs">
          {summary.paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Group key={method.id} justify="space-between" p="sm" style={{ background: "var(--gd-bg-secondary)", borderRadius: "8px", border: "1px solid var(--gd-border)" }}>
                <Group gap="sm">
                  <div style={{ background: `var(--mantine-color-${method.color}-1)`, borderRadius: "8px", padding: "8px", display: "flex" }}>
                    <Icon size={20} color={`var(--mantine-color-${method.color}-6)`} />
                  </div>
                  <Text size="sm" fw={500}>{method.name}</Text>
                </Group>
                <Text fw={700} size="sm">{fmt(method.amount)}</Text>
              </Group>
            );
          })}
        </Stack>
      </Paper>

      {/* ═══ DRAWER: CERRAR CAJA ═══ */}
      <Drawer
        opened={closeDrawerOpen}
        onClose={() => setCloseDrawerOpen(false)}
        title="Cerrar Caja"
        size="lg"
      >
        <ScrollArea h="calc(100vh - 120px)" offsetScrollbars>
          <Stack gap="lg">
            {/* Header info */}
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Cajero: <Text span fw={600} c="var(--gd-text-primary)">{activeShift.openedBy?.name ?? user?.name}</Text>
              </Text>
              <Text size="sm" c="dimmed">
                Desde {new Date(activeShift.openedAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Group>

            {/* ── RESUMEN DE PEDIDOS ── */}
            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fw={700} mb="xs">Resumen de Pedidos</Text>
              <SimpleGrid cols={2} spacing="xs">
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Total:</Text>
                  <Text size="sm" fw={700}>{summary.counts.total}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Cobrados:</Text>
                  <Text size="sm" fw={700} c="green">{summary.counts.paid}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Retiro:</Text>
                  <Text size="sm" fw={600}>{summary.counts.local}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Delivery:</Text>
                  <Text size="sm" fw={600}>{summary.counts.delivery}</Text>
                </Group>
                {summary.counts.cancelled > 0 && (
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Cancelados:</Text>
                    <Text size="sm" fw={600} c="red">{summary.counts.cancelled}</Text>
                  </Group>
                )}
              </SimpleGrid>
            </Paper>

            {/* ── VENTAS POR MÉTODO ── */}
            <div>
              <Text size="sm" fw={700} mb="xs">Ventas por Método de Pago</Text>
              <Stack gap="xs">
                {summary.paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Group key={method.id} justify="space-between" p="xs" style={{ background: "var(--gd-bg-secondary)", borderRadius: "6px" }}>
                      <Group gap="xs">
                        <Icon size={16} color={`var(--mantine-color-${method.color}-6)`} />
                        <Text size="sm">{method.name}</Text>
                      </Group>
                      <Text size="sm" fw={600}>{fmt(method.amount)}</Text>
                    </Group>
                  );
                })}
                <Group justify="flex-end">
                  <Text size="sm" fw={700}>Total Ventas: <Text span c="green" fw={700}>{fmt(summary.ingresos)}</Text></Text>
                </Group>
              </Stack>
            </div>

            <Divider />

            {/* ── EGRESOS ── */}
            {summary.expenses.length > 0 && (
              <>
                <div>
                  <Text size="sm" fw={700} mb="xs">Egresos de Caja Chica</Text>
                  <Stack gap={4}>
                    {summary.expenses.map((exp) => (
                      <Group key={exp.id} justify="space-between" p="xs" style={{ background: "var(--gd-bg-secondary)", borderRadius: "6px" }}>
                        <Text size="sm">{exp.description}</Text>
                        <Text size="sm" fw={600} c="red">-{fmt(exp.amount)}</Text>
                      </Group>
                    ))}
                    <Group justify="flex-end">
                      <Text size="sm" fw={700}>Total Egresos: <Text span c="red" fw={700}>-{fmt(summary.egresos)}</Text></Text>
                    </Group>
                  </Stack>
                </div>
                <Divider />
              </>
            )}

            {/* ── RENDICIÓN DELIVERY ── */}
            {summary.rendicionDelivery > 0 && (
              <>
                <Paper p="md" radius="md" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                  <Group gap="xs" mb="xs">
                    <IconTruck size={16} color="#3b82f6" />
                    <Text size="sm" fw={700}>Rendición Delivery</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Encargado: <Text span fw={600}>{summary.rendicionDeliveryBy || "—"}</Text></Text>
                    <Text size="sm" fw={700} c="blue">{fmt(summary.rendicionDelivery)}</Text>
                  </Group>
                  {summary.rendicionDeliveryAt && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Rendido: {new Date(summary.rendicionDeliveryAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  )}
                </Paper>
                <Divider />
              </>
            )}

            {/* ── FÓRMULA DEL ESPERADO ── */}
            <Paper p="md" radius="md" withBorder>
              <Text size="sm" fw={700} mb="sm">Efectivo Esperado en Caja</Text>
              <Stack gap={4}>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Caja Inicial</Text>
                  <Text size="sm" fw={600}>{fmt(Number(activeShift.initialCash))}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">+ Efectivo Local (retiro)</Text>
                  <Text size="sm" fw={600} c="green">{fmt(summary.cashSalesLocal)}</Text>
                </Group>
                {summary.egresos > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">− Egresos</Text>
                    <Text size="sm" fw={600} c="red">-{fmt(summary.egresos)}</Text>
                  </Group>
                )}
                {summary.rendicionDelivery > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">+ Rendición Delivery</Text>
                    <Text size="sm" fw={600} c="blue">{fmt(summary.rendicionDelivery)}</Text>
                  </Group>
                )}
                <Divider my={4} />
                <Group justify="space-between">
                  <Text size="sm" fw={700}>= Esperado</Text>
                  <Text size="sm" fw={800} c="orange">{fmt(expectedCash)}</Text>
                </Group>
              </Stack>
            </Paper>

            <Divider />

            {/* ── CONTEO DE BILLETES ── */}
            <div>
              <Text size="sm" fw={700} mb="sm">Conteo de Billetes (ARS)</Text>
              <Stack gap="xs">
                {BILL_DENOMINATIONS.map((b) => (
                  <Group key={b.key} gap="xs" align="flex-end">
                    <NumberInput
                      label={b.label}
                      value={billCounts[b.key] ?? 0}
                      onChange={(val) => setBillCounts((prev) => ({ ...prev, [b.key]: typeof val === "number" ? val : 0 }))}
                      min={0}
                      style={{ flex: 1 }}
                      size="sm"
                    />
                    <Text size="sm" c="dimmed" pb={6} style={{ minWidth: 80, textAlign: "right" }}>
                      {fmt((billCounts[b.key] ?? 0) * b.value)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </div>

            {/* ── CUADRE FINAL ── */}
            <Paper p="md" radius="md" style={{
              background: previewDifference === 0
                ? "rgba(34, 197, 94, 0.08)"
                : previewDifference > 0
                  ? "rgba(59, 130, 246, 0.08)"
                  : "rgba(239, 68, 68, 0.08)",
              border: `1px solid ${previewDifference === 0 ? "rgba(34, 197, 94, 0.3)" : previewDifference > 0 ? "rgba(59, 130, 246, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Efectivo Contado</Text>
                  <Text fw={700} size="lg" c="blue">{fmt(totalBilletes)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" fw={600}>Efectivo Esperado</Text>
                  <Text fw={700} size="lg" c="orange">{fmt(expectedCash)}</Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text fw={700}>
                    {previewDifference === 0 ? "✓ CUADRE PERFECTO" : previewDifference > 0 ? "⚠ SOBRA" : "⚠ FALTA"}
                  </Text>
                  <Text fw={800} size="xl" c={previewDifference === 0 ? "green" : previewDifference > 0 ? "blue" : "red"}>
                    {previewDifference === 0 ? fmt(0) : fmt(Math.abs(previewDifference))}
                  </Text>
                </Group>
              </Stack>
            </Paper>

            {totalBilletes === 0 && (
              <Alert icon={<IconAlertTriangle size={16} />} color="orange" radius="md">
                Contá los billetes antes de cerrar la caja.
              </Alert>
            )}

            {/* ── BOTONES ── */}
            <Group justify="space-between" mt="md" pb="xl">
              <Button variant="subtle" color="gray" onClick={() => setCloseDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                color="red"
                leftSection={<IconPrinter size={16} />}
                loading={closing}
                disabled={totalBilletes === 0}
                onClick={handleCloseShift}
              >
                Imprimir y Cerrar Caja
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      </Drawer>

      {/* ═══ DRAWER: NUEVO EGRESO ═══ */}
      <Drawer
        opened={egresoDrawerOpen}
        onClose={() => setEgresoDrawerOpen(false)}
        title="Egresos de Caja Chica"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Registrá gastos menores pagados desde la caja chica del turno actual.
          </Text>
          <NumberInput
            label="Monto ($)"
            placeholder="0.00"
            min={0.01}
            decimalScale={2}
            prefix="$"
            value={egresoAmount}
            onChange={setEgresoAmount}
          />
          <TextInput
            label="Concepto"
            placeholder="Ej: Rollo de cocina, limpieza, delivery..."
            value={egresoDescription}
            onChange={(e) => setEgresoDescription(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Notas (opcional)"
            placeholder="Detalles adicionales..."
            rows={2}
            value={egresoNotes}
            onChange={(e) => setEgresoNotes(e.currentTarget.value)}
          />
          <Button color="orange" fullWidth leftSection={<IconPlus size={16} />} loading={savingEgreso} onClick={handleCreateExpense}>
            Registrar egreso
          </Button>

          {summary && summary.expenses.length > 0 && (
            <>
              <Text size="sm" fw={700} mt="md">Egresos del turno</Text>
              <Stack gap="xs">
                {summary.expenses.map((exp) => (
                  <Group key={exp.id} justify="space-between" p="xs" style={{ border: "1px solid var(--gd-border)", borderRadius: "var(--gd-radius-sm)" }}>
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>{exp.description}</Text>
                      {exp.notes && <Text size="xs" c="dimmed">{exp.notes}</Text>}
                    </Stack>
                    <Group gap="xs">
                      <Text fw={700} c="red" size="sm">-{fmt(exp.amount)}</Text>
                      <Button variant="subtle" color="gray" size="compact-xs" onClick={() => handleDeleteExpense(exp.id)}>
                        ✕
                      </Button>
                    </Group>
                  </Group>
                ))}
                <Group justify="flex-end" mt="xs">
                  <Text size="sm" fw={700}>
                    Total egresos: <Text span c="red" fw={700}>{fmt(summary.expenses.reduce((sum, e) => sum + e.amount, 0))}</Text>
                  </Text>
                </Group>
              </Stack>
            </>
          )}
        </Stack>
      </Drawer>
    </div>
  );
}
