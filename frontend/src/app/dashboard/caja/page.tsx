"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useShiftStore } from "@/store/shiftStore";
import { usePermissionsStore } from "@/store/permissionsStore";
import {
  Text, Button, Group, Stack, NumberInput, Textarea, TextInput, Paper,
  Badge, Alert, Loader, Center,
} from "@mantine/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconCash, IconLock, IconAlertTriangle, IconCircleCheck, IconPlus,
} from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import KgOrdersModule from "@/components/caja/KgOrdersModule";
import OpenShiftForm from "@/components/caja/OpenShiftForm";
import DeliverySettlementModal from "@/components/caja/DeliverySettlementModal";
import Drawer from "@/components/layout/Drawer";
import PageHeader from "@/components/layout/PageHeader";
import styles from "./caja.module.css";

const closeSchema = z.object({
  finalCash: z.number().nonnegative(),
  notes: z.string().optional(),
});

type CloseForm = z.infer<typeof closeSchema>;

interface CashExpense {
  id: string;
  amount: string;
  description: string;
  notes?: string | null;
  createdAt: string;
}

export default function CajaPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { activeShift, setActiveShift, clearShift } = useShiftStore();
  const { can } = usePermissionsStore();
  const [loading, setLoading] = useState(true);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [egresoDrawerOpen, setEgresoDrawerOpen] = useState(false);
  const [deliverySettlementOpen, setDeliverySettlementOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expenses, setExpenses] = useState<CashExpense[]>([]);
  const [egresoAmount, setEgresoAmount] = useState<number | string>("");
  const [egresoDescription, setEgresoDescription] = useState("");
  const [egresoNotes, setEgresoNotes] = useState("");
  const [savingEgreso, setSavingEgreso] = useState(false);

  const closeForm = useForm<CloseForm>({ resolver: zodResolver(closeSchema) });

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'egreso') {
      setEgresoDrawerOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchActiveShift = async () => {
      try {
        const res = await api.get("/api/shifts/me");
        setActiveShift(res.data);
      } catch {
        clearShift();
      } finally {
        setLoading(false);
      }
    };
    fetchActiveShift();
  }, [setActiveShift, clearShift]);

  const fetchExpenses = async () => {
    if (!activeShift) return;
    try {
      const res = await api.get(`/api/shifts/${activeShift.id}/expenses`);
      setExpenses(res.data);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    if (activeShift) fetchExpenses();
  }, [activeShift?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseShift = async (data: CloseForm) => {
    if (!activeShift) return;
    setSubmitting(true);
    try {
      await api.post(`/api/shifts/${activeShift.id}/close`, data);
      clearShift();
      setCloseDrawerOpen(false);
      notifications.show({ title: "Turno cerrado", message: "El turno fue cerrado correctamente.", color: "blue" });
      closeForm.reset();
    } catch (err) {
      showApiError(err, "Error al cerrar turno");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExpense = async () => {
    if (!activeShift || !egresoAmount || !egresoDescription.trim()) {
      notifications.show({ title: "Campos requeridos", message: "Monto y concepto son obligatorios", color: "orange" });
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
    } catch (err) {
      showApiError(err, "Error al registrar egreso");
    } finally {
      setSavingEgreso(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await api.delete(`/api/shifts/expenses/${id}`);
      notifications.show({ title: "Egreso eliminado", message: "", color: "gray" });
      fetchExpenses();
    } catch (err) {
      showApiError(err, "Error al eliminar egreso");
    }
  };

  if (loading) {
    return (
      <Center h={300}>
        <Loader color="orange" />
      </Center>
    );
  }

  return (
    <div>
      <PageHeader
        actions={
          activeShift && can("caja.pedidos_kg") ? (
            <Group gap="xs">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconCash size={16} />}
                onClick={() => setDeliverySettlementOpen(true)}
              >
                Cerrar Delivery
              </Button>
              <Button
                color="orange"
                leftSection={<IconPlus size={16} />}
                onClick={() => setEgresoDrawerOpen(true)}
              >
                Nuevo Egreso
              </Button>
            </Group>
          ) : undefined
        }
      />

      {!activeShift ? (
        <Paper className="gd-card" maw={480} mt="lg">
          <Stack gap="md">
            <Group gap="sm">
              <IconCash size={24} color="#f97316" />
              <Text fw={700} size="lg">Abrir turno de caja</Text>
            </Group>
            <OpenShiftForm />
          </Stack>
        </Paper>
      ) : (
        can("caja.pedidos_kg") && <KgOrdersModule shiftId={activeShift.id} />
      )}

      <Drawer
        opened={closeDrawerOpen}
        onClose={() => setCloseDrawerOpen(false)}
        title="Mi Turno"
      >
        {activeShift && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Cajero</Text>
              <Text fw={600}>{activeShift.openedBy?.name ?? user?.name}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Caja inicial</Text>
              <Text fw={700} c="orange">
                ${Number(activeShift.initialCash).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Apertura</Text>
              <Text fw={600}>
                {new Date(activeShift.openedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Group>

            <Alert icon={<IconAlertTriangle size={16} />} color="orange" radius="md" mt="xs">
              Solo vos podés ver y operar este turno. Al cerrar, el sistema calculará la diferencia automáticamente.
            </Alert>

            <form onSubmit={closeForm.handleSubmit(handleCloseShift)} noValidate>
              <Stack gap="md">
                <Text size="sm" fw={600} mt="xs">Cerrar turno</Text>
                <Text size="sm" c="dimmed">
                  Contá el dinero físico en caja y registrá el monto real.
                </Text>
                <NumberInput
                  label="Monto real en caja ($)"
                  placeholder="0.00"
                  min={0}
                  decimalScale={2}
                  prefix="$"
                  error={closeForm.formState.errors.finalCash?.message}
                  onChange={(val) => closeForm.setValue("finalCash", typeof val === "string" ? parseFloat(val) || 0 : val)}
                />
                <Textarea
                  label="Notas de cierre (opcional)"
                  placeholder="Observaciones..."
                  rows={2}
                  {...closeForm.register("notes")}
                />
                <Group justify="flex-end">
                  <Button variant="subtle" color="gray" onClick={() => setCloseDrawerOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" color="red" loading={submitting} leftSection={<IconLock size={16} />}>
                    Confirmar cierre
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        )}
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

      {activeShift && (
        <DeliverySettlementModal
          opened={deliverySettlementOpen}
          onClose={() => setDeliverySettlementOpen(false)}
          shiftId={activeShift.id}
          collaborators={activeShift.collaborators}
          onSuccess={() => {
            notifications.show({
              title: "Rendición completada",
              message: "El efectivo de delivery fue registrado",
              color: "green"
            });
          }}
        />
      )}
    </div>
  );
}
