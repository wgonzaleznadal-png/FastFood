"use client";

import { useState } from "react";
import { Button, Drawer, Group, NumberInput, Stack, Text, Textarea } from "@mantine/core";
import { IconCash } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt, moneyNumberInputProps, parseMoneyInput } from "@/lib/format";
import { useShiftStore } from "@/store/shiftStore";
import { mapShiftFromApi } from "@/lib/shiftFromApi";

interface AddInitialCashDrawerProps {
  opened: boolean;
  onClose: () => void;
  shiftId: string;
  currentInitialCash: number;
  /** Llamado tras actualizar el store (ej. refrescar resumen del turno). */
  onSuccess?: () => void;
}

export default function AddInitialCashDrawer({
  opened,
  onClose,
  shiftId,
  currentInitialCash,
  onSuccess,
}: AddInitialCashDrawerProps) {
  const setActiveShift = useShiftStore((s) => s.setActiveShift);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setAmount(0);
    setNote("");
    onClose();
  };

  const handleSubmit = async () => {
    if (amount <= 0) {
      notifications.show({
        title: "Monto inválido",
        message: "Ingresá un monto mayor a cero.",
        color: "orange",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/shifts/${shiftId}/add-initial-cash`, {
        amount,
        note: note.trim() || undefined,
      });
      setActiveShift(mapShiftFromApi(res.data));
      notifications.show({
        title: "Caja actualizada",
        message: `Se sumó ${fmt(amount)} al cambio inicial (${fmt(currentInitialCash + amount)} total).`,
        color: "green",
      });
      setAmount(0);
      setNote("");
      onSuccess?.();
      onClose();
    } catch (err) {
      showApiError(err, "No se pudo agregar el cambio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer opened={opened} onClose={handleClose} title="Agregar cambio en caja" position="right" size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Sumá efectivo al cambio ya cargado en la apertura del turno. El sistema usa este valor para calcular el efectivo esperado en caja.
        </Text>
        <Text size="sm">
          <Text span c="dimmed">Caja inicial actual: </Text>
          <Text span fw={700} c="orange">{fmt(currentInitialCash)}</Text>
        </Text>
        <NumberInput
          label="Monto a agregar ($)"
          placeholder="0,00"
          min={0.01}
          value={amount}
          onChange={(v) => setAmount(parseMoneyInput(v))}
          disabled={submitting}
          leftSection={<IconCash size={18} />}
          {...moneyNumberInputProps}
        />
        <Textarea
          label="Motivo (opcional)"
          placeholder="Ej: Trajeron más vueltos del banco..."
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          minRows={2}
          disabled={submitting}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button color="orange" loading={submitting} onClick={handleSubmit}>
            Confirmar
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
