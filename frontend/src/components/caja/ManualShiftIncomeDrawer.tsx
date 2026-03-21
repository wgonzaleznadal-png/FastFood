"use client";

import { useState } from "react";
import {
  Button, Drawer, Group, NumberInput, PasswordInput, Select, Stack, Text, Textarea, TextInput, Alert,
} from "@mantine/core";
import { IconCash, IconShieldLock } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt, moneyNumberInputProps, parseMoneyInput } from "@/lib/format";
import { SHIFT_LEDGER_PAYMENT_OPTIONS } from "@/lib/shiftLedgerPaymentMethods";

interface ManualShiftIncomeDrawerProps {
  opened: boolean;
  onClose: () => void;
  shiftId: string;
  onSuccess?: () => void;
}

export default function ManualShiftIncomeDrawer({
  opened,
  onClose,
  shiftId,
  onSuccess,
}: ManualShiftIncomeDrawerProps) {
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("MERCADO PAGO");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAmount(0);
    setPaymentMethod("MERCADO PAGO");
    setDescription("");
    setNotes("");
    setPin("");
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (amount <= 0 || !description.trim()) {
      notifications.show({
        title: "Datos incompletos",
        message: "Monto y concepto son obligatorios.",
        color: "orange",
      });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        shiftId,
        amount,
        paymentMethod,
        description: description.trim(),
        notes: notes.trim() || undefined,
      };
      if (pin.trim().length >= 4) body.pin = pin.trim();

      await api.post("/shifts/manual-income", body);
      notifications.show({
        title: "Ingreso registrado",
        message: `${fmt(amount)} vía ${paymentMethod}`,
        color: "green",
      });
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      showApiError(err, "No se pudo registrar el ingreso");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer opened={opened} onClose={handleClose} title="Ingreso manual al turno" position="right" size="md">
      <Stack gap="md">
        <Alert icon={<IconShieldLock size={18} />} color="gray" variant="light">
          Para movimientos que no pasan por un pedido (ej. envío cobrado con el MP del local). Si configuraste PIN de
          administrador, ingresalo abajo.
        </Alert>
        <NumberInput
          label="Monto ($)"
          placeholder="0,00"
          min={0.01}
          value={amount}
          onChange={(v) => setAmount(parseMoneyInput(v))}
          disabled={submitting}
          leftSection={<IconCash size={18} />}
          {...moneyNumberInputProps}
        />
        <Select
          label="Medio de ingreso"
          data={[...SHIFT_LEDGER_PAYMENT_OPTIONS]}
          value={paymentMethod}
          onChange={(v) => setPaymentMethod(v || "MERCADO PAGO")}
          disabled={submitting}
        />
        <TextInput
          label="Concepto"
          placeholder="Ej: Envío delivery cobrado con MP del local"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          required
          disabled={submitting}
        />
        <Textarea
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          disabled={submitting}
        />
        <PasswordInput
          label="PIN administrador (si aplica)"
          placeholder="4–6 dígitos"
          value={pin}
          onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
          disabled={submitting}
          maxLength={6}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="gray" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button color="green" loading={submitting} onClick={handleSubmit}>
            Registrar ingreso
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
