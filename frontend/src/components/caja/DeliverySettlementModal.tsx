"use client";

import { useState } from "react";
import { Modal, Stack, Group, Text, TextInput, Button, Paper, Divider, NumberInput, Select } from "@mantine/core";
import { IconCash, IconPrinter, IconCheck } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt, moneyNumberInputProps } from "@/lib/format";
import { ThermalPrinter } from "@/lib/thermalPrinter";

interface Collaborator {
  user: { id: string; name: string; role: string };
}

interface DeliverySettlementModalProps {
  opened: boolean;
  onClose: () => void;
  shiftId: string;
  onSuccess: () => void;
  collaborators?: Collaborator[];
}

export default function DeliverySettlementModal({ opened, onClose, shiftId, onSuccess, collaborators = [] }: DeliverySettlementModalProps) {
  const [deliveryPersonUserId, setDeliveryPersonUserId] = useState<string | null>(null);
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [settlementData, setSettlementData] = useState<any>(null);

  const useCollaboratorSelect = collaborators.length > 0;
  const selectedName = useCollaboratorSelect && deliveryPersonUserId
    ? collaborators.find((c) => c.user.id === deliveryPersonUserId)?.user.name ?? ""
    : deliveryPersonName;

  const handleCalculate = async () => {
    const hasSelection = useCollaboratorSelect ? deliveryPersonUserId : deliveryPersonName.trim();
    if (!hasSelection) {
      notifications.show({
        title: "Datos faltantes",
        message: useCollaboratorSelect ? "Seleccioná el encargado de delivery" : "Ingresá el nombre del encargado de delivery",
        color: "red"
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/shifts/${shiftId}/delivery`);
      const deliveryOrders = res.data;
      const paidOrders = deliveryOrders.filter((o: any) => o.isPaid);
      const cashOrders = paidOrders.filter((o: any) =>
        o.paymentMethod === "EFECTIVO"
      );
      const mpOrders = paidOrders.filter((o: any) =>
        o.paymentMethod === "MERCADO PAGO" || o.paymentMethod === "MERCADOPAGO"
      );

      const totalCash = cashOrders.reduce((sum: number, o: any) =>
        sum + Number(o.totalPrice), 0
      );

      setSettlementData({
        totalOrders: paidOrders.length,
        cashOrders: cashOrders.length,
        mpOrders: mpOrders.length,
        totalCash,
        orders: cashOrders,
      });
    } catch (err) {
      showApiError(err, "Error al calcular rendición");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!settlementData) {
      await handleCalculate();
      return;
    }

    const hasSelection = useCollaboratorSelect ? deliveryPersonUserId : deliveryPersonName.trim();
    if (!hasSelection) {
      notifications.show({
        title: "Datos faltantes",
        message: useCollaboratorSelect ? "Seleccioná el encargado de delivery" : "Ingresá el nombre del encargado de delivery",
        color: "red"
      });
      return;
    }

    setLoading(true);
    try {
      const payload: any = { receivedAmount };
      if (useCollaboratorSelect && deliveryPersonUserId) {
        payload.deliveryPersonUserId = deliveryPersonUserId;
      } else {
        payload.deliveryPersonName = deliveryPersonName.trim();
      }

      const res = await api.post(`/shifts/${shiftId}/close-delivery`, payload);

      const displayName = useCollaboratorSelect && deliveryPersonUserId
        ? collaborators.find((c) => c.user.id === deliveryPersonUserId)?.user.name ?? deliveryPersonName
        : deliveryPersonName;

      notifications.show({
        title: "Rendición registrada",
        message: `${displayName} rindió ${fmt(receivedAmount)}`,
        color: "green",
        icon: <IconCheck size={16} />
      });

      printDeliverySettlement(res.data);

      onSuccess();
      handleClose();
    } catch (err) {
      showApiError(err, "Error al registrar rendición");
    } finally {
      setLoading(false);
    }
  };

  const printDeliverySettlement = async (data: any) => {
    try {
      await ThermalPrinter.quickPrint({
        orderNumber: 0,
        customerName: "",
        items: [],
        createdAt: new Date().toISOString(),
        deliverySettlement: {
          deliveryPersonName: data.deliveryPersonName || selectedName,
          totalOrders: data.totalDeliveryOrders ?? settlementData?.totalOrders ?? 0,
          cashOrdersCount: data.cashOrdersCount ?? settlementData?.cashOrders ?? 0,
          mpOrdersCount: data.mpOrdersCount ?? settlementData?.mpOrders ?? 0,
          totalCash: data.totalDeliveryCash ?? settlementData?.totalCash ?? 0,
          receivedAmount: data.receivedAmount ?? receivedAmount,
          difference: data.difference ?? (receivedAmount - (settlementData?.totalCash ?? 0)),
          createdAt: new Date().toISOString(),
        },
      });
      notifications.show({ title: "Comanda impresa", message: "Rendición de delivery enviada a impresora", color: "green" });
    } catch (err: any) {
      notifications.show({ title: "Error impresora", message: err?.message || "No se pudo imprimir", color: "red" });
    }
  };

  const handleClose = () => {
    setDeliveryPersonUserId(null);
    setDeliveryPersonName("");
    setReceivedAmount(0);
    setSettlementData(null);
    onClose();
  };

  const difference = settlementData ? receivedAmount - settlementData.totalCash : 0;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Cerrar Turno Delivery"
      size="lg"
    >
      <Stack gap="md">
        {useCollaboratorSelect ? (
          <Select
            label="Encargado de Delivery"
            placeholder="Seleccioná el colaborador"
            value={deliveryPersonUserId}
            onChange={(v) => setDeliveryPersonUserId(v)}
            data={collaborators.map((c) => ({ value: c.user.id, label: `${c.user.name} (${c.user.role})` }))}
            searchable
            required
          />
        ) : (
          <TextInput
            label="Encargado de Delivery"
            placeholder="Nombre del encargado"
            value={deliveryPersonName}
            onChange={(e) => setDeliveryPersonName(e.currentTarget.value)}
            required
          />
        )}

        {!settlementData ? (
          <Button
            fullWidth
            onClick={handleCalculate}
            loading={loading}
            leftSection={<IconCash size={16} />}
          >
            Calcular Rendición
          </Button>
        ) : (
          <>
            <Paper p="md" radius="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Cantidad de Deliverys (todos)</Text>
                  <Text fw={600}>{settlementData.totalOrders}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Por Mercado Pago</Text>
                  <Text fw={600}>{settlementData.mpOrders ?? 0}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Por Efectivo</Text>
                  <Text fw={600}>{settlementData.cashOrders}</Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text fw={700}>Total Efectivo</Text>
                  <Text fw={700} size="lg" c="orange">{fmt(settlementData.totalCash)}</Text>
                </Group>
              </Stack>
            </Paper>

            <NumberInput
              label="Monto Recibido"
              placeholder="Contá la plata recibida"
              value={receivedAmount}
              onChange={(val) => setReceivedAmount(Number(val) || 0)}
              min={0}
              step={100}
              required
              {...moneyNumberInputProps}
            />

            {receivedAmount > 0 && (
              <Paper 
                p="md" 
                radius="md" 
                withBorder 
                style={{ 
                  backgroundColor: difference === 0 ? "#f0fdf4" : difference > 0 ? "#fef3c7" : "#fee2e2",
                  borderColor: difference === 0 ? "#86efac" : difference > 0 ? "#fbbf24" : "#f87171"
                }}
              >
                <Group justify="space-between">
                  <Text fw={700}>
                    {difference === 0 ? "✓ TOTAL CORRECTO" : difference > 0 ? "⚠ SOBRA" : "⚠ FALTA"}
                  </Text>
                  <Text fw={800} size="xl" c={difference === 0 ? "green" : difference > 0 ? "yellow" : "red"}>
                    {difference === 0 ? fmt(0) : fmt(Math.abs(difference))}
                  </Text>
                </Group>
              </Paper>
            )}

            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                color="green"
                onClick={handleSubmit}
                loading={loading}
                disabled={receivedAmount === 0}
                leftSection={<IconPrinter size={16} />}
              >
                Cerrar Turno Delivery
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
