"use client";

import { useState } from "react";
import { Modal, Stack, Group, Text, TextInput, Button, Paper, Divider, NumberInput } from "@mantine/core";
import { IconCash, IconPrinter, IconCheck } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";

interface DeliverySettlementModalProps {
  opened: boolean;
  onClose: () => void;
  shiftId: string;
  onSuccess: () => void;
}

export default function DeliverySettlementModal({ opened, onClose, shiftId, onSuccess }: DeliverySettlementModalProps) {
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [settlementData, setSettlementData] = useState<any>(null);

  const handleCalculate = async () => {
    if (!deliveryPersonName.trim()) {
      notifications.show({
        title: "Datos faltantes",
        message: "Ingresá el nombre del encargado de delivery",
        color: "red"
      });
      return;
    }

    setLoading(true);
    try {
      // Obtener datos de delivery del turno
      const res = await api.get(`/api/shifts/${shiftId}/delivery`);
      const deliveryOrders = res.data;
      
      const cashOrders = deliveryOrders.filter((o: any) => 
        o.isPaid && o.paymentMethod === "EFECTIVO"
      );
      
      const totalCash = cashOrders.reduce((sum: number, o: any) => 
        sum + Number(o.totalPrice), 0
      );
      
      setSettlementData({
        totalOrders: deliveryOrders.length,
        cashOrders: cashOrders.length,
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

    setLoading(true);
    try {
      const res = await api.post(`/api/shifts/${shiftId}/close-delivery`, {
        receivedAmount,
        deliveryPersonName: deliveryPersonName.trim(),
      });

      notifications.show({
        title: "Rendición registrada",
        message: `${deliveryPersonName} rindió ${fmt(receivedAmount)}`,
        color: "green",
        icon: <IconCheck size={16} />
      });

      // Imprimir cierre de delivery
      printDeliverySettlement(res.data);

      onSuccess();
      handleClose();
    } catch (err) {
      showApiError(err, "Error al registrar rendición");
    } finally {
      setLoading(false);
    }
  };

  const printDeliverySettlement = (data: any) => {
    // TODO: Implementar impresión térmica de cierre delivery
    console.log("Imprimir cierre delivery:", data);
  };

  const handleClose = () => {
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
        <TextInput
          label="Encargado de Delivery"
          placeholder="Nombre del encargado"
          value={deliveryPersonName}
          onChange={(e) => setDeliveryPersonName(e.currentTarget.value)}
          required
        />

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
                  <Text size="sm" c="dimmed">Cantidad de Delivery Efectivo</Text>
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
              prefix="$"
              thousandSeparator="."
              decimalSeparator=","
              required
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
