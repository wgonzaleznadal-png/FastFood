"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  Text, Stack, Group, ThemeIcon, Button,
  NumberInput, TextInput, Textarea, Loader, Center,
  SimpleGrid, Badge, Switch, Tabs,
} from "@mantine/core";
import { IconScale, IconPlus, IconTrash, IconChefHat } from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { fmt } from "@/lib/format";
import type { KgProduct } from "@/lib/types";
import Drawer from "@/components/layout/Drawer";
import PageHeader from "@/components/layout/PageHeader";
import styles from "./pedidos-kg.module.css";

export default function PedidosKgPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [products, setProducts] = useState<KgProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<KgProduct | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState<number | string>("");
  const [formAvailable, setFormAvailable] = useState(true);

  const canManage = user?.role === "OWNER" || user?.role === "MANAGER";

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/products?section=KILO");
      setProducts(res.data);
    } catch (err) {
      showApiError(err, "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openDrawer = (product?: KgProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormDescription(product.description || "");
      setFormPrice(Number(product.pricePerKg));
      setFormAvailable(product.isAvailable);
    } else {
      setEditingProduct(null);
      setFormName("");
      setFormDescription("");
      setFormPrice("");
      setFormAvailable(true);
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice) {
      notifications.show({ title: "Campos requeridos", message: "Nombre y precio son obligatorios", color: "orange" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        pricePerKg: Number(formPrice),
        price: Number(formPrice),
        isAvailable: formAvailable,
        section: "KILO",
        unitType: "KG",
      };
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        notifications.show({ title: "Producto actualizado", message: formName, color: "green" });
      } else {
        await api.post("/products", payload);
        notifications.show({ title: "Producto creado", message: formName, color: "green" });
      }
      setDrawerOpen(false);
      fetchProducts();
    } catch (err) {
      showApiError(err, "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProduct) return;
    if (!confirm(`¿Eliminar "${editingProduct.name}"?`)) return;
    setSaving(true);
    try {
      await api.delete(`/products/${editingProduct.id}`);
      notifications.show({ title: "Producto eliminado", message: editingProduct.name, color: "gray" });
      setDrawerOpen(false);
      fetchProducts();
    } catch (err) {
      showApiError(err, "Error al eliminar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        actions={
          canManage ? (
            <Button
              color="orange"
              leftSection={<IconPlus size={16} />}
              onClick={() => openDrawer()}
            >
              Nuevo producto
            </Button>
          ) : undefined
        }
      >
        <Tabs value="pedidos_kg" variant="pills" onChange={(value) => {
          if (value === "carta") router.push("/dashboard/menu/carta");
        }}>
          <Tabs.List>
            <Tabs.Tab value="pedidos_kg" leftSection={<IconScale size={16} />}>
              Pedidos x KG
            </Tabs.Tab>
            <Tabs.Tab value="carta" leftSection={<IconChefHat size={16} />}>
              Carta
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </PageHeader>

      {/* ── Product list ── */}
      {loading ? (
        <Center h={200}><Loader color="orange" /></Center>
      ) : products.length === 0 ? (
        <div className={styles.emptyState}>
          <ThemeIcon color="orange" variant="light" size={64} radius="xl">
            <IconScale size={32} />
          </ThemeIcon>
          <Text fw={700} size="lg" mt="md">No hay productos cargados</Text>
          <Text size="sm" c="dimmed" mt={4}>
            Agregá los productos que vendés por kilogramo.
          </Text>
          {canManage && (
            <Button
              color="orange"
              leftSection={<IconPlus size={16} />}
              mt="lg"
              onClick={() => openDrawer()}
            >
              Nuevo producto
            </Button>
          )}
        </div>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" mt="lg">
          {products.map((product) => (
            <button
              key={product.id}
              className={styles.productCard}
              onClick={() => openDrawer(product)}
              disabled={!canManage}
              style={{ cursor: canManage ? "pointer" : "default" }}
            >
              <Group justify="space-between" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={700} size="md">{product.name}</Text>
                  {product.description && (
                    <Text size="sm" c="dimmed">{product.description}</Text>
                  )}
                </Stack>
                <Stack gap={4} align="flex-end">
                  <Text fw={800} size="lg" c="orange">{fmt(product.pricePerKg)}</Text>
                  <Text size="xs" c="dimmed">/ kg</Text>
                </Stack>
              </Group>
              {!product.isAvailable && (
                <Badge color="red" size="xs" mt="xs" variant="light">No disponible</Badge>
              )}
            </button>
          ))}
        </SimpleGrid>
      )}

      {/* ── New product drawer ── */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingProduct ? "Editar producto" : "Nuevo producto x KG"}
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Nombre del producto"
            placeholder="Ej: Carne picada, Queso en barra..."
            value={formName}
            onChange={(e) => setFormName(e.currentTarget.value)}
            required
          />

          <Textarea
            label="Descripción (opcional)"
            placeholder="Ej: Corte especial, sin hueso..."
            rows={2}
            value={formDescription}
            onChange={(e) => setFormDescription(e.currentTarget.value)}
          />

          <NumberInput
            label="Precio por kg ($)"
            placeholder="0.00"
            min={0.01}
            decimalScale={2}
            prefix="$"
            value={formPrice}
            onChange={setFormPrice}
            required
          />

          <Switch
            label="Disponible para venta"
            checked={formAvailable}
            onChange={(e) => setFormAvailable(e.currentTarget.checked)}
            color="orange"
          />

          <Group justify="space-between" mt="xs">
            {editingProduct ? (
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleDelete}
                loading={saving}
              >
                Eliminar
              </Button>
            ) : <div />}
            <Group gap="xs">
              <Button variant="subtle" color="gray" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                color="orange"
                loading={saving}
                leftSection={<IconPlus size={16} />}
                onClick={handleSave}
              >
                {editingProduct ? "Guardar cambios" : "Crear producto"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>
    </div>
  );
}
