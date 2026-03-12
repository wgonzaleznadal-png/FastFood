"use client";

import { useEffect, useState } from "react";
import { Text, Stack, Switch, Loader, Center, Alert, Group, Badge } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import Drawer from "@/components/layout/Drawer";

interface Product {
  id: string;
  name: string;
  isAvailable: boolean;
  isAvailableForBot: boolean;
  pricePerKg: string;
}

interface Props {
  opened: boolean;
  onClose: () => void;
}

export default function ProductAvailabilityDrawer({ opened, onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/menu/kg-products");
      setProducts(res.data);
    } catch (err) {
      showApiError(err, "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      fetchProducts();
    }
  }, [opened]);

  const handleToggle = async (productId: string, newValue: boolean) => {
    setUpdating(productId);
    try {
      console.log('[ProductAvailabilityDrawer] Actualizando producto:', { productId, isAvailableForBot: newValue });
      const response = await api.put(`/api/menu/kg-products/${productId}`, { isAvailableForBot: newValue });
      console.log('[ProductAvailabilityDrawer] Respuesta del servidor:', response.data);
      
      // Refetch para asegurar sincronización con DB
      await fetchProducts();
      
      notifications.show({
        title: newValue ? "Producto activado para bot" : "Producto desactivado para bot",
        message: "El bot ahora " + (newValue ? "puede vender" : "NO puede vender") + " este producto",
        color: newValue ? "green" : "orange",
      });
    } catch (err) {
      console.error('[ProductAvailabilityDrawer] Error al actualizar:', err);
      showApiError(err, "Error al actualizar producto");
      // Refetch en caso de error para revertir el estado visual
      await fetchProducts();
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleAll = async (newValue: boolean) => {
    setUpdating("all");
    try {
      await Promise.all(
        products.map(p => api.put(`/api/menu/kg-products/${p.id}`, { isAvailableForBot: newValue }))
      );
      
      // Refetch para asegurar sincronización con DB
      await fetchProducts();
      
      notifications.show({
        title: newValue ? "Todos activados para bot" : "Todos desactivados para bot",
        message: `El bot ahora ${newValue ? "puede vender" : "NO puede vender"} ningún producto`,
        color: newValue ? "green" : "orange",
      });
    } catch (err) {
      showApiError(err, "Error al actualizar productos");
      await fetchProducts();
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Drawer opened={opened} onClose={onClose} title="Control de Stock WhatsApp">
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          Controlá qué productos puede vender el bot de WhatsApp. Los productos desactivados NO serán ofrecidos a los clientes.
        </Alert>

        {loading ? (
          <Center h={200}>
            <Loader color="orange" />
          </Center>
        ) : products.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No hay productos por kilo configurados
          </Text>
        ) : (
          <>
            <Stack
              gap="xs"
              p="sm"
              style={{
                border: "1px solid var(--gd-border)",
                borderRadius: "var(--gd-radius-md)",
                background: "var(--gd-bg)",
              }}
            >
              <Switch
                label={<Text fw={700}>Todos los productos</Text>}
                checked={products.every(p => p.isAvailableForBot)}
                onChange={(e) => handleToggleAll(e.currentTarget.checked)}
                disabled={updating === "all"}
                color="orange"
              />
            </Stack>

            <Stack gap="xs">
              {products.map((product) => (
                <Stack
                  key={product.id}
                  gap={2}
                  p="sm"
                  style={{
                    border: "1px solid var(--gd-border)",
                    borderRadius: "var(--gd-radius-md)",
                    background: product.isAvailableForBot ? "var(--gd-surface)" : "var(--gd-bg)",
                    opacity: updating === product.id ? 0.6 : !product.isAvailable ? 0.5 : 1,
                  }}
                >
                  <Switch
                    label={
                      <Group gap={8}>
                        <Text fw={600}>{product.name}</Text>
                        {!product.isAvailable && (
                          <Badge size="xs" color="gray" variant="light">Desactivado en menú</Badge>
                        )}
                      </Group>
                    }
                    description={`${product.pricePerKg}/kg`}
                    checked={product.isAvailableForBot}
                    onChange={(e) => handleToggle(product.id, e.currentTarget.checked)}
                    disabled={updating === product.id || updating === "all"}
                    color="orange"
                  />
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
