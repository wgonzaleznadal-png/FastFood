"use client";

import { Text, Stack, Alert } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import GdDrawer from "@/components/layout/Drawer";

interface Props {
  opened: boolean;
  onClose: () => void;
}

export default function WhatsAppConfigDrawer({ opened, onClose }: Props) {
  return (
    <GdDrawer opened={opened} onClose={onClose} title="Configuración WhatsApp">
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          La conexión de WhatsApp se gestiona por tenant. Al conectar, se genera un QR que debe ser escaneado desde la app de WhatsApp del celular del local.
        </Alert>

        <Text size="sm" fw={600}>Funcionamiento del bot</Text>
        <Text size="xs" c="dimmed">
          • Si hay turno abierto → el bot toma pedidos automáticamente.
        </Text>
        <Text size="xs" c="dimmed">
          • Si no hay turno abierto → el bot informa que el local está cerrado.
        </Text>
        <Text size="xs" c="dimmed">
          • Si un operador escribe desde el CRM → el bot se pausa automáticamente.
        </Text>
        <Text size="xs" c="dimmed">
          • Para reactivar el bot → presioná el botón ▶ o escribí &quot;asistente&quot; desde el celular.
        </Text>

        <Text size="sm" fw={600} mt="sm">Estados de chat</Text>
        <Text size="xs" c="dimmed">🔵 Conversando — el cliente está interactuando con el bot.</Text>
        <Text size="xs" c="dimmed">🟡 Pendiente — el bot no encontró un producto, requiere atención.</Text>
        <Text size="xs" c="dimmed">🟢 Completado — pedido creado exitosamente.</Text>
        <Text size="xs" c="dimmed">🔴 Sin respuesta — el cliente dejó de responder (+10 min).</Text>
        <Text size="xs" c="dimmed">⚫ Pausado — un operador tomó el control manualmente.</Text>
      </Stack>
    </GdDrawer>
  );
}
