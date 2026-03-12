'use client';

import { Card, Text, Badge, Group, Stack, Loader, Alert } from '@mantine/core';
import { IconPhone, IconMapPin, IconTrophy, IconClock, IconShoppingCart } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';

interface CustomerInsights {
  favoriteProduct: { name: string; count: number } | null;
  sundayStreak: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  loyaltyTags: string[];
}

interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  addresses: Array<{
    id: string;
    street: string;
    reference: string | null;
    isDefault: boolean;
  }>;
  insights: CustomerInsights;
}

interface CustomerCardProps {
  phone: string;
  onCustomerLoaded?: (customer: Customer) => void;
}

export default function CustomerCard({ phone, onCustomerLoaded }: CustomerCardProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone || phone.length < 8) {
      setLoading(false);
      return;
    }

    const fetchCustomer = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/api/customers/phone/${phone}`);
        setCustomer(res.data);
        onCustomerLoaded?.(res.data);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Cliente nuevo');
        } else {
          setError('Error al cargar datos del cliente');
        }
        setCustomer(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [phone, onCustomerLoaded]);

  if (loading) {
    return (
      <Card withBorder p="md">
        <Group justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Cargando datos del cliente...</Text>
        </Group>
      </Card>
    );
  }

  // No mostrar nada si es cliente nuevo o hay error
  if (error && !customer) {
    return null;
  }

  if (!customer) return null;

  const { insights } = customer;
  const defaultAddress = customer.addresses.find(a => a.isDefault);

  return (
    <Card withBorder p="md" style={{ backgroundColor: 'var(--gd-surface-secondary)' }}>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Text fw={600} size="lg">{customer.name || 'Cliente'}</Text>
            <Text size="sm" c="dimmed">
              <IconPhone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {customer.phone}
            </Text>
          </div>
          <Badge color="blue" variant="light">
            {customer.totalOrders} pedidos
          </Badge>
        </Group>

        {/* Dirección por defecto */}
        {defaultAddress && (
          <Group gap="xs">
            <IconMapPin size={16} color="var(--gd-text-secondary)" />
            <Text size="sm" c="dimmed">
              {defaultAddress.street}
              {defaultAddress.reference && ` (${defaultAddress.reference})`}
            </Text>
          </Group>
        )}

        {/* Insights de Fidelización */}
        {insights.loyaltyTags.length > 0 && (
          <Group gap="xs">
            {insights.loyaltyTags.map((tag, idx) => (
              <Badge key={idx} color="green" variant="light" leftSection={<IconTrophy size={12} />}>
                {tag}
              </Badge>
            ))}
          </Group>
        )}

        {/* Producto favorito */}
        {insights.favoriteProduct && (
          <Group gap="xs">
            <IconShoppingCart size={16} color="var(--gd-text-secondary)" />
            <Text size="sm">
              <strong>{insights.favoriteProduct.name}</strong>
              <Text span c="dimmed"> ({insights.favoriteProduct.count}x)</Text>
            </Text>
          </Group>
        )}

        {/* Estadísticas */}
        <Group gap="md" grow>
          <div>
            <Text size="xs" c="dimmed">Total gastado</Text>
            <Text fw={600}>{fmt(customer.totalSpent)}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Promedio</Text>
            <Text fw={600}>{fmt(insights.averageOrderValue)}</Text>
          </div>
          {insights.daysSinceLastOrder !== null && (
            <div>
              <Text size="xs" c="dimmed">
                <IconClock size={12} style={{ verticalAlign: 'middle' }} /> Último pedido
              </Text>
              <Text fw={600}>
                {insights.daysSinceLastOrder === 0 
                  ? 'Hoy' 
                  : `Hace ${insights.daysSinceLastOrder}d`}
              </Text>
            </div>
          )}
        </Group>

        {/* Racha de domingos */}
        {insights.sundayStreak > 0 && (
          <Alert color="orange" variant="light">
            <Text size="sm" fw={600}>
              🔥 Racha de {insights.sundayStreak} domingo{insights.sundayStreak > 1 ? 's' : ''}
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
