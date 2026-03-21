"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { usePermissionsStore } from "@/store/permissionsStore";
import { api } from "@/lib/api";
import { 
  Text, 
  ActionIcon, 
  Stack, 
  Button, 
  Popover,
  Group,
  Paper,
  Divider,
  CloseButton,
  Modal,
  Select,
  Badge,
} from "@mantine/core";
import {
  IconLayoutDashboard,
  IconCash,
  IconMenu2,
  IconChefHat,
  IconSettings,
  IconBell,
  IconPower,
  IconX,
  IconLogout,
  IconCircleCheck,
  IconBook2,
  IconReportMoney,
  IconWallet,
  IconCreditCard,
  IconBuildingBank,
  IconCoin,
  IconEye,
  IconUserPlus,
  IconTrash,
  IconBrandWhatsapp,
  IconUsers,
} from "@tabler/icons-react";
import { useShiftStore } from "@/store/shiftStore";
import { mapShiftFromApi } from "@/lib/shiftFromApi";
import OpenShiftForm from "@/components/caja/OpenShiftForm";
import Link from "next/link";
import styles from "./layout.module.css";

// Definición de items de navegación
const ALL_NAV_ITEMS = [
  { href: "/dashboard",               label: "Torre de Control", icon: IconLayoutDashboard, moduleKey: "dashboard" },
  { href: "/dashboard/caja",          label: "Caja",             icon: IconCash,            moduleKey: "caja" },
  { href: "/dashboard/whatsapp",      label: "WhatsApp CRM",     icon: IconBrandWhatsapp,   moduleKey: "whatsapp" },
  { href: "/dashboard/clientes",      label: "Clientes",         icon: IconUsers,           moduleKey: "caja" },
  { href: "/dashboard/menu",          label: "Menú",             icon: IconBook2,           moduleKey: "menu" },
  { href: "/dashboard/cocina",        label: "Cocina",           icon: IconChefHat,         moduleKey: "cocina" },
  { href: "/dashboard/finanzas",      label: "Finanzas",         icon: IconReportMoney,     moduleKey: "finanzas" },
  { href: "/dashboard/configuracion", label: "Configuración",    icon: IconSettings,        moduleKey: "configuracion" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, tenant, clearAuth, _hasHydrated } = useAuthStore();
  const { fetchPermissions, clearPermissions, can, isLoaded } = usePermissionsStore();
  const { activeShift, setActiveShift } = useShiftStore();
  const [shiftSummary, setShiftSummary] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [turnoPopoverOpen, setTurnoPopoverOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addingCollab, setAddingCollab] = useState(false);
  const sessionRenewedRef = useRef(false);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors - clear local state anyway
    }
    clearAuth();
    clearPermissions();
    router.push("/login");
  };

  const getSectionName = () => {
    if (pathname === "/dashboard") return "Torre de Control";
    if (pathname.startsWith("/dashboard/caja")) return "Caja";
    if (pathname.startsWith("/dashboard/whatsapp")) return "WhatsApp CRM";
    if (pathname.startsWith("/dashboard/clientes")) return "Clientes";
    if (pathname.startsWith("/dashboard/menu")) return "Menú";
    if (pathname.startsWith("/dashboard/cocina")) return "Cocina";
    if (pathname.startsWith("/dashboard/finanzas")) return "Finanzas";
    if (pathname.startsWith("/dashboard/configuracion")) return "Configuración";
    return "Dashboard";
  };

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // Tras F5: renovar cookies y recién ahí pedir permisos (evita 401 por token corto vencido).
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) return;
    if (sessionRenewedRef.current) return;
    sessionRenewedRef.current = true;
    void (async () => {
      try {
        const res = await api.post("/auth/refresh");
        if (res.data?.user && res.data?.tenant) {
          useAuthStore.getState().setAuth(res.data.user, res.data.tenant);
        }
      } catch {
        clearAuth();
        clearPermissions();
        router.replace("/login");
        return;
      }
      await fetchPermissions();
    })();
  }, [_hasHydrated, isAuthenticated, router, clearAuth, clearPermissions, fetchPermissions]);

  useEffect(() => {
    if (activeShift && turnoPopoverOpen) {
      fetchShiftSummary();
    }
  }, [activeShift, turnoPopoverOpen]);

  const fetchShiftSummary = async () => {
    if (!activeShift) return;
    try {
      const res = await api.get(`/shifts/${activeShift.id}/summary`);
      setShiftSummary(res.data);
    } catch (err) {
      console.error("Error fetching shift summary:", err);
    }
  };

  const fetchTenantUsers = async () => {
    try {
      const res = await api.get("/config/users");
      setTenantUsers(res.data);
    } catch { /* silent */ }
  };

  const handleAddCollaborator = async () => {
    if (!activeShift || !selectedUserId) return;
    setAddingCollab(true);
    try {
      await api.post(`/shifts/${activeShift.id}/collaborators`, { userId: selectedUserId });
      const res = await api.get("/shifts/me");
      setActiveShift(mapShiftFromApi(res.data));
      setSelectedUserId(null);
    } catch (err) {
      console.error("Error adding collaborator:", err);
    } finally {
      setAddingCollab(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!activeShift) return;
    try {
      await api.delete(`/shifts/${activeShift.id}/collaborators/${userId}`);
      const res = await api.get("/shifts/me");
      setActiveShift(mapShiftFromApi(res.data));
    } catch (err) {
      console.error("Error removing collaborator:", err);
    }
  };

  const isShiftOwner = activeShift && user && activeShift.openedById === user.id;

  if (!_hasHydrated || !isAuthenticated) return null;

  const visibleNavItems = isLoaded
    ? ALL_NAV_ITEMS.filter((item) => can(item.moduleKey))
    : [];

  return (
    <div className="gd-layout">
      {/* Overlay para móviles */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR: Siempre muestra iconos + texto */}
      <aside className={`gd-sidebar ${sidebarOpen ? "gd-sidebar--open" : ""}`}>
        <div className={styles.sidebarHeader}>
          <IconChefHat size={28} color="#f97316" style={{ flexShrink: 0 }} />
          <Stack gap={0} style={{ overflow: "hidden" }}>
            <Text fw={700} size="lg" c="#000000" style={{ lineHeight: 1, whiteSpace: "nowrap" }}>GastroDash</Text>
            <Text size="xs" c="#999999" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tenant?.name}</Text>
          </Stack>
        </div>

        <nav className={styles.nav}>
          {visibleNavItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`gd-nav-item ${isActive ? "gd-nav-item--active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                <Text className={styles.navLabel}>
                  {label}
                </Text>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="gd-main">
        <header className="gd-header">
          {/* Título de sección a la izquierda */}
          <div className={styles.headerLeft}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={() => setSidebarOpen((o) => !o)}
              className={styles.menuBtn}
            >
              {sidebarOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
            </ActionIcon>
            <Text fw={700} size="xl" c="#000000">
              {getSectionName()}
            </Text>
          </div>

          {/* Área central para tabs */}
          <div className={styles.headerCenter} id="page-header-center">
          </div>

          {/* Botones de acción rápida de cada página */}
          <div id="page-header-actions" style={{ display: "flex", gap: "var(--gd-space-2)" }}>
          </div>

          {/* 4 iconos de acciones fijas a la derecha */}
          <div className={styles.headerRight}>
            <Popover
              opened={turnoPopoverOpen}
              onChange={setTurnoPopoverOpen}
              position="bottom-end"
              shadow="lg"
              width={340}
              radius="md"
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => setTurnoPopoverOpen((o) => !o)}
                  aria-label="Gestión de turno"
                  style={{ 
                    color: activeShift ? "#22c55e" : "var(--gd-text-secondary)",
                    border: activeShift ? "2px solid #22c55e" : "2px solid transparent",
                    borderRadius: "8px"
                  }}
                >
                  {activeShift ? <IconCircleCheck size={20} /> : <IconPower size={20} />}
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown p={0} style={{ 
                borderRadius: "16px", 
                background: "#ffffff",
                border: "1px solid var(--gd-border)",
                minWidth: "420px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)"
              }}>
                {activeShift ? (
                  <Stack gap={0}>
                    {/* Header */}
                    <Group justify="space-between" p="lg" pb="md" style={{ borderBottom: "1px solid var(--gd-border)" }}>
                      <Group gap="md">
                        <div style={{ 
                          background: "rgba(34, 197, 94, 0.1)", 
                          borderRadius: "12px", 
                          padding: "10px",
                          display: "flex"
                        }}>
                          <IconWallet size={24} color="#22c55e" />
                        </div>
                        <Stack gap={2}>
                          <Group gap="xs">
                            <Text fw={700} size="lg" c="#1a1a1a">Caja Activa</Text>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                          </Group>
                          {activeShift.collaborators && activeShift.collaborators.length > 0 && (
                            <Badge size="xs" variant="light" color="blue">
                              +{activeShift.collaborators.length} colab.
                            </Badge>
                          )}
                          <Text size="xs" c="dimmed">
                            Desde {new Date(activeShift.openedAt).toLocaleString("es-AR", { 
                              hour: "2-digit", 
                              minute: "2-digit"
                            })}
                          </Text>
                        </Stack>
                      </Group>
                      <Group gap="xs">
                        {isShiftOwner && (
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="md"
                            onClick={() => {
                              fetchTenantUsers();
                              setCollabModalOpen(true);
                            }}
                            aria-label="Agregar colaborador"
                          >
                            <IconUserPlus size={16} />
                          </ActionIcon>
                        )}
                        <CloseButton 
                          onClick={() => setTurnoPopoverOpen(false)} 
                          style={{ color: "#999999" }}
                        />
                      </Group>
                    </Group>

                    {/* Resumen de montos */}
                    <Group grow p="lg" pb="md" gap="xs">
                      <Paper p="md" radius="md" style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                        <Text size="xs" c="dimmed" mb={4}>INGRESOS</Text>
                        <Text fw={700} size="lg" c="green">
                          ${shiftSummary?.totalSales ? Number(shiftSummary.totalSales).toFixed(0) : "0"}
                        </Text>
                      </Paper>
                      <Paper p="md" radius="md" style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                        <Text size="xs" c="dimmed" mb={4}>EGRESOS</Text>
                        <Text fw={700} size="lg" c="red">
                          ${shiftSummary?.totalExpenses ? Number(shiftSummary.totalExpenses).toFixed(0) : "0"}
                        </Text>
                      </Paper>
                      <Paper p="md" radius="md" style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                        <Text size="xs" c="dimmed" mb={4}>EN CAJA</Text>
                        <Text fw={700} size="lg" c="blue">
                          ${shiftSummary ? (Number(activeShift.initialCash) + Number(shiftSummary.totalSales || 0) - Number(shiftSummary.totalExpenses || 0)).toFixed(0) : "0"}
                        </Text>
                      </Paper>
                    </Group>

                    {/* Métodos de pago */}
                    <Stack gap={0} px="lg" pb="md">
                      <Group gap="xs" mb="sm">
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Por método de pago</Text>
                      </Group>
                      <Stack gap="xs">
                        {shiftSummary?.paymentMethods?.map((method: any) => {
                          const icons: Record<string, any> = {
                            efectivo: IconCash,
                            transferencia: IconBuildingBank,
                            credito: IconCreditCard,
                            debito: IconCreditCard,
                          };
                          const colors: Record<string, string> = {
                            efectivo: "#22c55e",
                            transferencia: "#a855f7",
                            credito: "#3b82f6",
                            debito: "#3b82f6",
                          };
                          const Icon = icons[method.id] || IconCoin;
                          const color = colors[method.id] || "#94a3b8";
                          return (
                            <Group key={method.id} justify="space-between" p="sm" style={{ 
                              background: "var(--gd-bg-secondary)",
                              borderRadius: "8px",
                              border: "1px solid var(--gd-border)"
                            }}>
                              <Group gap="sm">
                                <div style={{ 
                                  background: `${color}15`,
                                  borderRadius: "8px",
                                  padding: "6px",
                                  display: "flex"
                                }}>
                                  <Icon size={18} color={color} />
                                </div>
                                <Text size="sm" c="#1a1a1a">{method.name}</Text>
                              </Group>
                              <Text fw={700} size="sm" c="#1a1a1a">${Number(method.amount).toFixed(0)}</Text>
                            </Group>
                          );
                        }) || (
                          <Text size="sm" c="dimmed" ta="center" py="md">Cargando...</Text>
                        )}
                      </Stack>
                    </Stack>

                    {/* Botones */}
                    <Group gap="xs" p="lg" pt="md" grow style={{ borderTop: "1px solid var(--gd-border)" }}>
                      <Button
                        variant="light"
                        color="gray"
                        leftSection={<IconEye size={18} />}
                        onClick={() => {
                          setTurnoPopoverOpen(false);
                          router.push("/dashboard/caja/sistema");
                        }}
                      >
                        Ver detalle
                      </Button>
                      <Button
                        color="red"
                        leftSection={<IconX size={18} />}
                        onClick={() => {
                          setTurnoPopoverOpen(false);
                          if (pathname !== "/dashboard/caja/sistema") {
                            router.push("/dashboard/caja/sistema?action=close");
                          } else {
                            window.dispatchEvent(new CustomEvent('openCloseDrawer'));
                          }
                        }}
                      >
                        Cerrar Caja
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <div style={{ padding: "var(--gd-space-4)" }}>
                    <OpenShiftForm onSuccess={() => setTurnoPopoverOpen(false)} />
                  </div>
                )}
              </Popover.Dropdown>
            </Popover>
            
            <ActionIcon 
              variant="subtle" 
              size="lg" 
              aria-label="Notificaciones"
              style={{ color: "var(--gd-text-secondary)" }}
            >
              <IconBell size={20} />
            </ActionIcon>

            {/* Modal Colaboradores */}
            <Modal
              opened={collabModalOpen}
              onClose={() => setCollabModalOpen(false)}
              title={
                <Group gap="sm">
                  <IconUserPlus size={20} color="#3b82f6" />
                  <Text fw={700}>Colaboradores del Turno</Text>
                </Group>
              }
              radius="lg"
              centered
              size="sm"
            >
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Invitá usuarios del negocio para que operen en tu turno activo.
                </Text>
                <Group gap="sm" align="flex-end">
                  <Select
                    style={{ flex: 1 }}
                    placeholder="Seleccioná un usuario"
                    value={selectedUserId}
                    onChange={setSelectedUserId}
                    data={tenantUsers
                      .filter((u) => {
                        if (u.id === user?.id) return false;
                        if (activeShift?.collaborators?.some((c) => c.user.id === u.id)) return false;
                        return true;
                      })
                      .map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                    searchable
                  />
                  <Button
                    color="blue"
                    onClick={handleAddCollaborator}
                    loading={addingCollab}
                    disabled={!selectedUserId}
                  >
                    Agregar
                  </Button>
                </Group>
                {activeShift?.collaborators && activeShift.collaborators.length > 0 && (
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>Colaboradores activos:</Text>
                    {activeShift.collaborators.map((c) => (
                      <Group key={c.user.id} justify="space-between" p="xs" style={{
                        border: "1px solid var(--gd-border)",
                        borderRadius: "var(--gd-radius-sm)",
                        background: "var(--gd-bg-secondary)",
                      }}>
                        <Group gap="sm">
                          <Text size="sm" fw={600}>{c.user.name}</Text>
                          <Badge size="xs" variant="light" color="gray">{c.user.role}</Badge>
                        </Group>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleRemoveCollaborator(c.user.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Modal>
            
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => router.push("/dashboard/configuracion")}
              aria-label="Configuración"
              style={{ color: "var(--gd-text-secondary)" }}
            >
              <IconSettings size={20} />
            </ActionIcon>
            
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              style={{ color: "var(--gd-text-secondary)" }}
            >
              <IconLogout size={20} />
            </ActionIcon>
          </div>
        </header>

        <main className="gd-content">{children}</main>
      </div>
    </div>
  );
}