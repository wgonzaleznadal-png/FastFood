"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Stack, NumberInput, Textarea, Button, Group, Text } from "@mantine/core";
import { IconCash } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { useShiftStore } from "@/store/shiftStore";
import { moneyNumberInputProps, parseMoneyInput } from "@/lib/format";
import { mapShiftFromApi } from "@/lib/shiftFromApi";

const openShiftSchema = z.object({
  initialCash: z.number().nonnegative("Debe ser mayor o igual a 0"),
  notes: z.string().optional(),
});

type OpenShiftFormData = z.infer<typeof openShiftSchema>;

interface OpenShiftFormProps {
  onSuccess?: () => void;
  showCancel?: boolean;
  onCancel?: () => void;
}

export default function OpenShiftForm({ onSuccess, showCancel, onCancel }: OpenShiftFormProps) {
  const { setActiveShift } = useShiftStore();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<OpenShiftFormData>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { initialCash: 0 },
  });

  const handleSubmit = async (data: OpenShiftFormData) => {
    setSubmitting(true);
    try {
      const res = await api.post("/shifts/open", data);
      setActiveShift(mapShiftFromApi(res.data));
      notifications.show({ title: "Turno abierto", message: "¡Listo para operar!", color: "green" });
      form.reset();
      onSuccess?.();
    } catch (err) {
      showApiError(err, "Error al abrir turno");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Ingresá el monto inicial de la caja chica para comenzar el turno.
        </Text>
        <NumberInput
          label="Monto inicial ($)"
          placeholder="0,00"
          min={0}
          error={form.formState.errors.initialCash?.message}
          onChange={(val) => form.setValue("initialCash", parseMoneyInput(val))}
          {...moneyNumberInputProps}
        />
        <Textarea
          label="Notas (opcional)"
          placeholder="Observaciones del turno..."
          rows={2}
          {...form.register("notes")}
        />
        {showCancel ? (
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="submit"
              color="orange"
              loading={submitting}
              leftSection={<IconCash size={16} />}
            >
              Abrir turno
            </Button>
          </Group>
        ) : (
          <Button
            type="submit"
            color="orange"
            size="md"
            fullWidth
            loading={submitting}
            leftSection={<IconCash size={16} />}
          >
            Abrir turno
          </Button>
        )}
      </Stack>
    </form>
  );
}
