"use client";

import { useEffect, useState } from "react";
import {
  Paper, Text, Stack, Group, ThemeIcon, Tabs, Badge, Switch,
  Button, Select, Table, Loader, Center, Alert, MultiSelect,
  Accordion, Divider,
} from "@mantine/core";
import {
  IconSettings, IconUsers, IconShieldLock,
  IconAlertTriangle, IconCircleCheck, IconBuilding,
} from "@tabler/icons-react";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import styles from "./configuracion.module.css";

const ROLE_OPTIONS = [
  { value: "OWNER",   label: "Dueño" },
  { value: "MANAGER", label: "Encargado" },
  { value: "CASHIER", label: "Cajero" },
  { value: "COOK",    label: "Cocinero" },
  { value: "STAFF",   label: "Personal" },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER: "orange", MANAGER: "blue", CASHIER: "green", COOK: "grape", STAFF: "gray",
};

interface PermissionEntry {
  key: string;
  label: string;
  permission: {
    id: string;
    allowedRoles: string[];
    isEnabled: boolean;
    userOverrides: Array<{
      id: string;
      hasAccess: boolean;
      user: { id: string; name: string; email: string; role: string };
    }>;
  } | null;
  submodules: Array<{
    key: string;
    label: string;
    permission: {
      id: string;
      allowedRoles: string[];
      isEnabled: boolean;
      userOverrides: Array<{
        id: string;
        hasAccess: boolean;
        user: { id: string; name: string; email: string; role: string };
      }>;
    } | null;
  }>;
}

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function ConfiguracionPage() {
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [permsRes, usersRes] = await Promise.all([
        api.get("/api/config/permissions"),
        api.get("/api/config/users"),
      ]);
      setPermissions(permsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      showApiError(err, "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggleModule = async (
    moduleKey: string,
    submoduleKey: string | null,
    isEnabled: boolean
  ) => {
    const key = submoduleKey ?? moduleKey;
    setSaving(key);
    try {
      await api.patch("/api/config/permissions", { moduleKey, submoduleKey, isEnabled });
      notifications.show({
        title: isEnabled ? "Módulo activado" : "Módulo desactivado",
        message: "",
        color: isEnabled ? "green" : "gray",
      });
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo actualizar");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateRoles = async (
    moduleKey: string,
    submoduleKey: string | null,
    allowedRoles: string[]
  ) => {
    const key = submoduleKey ?? moduleKey;
    setSaving(key);
    try {
      await api.patch("/api/config/permissions", { moduleKey, submoduleKey, allowedRoles });
      notifications.show({ title: "Roles actualizados", message: "", color: "green" });
      fetchData();
    } catch {
      notifications.show({ title: "Error", message: "No se pudo actualizar", color: "red" });
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: string) => {
    setSaving(userId);
    try {
      await api.patch(`/api/config/users/${userId}`, { role });
      notifications.show({ title: "Rol actualizado", message: "", color: "green" });
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo actualizar el rol");
    } finally {
      setSaving(null);
    }
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    setSaving(userId);
    try {
      await api.patch(`/api/config/users/${userId}`, { isActive });
      notifications.show({
        title: isActive ? "Usuario activado" : "Usuario desactivado",
        message: "",
        color: isActive ? "green" : "gray",
      });
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo actualizar");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <Center h={300}><Loader color="orange" /></Center>;
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className="gd-page-title">Configuración</h1>
          <p className="gd-page-subtitle">
            Control total del sistema — solo visible para el Dueño
          </p>
        </div>
        <Badge color="orange" size="lg" radius="md" leftSection={<IconShieldLock size={14} />}>
          OWNER
        </Badge>
      </div>

      <Alert
        icon={<IconCircleCheck size={16} />}
        color="orange"
        radius="md"
        mt="lg"
        mb="lg"
        variant="light"
      >
        <Text size="sm">
          <strong>Sistema autoadministrable.</strong> Desde acá podés controlar exactamente qué módulos
          y submódulos puede ver cada rol, e incluso hacer overrides por usuario individual.
        </Text>
      </Alert>

      <Tabs defaultValue="permisos">
        <Tabs.List>
          <Tabs.Tab value="permisos" leftSection={<IconShieldLock size={16} />}>
            Permisos de Módulos
          </Tabs.Tab>
          <Tabs.Tab value="usuarios" leftSection={<IconUsers size={16} />}>
            Gestión de Usuarios
          </Tabs.Tab>
          <Tabs.Tab value="negocio" leftSection={<IconBuilding size={16} />}>
            Datos del Negocio
          </Tabs.Tab>
        </Tabs.List>

        {/* ── Permisos Tab ── */}
        <Tabs.Panel value="permisos" pt="lg">
          <Stack gap="md">
            {permissions.map((mod) => (
              <Paper key={mod.key} className="gd-card" p="md">
                <Group justify="space-between" mb="sm">
                  <Group gap="sm">
                    <ThemeIcon color="orange" variant="light" size="md" radius="md">
                      <IconSettings size={16} />
                    </ThemeIcon>
                    <Text fw={700} size="md">{mod.label}</Text>
                    {!mod.permission?.isEnabled && (
                      <Badge color="gray" size="xs">Desactivado</Badge>
                    )}
                  </Group>
                  <Switch
                    checked={mod.permission?.isEnabled ?? false}
                    disabled={saving === mod.key}
                    onChange={(e) => handleToggleModule(mod.key, null, e.currentTarget.checked)}
                    color="orange"
                    size="sm"
                  />
                </Group>

                {mod.permission?.isEnabled && (
                  <>
                    <MultiSelect
                      label="Roles con acceso"
                      data={ROLE_OPTIONS}
                      value={mod.permission?.allowedRoles ?? []}
                      onChange={(vals) => handleUpdateRoles(mod.key, null, vals)}
                      size="xs"
                      radius="md"
                      disabled={saving === mod.key}
                    />

                    {mod.submodules.length > 0 && (
                      <>
                        <Divider my="sm" label="Submódulos" labelPosition="left" />
                        <Stack gap="xs">
                          {mod.submodules.map((sub) => (
                            <Paper key={sub.key} p="sm" radius="md" style={{ background: "var(--gd-bg)", border: "1px solid var(--gd-border)" }}>
                              <Group justify="space-between" mb="xs">
                                <Text size="sm" fw={600}>{sub.label}</Text>
                                <Switch
                                  checked={sub.permission?.isEnabled ?? false}
                                  disabled={saving === sub.key}
                                  onChange={(e) => handleToggleModule(mod.key, sub.key, e.currentTarget.checked)}
                                  color="orange"
                                  size="xs"
                                />
                              </Group>
                              {sub.permission?.isEnabled && (
                                <MultiSelect
                                  data={ROLE_OPTIONS}
                                  value={sub.permission?.allowedRoles ?? []}
                                  onChange={(vals) => handleUpdateRoles(mod.key, sub.key, vals)}
                                  size="xs"
                                  radius="md"
                                  disabled={saving === sub.key}
                                  placeholder="Seleccioná roles..."
                                />
                              )}
                            </Paper>
                          ))}
                        </Stack>
                      </>
                    )}
                  </>
                )}
              </Paper>
            ))}
          </Stack>
        </Tabs.Panel>

        {/* ── Usuarios Tab ── */}
        <Tabs.Panel value="usuarios" pt="lg">
          {!users.length ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="gray" radius="md">
              No hay usuarios registrados.
            </Alert>
          ) : (
            <Paper className="gd-card" p={0} style={{ overflow: "hidden" }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nombre</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Rol</Table.Th>
                    <Table.Th>Estado</Table.Th>
                    <Table.Th>Acciones</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {users.map((u) => (
                    <Table.Tr key={u.id}>
                      <Table.Td fw={600}>{u.name}</Table.Td>
                      <Table.Td c="dimmed"><Text size="sm">{u.email}</Text></Table.Td>
                      <Table.Td>
                        <Select
                          data={ROLE_OPTIONS}
                          value={u.role}
                          size="xs"
                          radius="md"
                          disabled={saving === u.id}
                          onChange={(val) => val && handleUpdateUserRole(u.id, val)}
                          styles={{ input: { color: `var(--mantine-color-${ROLE_COLORS[u.role]}-6)`, fontWeight: 600 } }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Badge color={u.isActive ? "green" : "gray"} size="sm">
                          {u.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          color={u.isActive ? "red" : "green"}
                          loading={saving === u.id}
                          onClick={() => handleToggleUserActive(u.id, !u.isActive)}
                        >
                          {u.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        {/* ── Negocio Tab ── */}
        <Tabs.Panel value="negocio" pt="lg">
          <Paper className="gd-card" maw={480}>
            <Stack gap="sm">
              <Group gap="sm">
                <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                  <IconBuilding size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="md">Datos del negocio</Text>
                  <Text size="sm" c="dimmed">Configuración general del local</Text>
                </div>
              </Group>
              <Divider />
              <Alert icon={<IconAlertTriangle size={16} />} color="gray" radius="md" variant="light">
                <Text size="sm">
                  La edición de datos del negocio (nombre, logo, dirección, zona horaria, moneda)
                  estará disponible en el próximo sprint de Configuración.
                </Text>
              </Alert>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
