'use client';

import { Card, Text, Badge, Group, Stack, Alert } from '@mantine/core';
import { IconMapPin, IconStar, IconStarFilled, IconShoppingCart, IconNote } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fmt } from '@/lib/format';

interface CustomerInsights {
  favoriteProduct: { name: string; count: number } | null;
  sundayStreak: number;
  totalPrizes: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
  lastOrderNotes: string | null;
  loyaltyTags: string[];
}

interface CustomerCardProps {
  customer: any;
  isDelivery?: boolean;
  onAutoFill?: (data: { name?: string; address?: string }) => void;
}

export default function CustomerCard({ customer, isDelivery, onAutoFill }: CustomerCardProps) {
  const [insights, setInsights] = useState<CustomerInsights | null>(null);

  useEffect(() => {
    if (!customer?.id) return;
    const load = async () => {
      try {
        const res = await api.get(`/api/customers/phone/${encodeURIComponent(customer.phone)}`);
        setInsights(res.data?.insights || null);
      } catch {
        setInsights(null);
      }
    };
    load();
  }, [customer?.id]);

  if (!customer) return null;

  const defaultAddress = customer.addresses?.find((a: any) => a.isDefault);
  const streak = insights?.sundayStreak ?? 0;
  const totalPrizes = insights?.totalPrizes ?? 0;
  const maxStars = 5;

  return (
    <Card
      withBorder
      p="sm"
      style={{
        backgroundColor: 'var(--gd-surface-secondary)',
        cursor: onAutoFill ? 'pointer' : undefined,
        transition: 'all 0.15s',
        borderColor: 'var(--mantine-color-green-5)',
      }}
      onClick={() => {
        if (onAutoFill) {
          onAutoFill({
            name: customer.name || undefined,
            address: defaultAddress?.street || undefined,
          });
        }
      }}
    >
      <Stack gap={6}>
        {/* Header: name + stats */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700} size="sm">{customer.name || 'Cliente'}</Text>
            <Text size="xs" c="dimmed">
              {customer.totalOrders || customer._count?.orders || 0} pedidos · {fmt(Number(customer.totalSpent || 0))}
            </Text>
          </div>
          <Badge color="green" variant="light" size="xs">ACTIVO</Badge>
        </Group>

        {/* Address */}
        {defaultAddress && (
          <Text size="xs" c="dimmed">
            <IconMapPin size={12} style={{ verticalAlign: 'middle' }} /> {defaultAddress.street}
          </Text>
        )}

        {/* Loyalty Stars */}
        <Group gap={2} align="center">
          {Array.from({ length: maxStars }).map((_, i) => (
            i < streak
              ? <IconStarFilled key={i} size={16} color="var(--mantine-color-orange-5)" />
              : <IconStar key={i} size={16} color="var(--mantine-color-gray-4)" />
          ))}
          {streak > 0 && (
            <Text size="xs" c="orange" fw={600} ml={4}>
              {streak} domingo{streak > 1 ? 's' : ''} seguidos
            </Text>
          )}
        </Group>

        {/* Prizes */}
        {totalPrizes > 0 && (
          <Badge color="yellow" variant="light" size="sm">
            {totalPrizes} premio{totalPrizes > 1 ? 's' : ''} obtenido{totalPrizes > 1 ? 's' : ''}
          </Badge>
        )}

        {/* Favorite product */}
        {insights?.favoriteProduct && (
          <Text size="xs" c="dimmed">
            <IconShoppingCart size={12} style={{ verticalAlign: 'middle' }} /> Favorito: <strong>{insights.favoriteProduct.name}</strong> ({insights.favoriteProduct.count}x)
          </Text>
        )}

        {/* Last order notes */}
        {insights?.lastOrderNotes && (
          <Alert color="blue" variant="light" p="xs" radius="sm" icon={<IconNote size={14} />}>
            <Text size="xs">Último pedido: {insights.lastOrderNotes}</Text>
          </Alert>
        )}

        {/* Customer notes */}
        {customer.notes && (
          <Alert color="yellow" variant="light" p="xs" radius="sm">
            <Text size="xs" fw={600}>{customer.notes}</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
