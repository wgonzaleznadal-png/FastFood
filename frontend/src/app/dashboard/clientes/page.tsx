'use client';

import { useEffect, useState } from 'react';
import { Card, Text, Stack, Group, Button, TextInput, Textarea, Badge, Table, ActionIcon, Modal, Loader, Center, Alert } from '@mantine/core';
import { IconPhone, IconUser, IconMapPin, IconTrophy, IconPlus, IconEdit, IconTrash, IconSearch, IconNote } from '@tabler/icons-react';
import { api, showApiError } from '@/lib/api';
import { notifications } from '@mantine/notifications';
import { fmt } from '@/lib/format';
import PageHeader from '@/components/layout/PageHeader';

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
  addresses: Array<{
    id: string;
    street: string;
    isDefault: boolean;
  }>;
  tags: Array<{
    id: string;
    tag: string;
    value: string | null;
  }>;
  _count?: { orders: number };
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    email: '',
    notes: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/customers');
      setCustomers(res.data);
    } catch (err) {
      showApiError(err, 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.phone || formData.phone.length < 8) {
      notifications.show({ title: 'Error', message: 'Teléfono debe tener al menos 8 dígitos', color: 'red' });
      return;
    }

    try {
      await api.post('/api/customers', formData);
      notifications.show({ title: 'Éxito', message: 'Cliente creado', color: 'green' });
      setCreateModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (err) {
      showApiError(err, 'Error al crear cliente');
    }
  };

  const handleUpdate = async () => {
    if (!editingCustomer) return;

    try {
      await api.patch(`/api/customers/${editingCustomer.id}`, {
        name: formData.name || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
      });
      notifications.show({ title: 'Éxito', message: 'Cliente actualizado', color: 'green' });
      setEditingCustomer(null);
      resetForm();
      fetchCustomers();
    } catch (err) {
      showApiError(err, 'Error al actualizar cliente');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;

    try {
      await api.delete(`/api/customers/${id}`);
      notifications.show({ title: 'Éxito', message: 'Cliente eliminado', color: 'green' });
      fetchCustomers();
    } catch (err) {
      showApiError(err, 'Error al eliminar cliente');
    }
  };

  const resetForm = () => {
    setFormData({ phone: '', name: '', email: '', notes: '' });
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      phone: customer.phone,
      name: customer.name || '',
      email: customer.email || '',
      notes: customer.notes || '',
    });
  };

  const filteredCustomers = customers.filter(c =>
    c.phone.includes(searchTerm) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <PageHeader>
        <div>
          <h1 className="gd-page-title">Clientes</h1>
          <p className="gd-page-subtitle">Gestión de clientes y fidelización</p>
        </div>
      </PageHeader>

      <Stack gap="md" p="md">
        <Card withBorder p="md">
          <Group justify="space-between" mb="md">
            <TextInput
              placeholder="Buscar por teléfono, nombre o email..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              style={{ flex: 1, maxWidth: 400 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Nuevo Cliente
            </Button>
          </Group>

          {loading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : filteredCustomers.length === 0 ? (
            <Alert color="blue" icon={<IconUser size={16} />}>
              {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </Alert>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Contacto</Table.Th>
                  <Table.Th>Pedidos</Table.Th>
                  <Table.Th>Total gastado</Table.Th>
                  <Table.Th>Notas</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredCustomers.map((customer) => (
                  <Table.Tr key={customer.id}>
                    <Table.Td>
                      <div>
                        <Text fw={600}>{customer.name || 'Sin nombre'}</Text>
                        {customer.addresses.find(a => a.isDefault) && (
                          <Text size="xs" c="dimmed">
                            <IconMapPin size={12} style={{ verticalAlign: 'middle' }} />
                            {' '}{customer.addresses.find(a => a.isDefault)?.street}
                          </Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        <IconPhone size={12} style={{ verticalAlign: 'middle' }} />
                        {' '}{customer.phone}
                      </Text>
                      {customer.email && (
                        <Text size="xs" c="dimmed">{customer.email}</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue" variant="light">
                        {customer.totalOrders} pedidos
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600}>{fmt(customer.totalSpent)}</Text>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 200 }}>
                      {customer.notes ? (
                        <Text size="xs" c="dimmed" lineClamp={2}><IconNote size={12} style={{ verticalAlign: 'middle' }} /> {customer.notes}</Text>
                      ) : (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => openEditModal(customer)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => handleDelete(customer.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>

      <Modal
        opened={createModalOpen}
        onClose={() => { setCreateModalOpen(false); resetForm(); }}
        title="Nuevo Cliente"
      >
        <Stack gap="md">
          <TextInput
            label="Teléfono"
            placeholder="1234567890"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.currentTarget.value })}
            required
            leftSection={<IconPhone size={16} />}
          />
          <TextInput
            label="Nombre"
            placeholder="Juan Pérez"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            placeholder="juan@example.com"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setCreateModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>
              Crear Cliente
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!editingCustomer}
        onClose={() => { setEditingCustomer(null); resetForm(); }}
        title="Editar Cliente"
      >
        <Stack gap="md">
          <TextInput
            label="Teléfono"
            value={formData.phone}
            disabled
            leftSection={<IconPhone size={16} />}
          />
          <TextInput
            label="Nombre"
            placeholder="Juan Pérez"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            placeholder="juan@example.com"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
          />
          <Textarea
            label="Notas del negocio"
            placeholder="Ej: siempre pide sin sal, paga con cambio justo..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
            autosize
            minRows={2}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => { setEditingCustomer(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>
              Guardar Cambios
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
