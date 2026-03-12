"use client";

import { useState, useEffect } from "react";
import { Stack, Tabs, Button, Group, Text, ActionIcon, Badge, Loader, Center } from "@mantine/core";
import { IconChefHat, IconGlass, IconPlus, IconMinus } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import Drawer from "@/components/layout/Drawer";

interface CartaProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  destination: "KITCHEN" | "BAR" | "DELIVERY";
  isAvailable: boolean;
  preparationTime?: number;
}

interface CartaItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartaSelectorProps {
  opened: boolean;
  onClose: () => void;
  onAddItems: (items: CartaItem[]) => void;
}

export default function CartaSelector({ opened, onClose, onAddItems }: CartaSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>("KITCHEN");
  const [items, setItems] = useState<CartaProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartaItem[]>([]);

  useEffect(() => {
    if (opened) {
      fetchItems();
    }
  }, [activeTab, opened]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/products?section=CARTA&destination=${activeTab}`);
      setItems(response.data.filter((item: CartaProduct) => item.isAvailable));
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (productId: string, name: string, price: number, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
          return prev.filter((i) => i.productId !== productId);
        }
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: newQty } : i
        );
      } else if (delta > 0) {
        return [...prev, { productId, name, price, quantity: delta }];
      }
      return prev;
    });
  };

  const handleAddToOrder = () => {
    if (cart.length > 0) {
      onAddItems(cart);
      setCart([]);
      onClose();
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Agregar de Carta"
      size="md"
    >
      <Stack gap="md">
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || "KITCHEN")}>
          <Tabs.List>
            <Tabs.Tab value="KITCHEN" leftSection={<IconChefHat size={16} />}>
              Cocina
            </Tabs.Tab>
            <Tabs.Tab value="BAR" leftSection={<IconGlass size={16} />}>
              Barra
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {loading ? (
          <Center h={200}>
            <Loader color="orange" />
          </Center>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No hay items disponibles
          </Text>
        ) : (
          <Stack gap="xs">
            {items.map((item) => {
              const inCart = cart.find((i) => i.productId === item.id);
              return (
                <Group key={item.id} justify="space-between" p="sm" style={{
                  border: "1px solid var(--gd-border)",
                  borderRadius: "8px",
                  background: inCart ? "rgba(249, 115, 22, 0.05)" : "transparent",
                }}>
                  <div style={{ flex: 1 }}>
                    <Text fw={600} size="sm">{item.name}</Text>
                    {item.description && (
                      <Text size="xs" c="dimmed">{item.description}</Text>
                    )}
                    <Text size="sm" c="orange" fw={700}>{fmt(item.price)}</Text>
                  </div>
                  <Group gap={4}>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="red"
                      onClick={() => updateQuantity(item.id, item.name, item.price, -1)}
                      disabled={!inCart}
                    >
                      <IconMinus size={12} />
                    </ActionIcon>
                    <Text fw={700} size="sm" style={{ minWidth: "30px", textAlign: "center" }}>
                      {inCart?.quantity || 0}
                    </Text>
                    <ActionIcon
                      size="sm"
                      variant="light"
                      color="green"
                      onClick={() => updateQuantity(item.id, item.name, item.price, 1)}
                    >
                      <IconPlus size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        )}

        {cart.length > 0 && (
          <>
            <Group justify="space-between" p="md" style={{
              background: "var(--gd-bg-secondary)",
              borderRadius: "8px",
              border: "1px solid var(--gd-border)",
            }}>
              <Text fw={700}>TOTAL</Text>
              <Text fw={800} size="lg" c="orange">{fmt(total)}</Text>
            </Group>

            <Button
              color="orange"
              fullWidth
              size="md"
              onClick={handleAddToOrder}
            >
              Agregar {cart.length} item{cart.length > 1 ? "s" : ""} al pedido
            </Button>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
