"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, Button, Table, Badge, ActionIcon, TextInput, NumberInput, Select, Textarea, Switch, Group, Stack, Center, Loader, Text, ThemeIcon } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconPlus, IconEdit, IconTrash, IconChefHat, IconGlass, IconScale } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api, showApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import PageHeader from "@/components/layout/PageHeader";
import Drawer from "@/components/layout/Drawer";

// Definición de Tipos alineada con el Backend (GastroPla Unificado)
interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category: "COMIDA" | "BEBIDA";
  destination: "COCINA" | "BARRA" | "DESPACHO";
  isAvailable: boolean;
  preparationTime?: number;
  sortOrder: number;
}

export default function CartaPage() {
  const router = useRouter();
  // El tab activo ahora maneja los valores reales de la DB para simplificar todo
  const [activeTab, setActiveTab] = useState<string>("COMIDA");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Inicializamos el form con los valores que espera Prisma
  const form = useForm({
    initialValues: {
      name: "",
      description: "",
      price: 0,
      imageUrl: "",
      category: "COMIDA" as "COMIDA" | "BEBIDA",
      destination: "COCINA" as "COCINA" | "BARRA",
      isAvailable: true,
      preparationTime: undefined as number | undefined,
      sortOrder: 0,
    },
    validate: {
      name: (value) => (!value ? "El nombre es requerido" : null),
      price: (value) => (value <= 0 ? "El precio debe ser mayor a 0" : null),
    },
  });

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      // Llamada unificada: "Traeme todo lo que es de CARTA y pertenece a esta Categoría"
      const response = await api.get(`/products?section=CARTA&category=${activeTab}`);
      setItems(response.data);
    } catch (error) {
      showApiError(error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreate = () => {
    form.reset();
    form.setFieldValue("category", activeTab as "COMIDA" | "BEBIDA");
    form.setFieldValue("destination", activeTab === "COMIDA" ? "COCINA" : "BARRA");
    setEditingItem(null);
    setModalOpened(true);
  };

  const handleEdit = (item: MenuItem) => {
    form.setValues({
      name: item.name,
      description: item.description || "",
      price: Number(item.price),
      imageUrl: item.imageUrl || "",
      category: item.category,
      destination: item.destination as "COCINA" | "BARRA", // Forzamos tipo para el Select
      isAvailable: item.isAvailable,
      preparationTime: item.preparationTime,
      sortOrder: item.sortOrder,
    });
    setEditingItem(item);
    setModalOpened(true);
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      // 🚨 LA MAGIA UNIFICADORA 🚨
      // Armamos el paquete EXACTO que Prisma necesita para no explotar.
      const payload = {
        ...values,
        section: "CARTA",    // Obligatorio: Esto no es de Kilo, es de Carta.
        unitType: "UNIT",    // Obligatorio: Rabas/Bebidas se venden por unidad.
        price: Number(values.price), // Aseguramos que sea un número
      };

      if (editingItem) {
        await api.put(`/products/${editingItem.id}`, payload);
        notifications.show({
          title: "¡Oído cocina!",
          message: `${values.name} actualizado correctamente.`,
          color: "green",
        });
      } else {
        await api.post("/products", payload);
        notifications.show({
          title: "¡Oído cocina!",
          message: `${values.name} sumado a la carta.`,
          color: "green",
        });
      }
      setModalOpened(false);
      fetchItems();
    } catch (error) {
      showApiError(error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${name}" de la carta?`)) return;
    try {
      await api.delete(`/products/${id}`);
      notifications.show({
        title: "Item eliminado",
        message: `${name} ya no está en la carta.`,
        color: "orange",
      });
      fetchItems();
    } catch (error) {
      showApiError(error);
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      await api.patch(`/products/${id}/toggle`);
      fetchItems();
    } catch (error) {
      showApiError(error);
    }
  };

  return (
    <div>
      <PageHeader
        actions={
          <Button
            color="orange"
            leftSection={<IconPlus size={16} />}
            onClick={handleCreate}
          >
            Nuevo Item
          </Button>
        }
      >
        <Tabs value="carta" variant="pills" onChange={(value) => {
          if (value === "pedidos_kg") router.push("/dashboard/menu/pedidos-kg");
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

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || "COMIDA")} mt="lg">
        <Tabs.List>
          <Tabs.Tab value="COMIDA" leftSection={<IconChefHat size={16} />}>
            Comidas
          </Tabs.Tab>
          <Tabs.Tab value="BEBIDA" leftSection={<IconGlass size={16} />}>
            Bebidas
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="COMIDA" pt="xl">
          <ItemsTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleAvailability={handleToggleAvailability}
          />
        </Tabs.Panel>

        <Tabs.Panel value="BEBIDA" pt="xl">
          <ItemsTable
            items={items}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleAvailability={handleToggleAvailability}
          />
        </Tabs.Panel>
      </Tabs>

      <Drawer
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingItem ? "Editar Item" : "Nuevo Item de Carta"}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nombre"
              placeholder="Ej: Rabas, Vino Tinto, etc."
              required
              {...form.getInputProps("name")}
            />

            <Textarea
              label="Descripción"
              placeholder="Descripción opcional del item"
              {...form.getInputProps("description")}
            />

            <NumberInput
              label="Precio"
              placeholder="0.00"
              required
              min={0}
              decimalScale={2}
              prefix="$"
              {...form.getInputProps("price")}
            />

            <Select
              label="Destino de Comanda"
              description="¿A dónde se imprime cuando entra el pedido?"
              data={[
                { value: "COCINA", label: "Cocina" },
                { value: "BARRA", label: "Barra" },
              ]}
              {...form.getInputProps("destination")}
            />

            <NumberInput
              label="Tiempo de preparación (minutos)"
              placeholder="Opcional"
              min={0}
              {...form.getInputProps("preparationTime")}
            />

            <TextInput
              label="URL de imagen"
              placeholder="https://..."
              {...form.getInputProps("imageUrl")}
            />

            <Switch
              label="Disponible para Venta"
              color="orange"
              {...form.getInputProps("isAvailable", { type: "checkbox" })}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={() => setModalOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="orange">
                {editingItem ? "Actualizar" : "Crear"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </div>
  );
}

function ItemsTable({
  items,
  loading,
  onEdit,
  onDelete,
  onToggleAvailability,
}: {
  items: MenuItem[];
  loading: boolean;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string, name: string) => void;
  onToggleAvailability: (id: string) => void;
}) {
  if (loading) {
    return <Center h={200}><Loader color="orange" /></Center>;
  }

  if (items.length === 0) {
    return (
      <Center h={200} style={{ flexDirection: "column" }}>
        <ThemeIcon color="orange" variant="light" size={64} radius="xl">
          <IconChefHat size={32} />
        </ThemeIcon>
        <Text fw={700} size="lg" mt="md">La carta está vacía</Text>
        <Text size="sm" c="dimmed" mt={4}>
          Sumá tus primeros platos y bebidas para empezar a vender.
        </Text>
      </Center>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Nombre</Table.Th>
          <Table.Th>Precio</Table.Th>
          <Table.Th>Destino</Table.Th>
          <Table.Th>Tiempo Prep.</Table.Th>
          <Table.Th>Estado</Table.Th>
          <Table.Th>Acciones</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td>
              <div>
                <Text fw={500}>{item.name}</Text>
                {item.description && (
                  <Text size="xs" c="dimmed">
                    {item.description}
                  </Text>
                )}
              </div>
            </Table.Td>
            <Table.Td>
              <Text fw={700} c="orange">{fmt(item.price)}</Text>
            </Table.Td>
            <Table.Td>
              <Badge color={item.destination === "COCINA" ? "orange" : "blue"} variant="light">
                {item.destination}
              </Badge>
            </Table.Td>
            <Table.Td>
              {item.preparationTime ? (
                <Text size="sm">{item.preparationTime} min</Text>
              ) : (
                <Text size="sm" c="dimmed">-</Text>
              )}
            </Table.Td>
            <Table.Td>
              <Switch
                checked={item.isAvailable}
                onChange={() => onToggleAvailability(item.id)}
                size="sm"
                color="orange"
              />
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon
                  variant="subtle"
                  color="blue"
                  onClick={() => onEdit(item)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() => onDelete(item.id, item.name)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}