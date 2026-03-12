"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShiftStore } from "@/store/shiftStore";
import { useAuthStore } from "@/store/authStore";
import {
  Text, Button, Group, Stack, Paper, SimpleGrid, Loader, Center, Divider, Badge, NumberInput, TextInput, Textarea,
} from "@mantine/core";
import {
  IconCash, IconTrendingUp, IconTrendingDown, IconWallet, IconX,
  IconCreditCard, IconBuildingBank, IconReceipt, IconCoin, IconPlus,
} from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import Drawer from "@/components/layout/Drawer";
import PageHeader from "@/components/layout/PageHeader";

interface PaymentMethod {
  id: string;
  name: string;
  icon: any;
  color: string;
  amount: number;
}

interface ShiftSummary {
  ingresos: number;
  egresos: number;
  enCaja: number;
  paymentMethods: PaymentMethod[];
}

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
  
  // Conteo de billetes
  const [bill1000, setBill1000] = useState(0);
  const [bill500, setBill500] = useState(0);
  const [bill200, setBill200] = useState(0);
  const [bill100, setBill100] = useState(0);
  
  // Estados para drawer de egresos
  const [egresoAmount, setEgresoAmount] = useState<number | string>("");
  const [egresoDescription, setEgresoDescription] = useState("");
  const [egresoNotes, setEgresoNotes] = useState("");
  const [savingEgreso, setSavingEgreso] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'close') {
      setCloseDrawerOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleOpenCloseDrawer = () => {
      setCloseDrawerOpen(true);
    };
    window.addEventListener('openCloseDrawer', handleOpenCloseDrawer);
    return () => window.removeEventListener('openCloseDrawer', handleOpenCloseDrawer);
  }, []);

  useEffect(() => {
    if (!activeShift) {
      router.push("/dashboard/caja");
      return;
    }
    fetchSummary();
    fetchExpenses();
  }, [activeShift]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchExpenses = async () => {
    if (!activeShift) return;
    try {
      const res = await api.get(`/api/shifts/${activeShift.id}/expenses`);
      setExpenses(res.data);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    }
  };

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
      fetchExpenses();
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
      fetchExpenses();
      fetchSummary();
    } catch (err) {
      showApiError(err, "Error al eliminar egreso");
    }
  };

  const fetchSummary = async () => {
    if (!activeShift) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/shifts/${activeShift.id}/summary`);
      const data = res.data;
      
      const ingresos = Number(data.totalSales || 0);
      const egresos = Number(data.totalExpenses || 0);
      const enCaja = Number(activeShift.initialCash) + ingresos - egresos;

      // Mapear métodos de pago del backend con sus iconos
      const paymentMethodsMap: Record<string, { icon: any; color: string }> = {
        efectivo: { icon: IconCash, color: "green" },
        transferencia: { icon: IconBuildingBank, color: "violet" },
        credito: { icon: IconCreditCard, color: "blue" },
        debito: { icon: IconCreditCard, color: "blue" },
      };

      const paymentMethods = data.paymentMethods.map((pm: any) => ({
        ...pm,
        icon: paymentMethodsMap[pm.id]?.icon || IconCash,
        color: paymentMethodsMap[pm.id]?.color || "gray",
      }));

      setSummary({
        ingresos,
        egresos,
        enCaja,
        paymentMethods,
      });
    } catch (err) {
      showApiError(err, "Error al cargar resumen");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift || !summary) return;
    
    const totalBilletes = (bill1000 * 1000) + (bill500 * 500) + (bill200 * 200) + (bill100 * 100);
    const efectivoEsperado = summary.paymentMethods.find(m => m.id === "efectivo")?.amount || 0;
    const efectivoNeto = totalBilletes;
    
    setClosing(true);
    try {
      await api.post(`/api/shifts/${activeShift.id}/close`, {
        finalCash: efectivoNeto,
        notes: `Billetes contados: $1000x${bill1000}, $500x${bill500}, $200x${bill200}, $100x${bill100}`,
      });
      notifications.show({
        title: "Caja cerrada",
        message: "El turno fue cerrado correctamente",
        color: "green",
      });
      clearShift();
      router.push("/dashboard/caja");
    } catch (err) {
      showApiError(err, "Error al cerrar caja");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <Center h={400}>
        <Loader color="orange" />
      </Center>
    );
  }

  if (!activeShift || !summary) {
    return null;
  }

  return (
    <div>
      <PageHeader
        actions={
          <Group gap="sm">
            <Button
              color="orange"
              leftSection={<IconTrendingDown size={16} />}
              onClick={() => setEgresoDrawerOpen(true)}
            >
              Nuevo Egreso
            </Button>
            <Button
              color="red"
              leftSection={<IconX size={16} />}
              onClick={() => setCloseDrawerOpen(true)}
            >
              Cerrar Caja
            </Button>
          </Group>
        }
      />

      {/* Card de Caja Activa */}
      <Paper className="gd-card" p="xl" mb="lg">
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <div style={{ 
              background: "rgba(34, 197, 94, 0.1)", 
              borderRadius: "12px", 
              padding: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <IconWallet size={32} color="#22c55e" />
            </div>
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={700} size="lg" c="var(--gd-text-primary)">Caja Activa</Text>
                <Badge color="green" variant="dot">Abierta</Badge>
              </Group>
              <Text size="xs" c="dimmed">
                Desde {new Date(activeShift.openedAt).toLocaleString("es-AR", { 
                  hour: "2-digit", 
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit"
                })}
              </Text>
            </Stack>
          </Group>
        </Group>

        {/* Resumen de montos */}
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
            <Text size="xs" c="dimmed" mb={4}>EN CAJA</Text>
            <Text fw={700} size="xl" c="blue">{fmt(summary.enCaja)}</Text>
          </Paper>
        </SimpleGrid>
      </Paper>

      {/* Sección de métodos de pago */}
      <Paper className="gd-card" p="lg">
        <Group gap="xs" mb="md">
          <IconReceipt size={20} />
          <Text fw={700}>Por método de pago</Text>
        </Group>
        <Stack gap="xs">
          {summary.paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <Group key={method.id} justify="space-between" p="sm" style={{ 
                background: "var(--gd-bg-secondary)", 
                borderRadius: "8px",
                border: "1px solid var(--gd-border)"
              }}>
                <Group gap="sm">
                  <div style={{ 
                    background: `var(--mantine-color-${method.color}-1)`,
                    borderRadius: "8px",
                    padding: "8px",
                    display: "flex"
                  }}>
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

      {/* Drawer de Cerrar Caja */}
      <Drawer
        opened={closeDrawerOpen}
        onClose={() => setCloseDrawerOpen(false)}
        title="Cerrar Caja"
      >
        <Stack gap="lg">
          <Text size="xs" c="dimmed">
            Abierta desde {new Date(activeShift.openedAt).toLocaleString("es-AR", { 
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit", 
              minute: "2-digit" 
            })} • 4h 50m
          </Text>

          {/* Resumen de Caja */}
          <div>
            <Text size="sm" fw={700} mb="xs">Resumen de Caja</Text>
            <Stack gap="xs">
              {summary.paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <Group key={method.id} justify="space-between" p="xs" style={{ 
                    background: "var(--gd-bg-secondary)", 
                    borderRadius: "6px" 
                  }}>
                    <Group gap="xs">
                      <Icon size={16} color={`var(--mantine-color-${method.color}-6)`} />
                      <Text size="sm">{method.name}</Text>
                    </Group>
                    <Text size="sm" fw={600}>{fmt(method.amount)}</Text>
                  </Group>
                );
              })}
            </Stack>
          </div>

          <Divider />

          {/* Totales */}
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Total Ventas</Text>
              <Text size="sm" fw={700} c="green">{fmt(summary.ingresos)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Total Gastos</Text>
              <Text size="sm" fw={700} c="red">{fmt(summary.egresos)}</Text>
            </Group>
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Caja Inicial</Text>
              <Text size="sm" fw={600}>{fmt(Number(activeShift.initialCash))}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Efectivo Esperado</Text>
              <Text size="sm" fw={600}>{fmt(summary.paymentMethods.find(m => m.id === "efectivo")?.amount || 0)}</Text>
            </Group>
          </Stack>

          <Divider />

          {/* Conteo de Billetes */}
          <div>
            <Text size="sm" fw={700} mb="sm">Conteo de Billetes</Text>
            <Stack gap="xs">
              <Group gap="xs">
                <NumberInput
                  label="$1000"
                  value={bill1000}
                  onChange={(val) => setBill1000(typeof val === "number" ? val : 0)}
                  min={0}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Text size="sm" c="dimmed" mt={24}>{fmt(bill1000 * 1000)}</Text>
              </Group>
              <Group gap="xs">
                <NumberInput
                  label="$500"
                  value={bill500}
                  onChange={(val) => setBill500(typeof val === "number" ? val : 0)}
                  min={0}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Text size="sm" c="dimmed" mt={24}>{fmt(bill500 * 500)}</Text>
              </Group>
              <Group gap="xs">
                <NumberInput
                  label="$200"
                  value={bill200}
                  onChange={(val) => setBill200(typeof val === "number" ? val : 0)}
                  min={0}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Text size="sm" c="dimmed" mt={24}>{fmt(bill200 * 200)}</Text>
              </Group>
              <Group gap="xs">
                <NumberInput
                  label="$100"
                  value={bill100}
                  onChange={(val) => setBill100(typeof val === "number" ? val : 0)}
                  min={0}
                  style={{ flex: 1 }}
                  size="sm"
                />
                <Text size="sm" c="dimmed" mt={24}>{fmt(bill100 * 100)}</Text>
              </Group>
            </Stack>
          </div>

          {/* Efectivo Neto */}
          <Paper p="md" style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
            <Text size="xs" mb={4} c="dimmed">Efectivo Neto</Text>
            <Text fw={700} size="xl" c="blue">
              {fmt((bill1000 * 1000) + (bill500 * 500) + (bill200 * 200) + (bill100 * 100))}
            </Text>
            <Text size="xs" mt={4} c="dimmed">
              Inicial {fmt(Number(activeShift.initialCash))} + Efectivo {fmt(summary.paymentMethods.find(m => m.id === "efectivo")?.amount || 0)} - Egresos {fmt(summary.egresos)}
            </Text>
          </Paper>

          {/* Botones */}
          <Group justify="space-between" mt="md">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => setCloseDrawerOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              leftSection={<IconX size={16} />}
              loading={closing}
              onClick={handleCloseShift}
            >
              Cerrar Caja
            </Button>
          </Group>
        </Stack>
      </Drawer>

      {/* Drawer Nuevo Egreso */}
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
          <Button
            color="orange"
            fullWidth
            leftSection={<IconPlus size={16} />}
            loading={savingEgreso}
            onClick={handleCreateExpense}
          >
            Registrar egreso
          </Button>

          {expenses.length > 0 && (
            <>
              <Text size="sm" fw={700} mt="md">Egresos del turno</Text>
              <Stack gap="xs">
                {expenses.map((exp) => (
                  <Group key={exp.id} justify="space-between" p="xs" style={{ border: "1px solid var(--gd-border)", borderRadius: "var(--gd-radius-sm)" }}>
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>{exp.description}</Text>
                      {exp.notes && <Text size="xs" c="dimmed">{exp.notes}</Text>}
                    </Stack>
                    <Group gap="xs">
                      <Text fw={700} c="red" size="sm">-{fmt(Number(exp.amount))}</Text>
                      <Button
                        variant="subtle"
                        color="gray"
                        size="compact-xs"
                        onClick={() => handleDeleteExpense(exp.id)}
                      >
                        ✕
                      </Button>
                    </Group>
                  </Group>
                ))}
                <Group justify="flex-end" mt="xs">
                  <Text size="sm" fw={700}>
                    Total egresos: <Text span c="red" fw={700}>{fmt(expenses.reduce((sum, e) => sum + Number(e.amount), 0))}</Text>
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
