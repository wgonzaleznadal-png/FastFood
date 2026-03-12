"use client";

import { useAuthStore } from "@/store/authStore";
import { usePermissionsStore } from "@/store/permissionsStore";
import { useShiftStore } from "@/store/shiftStore";
import { Text, SimpleGrid, Paper, Group, ThemeIcon, Stack, Alert, Button } from "@mantine/core";
import {
  IconTrendingUp,
  IconClock,
  IconCircleCheck,
  IconCash,
  IconAlertTriangle,
  IconChefHat,
  IconReportMoney,
  IconBook2,
} from "@tabler/icons-react";
import Link from "next/link";
import styles from "./page.module.css";

// ─── Role-specific views ──────────────────────────────────────────────────────

function OwnerManagerView({ userName, tenantName }: { userName: string; tenantName: string }) {
  const { can } = usePermissionsStore();
  const statCards = [
    { label: "Ventas del día", value: "—", icon: IconTrendingUp,  color: "green",  show: can("finanzas") },
  ].filter((c) => c.show);

  const quickActions = [
    { label: "Abrir turno de caja", href: "/dashboard/caja",     icon: IconCash,        color: "orange", show: can("caja") },
    { label: "Ver finanzas",        href: "/dashboard/finanzas", icon: IconReportMoney, color: "green",  show: can("finanzas") },
    { label: "Ir al Menú",          href: "/dashboard/menu",     icon: IconBook2,       color: "blue",   show: can("menu") },
  ].filter((a) => a.show);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className="gd-page-title">Hola, {userName} 👋</h1>
          <p className="gd-page-subtitle">Torre de Control — <strong>{tenantName}</strong></p>
        </div>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mt="lg">
        {statCards.map((card) => (
          <Paper key={card.label} className="gd-card gd-card--stat" withBorder={false}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text className="gd-stat-label">{card.label}</Text>
                <Text className="gd-stat-value">{card.value}</Text>
              </Stack>
              <ThemeIcon color={card.color} variant="light" size="lg" radius="md">
                <card.icon size={20} />
              </ThemeIcon>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {quickActions.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="sm">
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} className={styles.quickAction}>
                <ThemeIcon color={action.color} variant="light" size="xl" radius="md">
                  <action.icon size={22} />
                </ThemeIcon>
                <Text fw={600} size="sm">{action.label}</Text>
              </Link>
            ))}
          </SimpleGrid>
        </div>
      )}
    </>
  );
}

function CashierView({ userName }: { userName: string }) {
  const { activeShift } = useShiftStore();

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className="gd-page-title">Hola, {userName} 👋</h1>
          <p className="gd-page-subtitle">Panel de Cajero</p>
        </div>
      </div>

      {!activeShift ? (
        <Alert
          icon={<IconAlertTriangle size={18} />}
          color="orange"
          radius="md"
          mt="lg"
          title="No tenés un turno abierto"
        >
          Para operar la caja, primero debés abrir un turno.
          <Button
            component={Link}
            href="/dashboard/caja"
            color="orange"
            size="sm"
            mt="sm"
            leftSection={<IconCash size={16} />}
          >
            Ir a Caja
          </Button>
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
          <Paper className="gd-card gd-card--stat">
            <Stack gap={4}>
              <Text className="gd-stat-label">Turno activo desde</Text>
              <Text className="gd-stat-value" style={{ fontSize: "1.25rem" }}>
                {new Date(activeShift.openedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </Stack>
          </Paper>
          <Paper className="gd-card gd-card--stat">
            <Stack gap={4}>
              <Text className="gd-stat-label">Caja inicial</Text>
              <Text className="gd-stat-value">
                ${Number(activeShift.initialCash).toLocaleString("es-AR")}
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="sm">
          <Link href="/dashboard/caja" className={styles.quickAction}>
            <ThemeIcon color="orange" variant="light" size="xl" radius="md">
              <IconCash size={22} />
            </ThemeIcon>
            <Text fw={600} size="sm">Gestionar Caja</Text>
          </Link>
          <Link href="/dashboard/menu" className={styles.quickAction}>
            <ThemeIcon color="blue" variant="light" size="xl" radius="md">
              <IconBook2 size={22} />
            </ThemeIcon>
            <Text fw={600} size="sm">Ir al Menú</Text>
          </Link>
        </SimpleGrid>
      </div>
    </>
  );
}

function CookView({ userName }: { userName: string }) {
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1 className="gd-page-title">Hola, {userName} 👋</h1>
          <p className="gd-page-subtitle">Panel de Cocina</p>
        </div>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
        <Paper className="gd-card gd-card--stat">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="gd-stat-label">Pedidos pendientes</Text>
              <Text className="gd-stat-value">—</Text>
            </Stack>
            <ThemeIcon color="orange" variant="light" size="lg" radius="md">
              <IconClock size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
        <Paper className="gd-card gd-card--stat">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="gd-stat-label">Pedidos listos hoy</Text>
              <Text className="gd-stat-value">—</Text>
            </Stack>
            <ThemeIcon color="green" variant="light" size="lg" radius="md">
              <IconCircleCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
        <Link href="/dashboard/menu" className={styles.quickAction} style={{ display: "inline-flex", maxWidth: 280 }}>
          <ThemeIcon color="orange" variant="light" size="xl" radius="md">
            <IconChefHat size={22} />
          </ThemeIcon>
          <Text fw={600} size="sm">Ir al Menú</Text>
        </Link>
      </div>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
  const userName = user?.name?.split(" ")[0] ?? "Usuario";
  const tenantName = tenant?.name ?? "";
  const role = user?.role ?? "STAFF";

  if (role === "CASHIER") return <CashierView userName={userName} />;
  if (role === "COOK")    return <CookView userName={userName} />;

  return <OwnerManagerView userName={userName} tenantName={tenantName} />;
}
