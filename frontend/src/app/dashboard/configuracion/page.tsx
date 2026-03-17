"use client";

import { useEffect, useState } from "react";
import {
  Paper, Text, Stack, Group, ThemeIcon, Tabs, Badge, Switch,
  Button, Select, Table, Loader, Center, Alert, MultiSelect,
  Accordion, Divider, Modal, TextInput, PasswordInput,
} from "@mantine/core";
import {
  IconSettings, IconUsers, IconShieldLock,
  IconAlertTriangle, IconCircleCheck, IconBuilding, IconLock,
} from "@tabler/icons-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, showApiError } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import styles from "./configuracion.module.css";

const ROLE_OPTIONS = [
  { value: "OWNER",   label: "Dueño" },
  { value: "MANAGER", label: "Encargado" },
  { value: "CASHIER", label: "Cajero" },
  { value: "COOK",    label: "Cocinero" },
  { value: "STAFF",   label: "Personal" },
  { value: "TELEFONISTA", label: "Telefonista" },
  { value: "ENCARGADO_DELIVERY", label: "Encargado Delivery" },
];

const ROLE_COLORS: Record<string, string> = {
  OWNER: "orange", MANAGER: "blue", CASHIER: "green", COOK: "grape", STAFF: "gray",
  TELEFONISTA: "cyan", ENCARGADO_DELIVERY: "teal",
};

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().min(1),
});

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

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function ConfiguracionPage() {
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [hasPin, setHasPin] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "STAFF" },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [permsRes, usersRes, pinRes] = await Promise.all([
        api.get("/config/permissions"),
        api.get("/config/users"),
        api.get("/config/admin-pin"),
      ]);
      setPermissions(permsRes.data);
      setUsers(usersRes.data);
      setHasPin(pinRes.data.hasPin);
    } catch (err) {
      showApiError(err, "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePin = async () => {
    if (pinValue.length < 4 || pinValue.length > 6) {
      notifications.show({ title: "Error", message: "El PIN debe tener entre 4 y 6 dígitos", color: "red" });
      return;
    }
    if (pinValue !== pinConfirm) {
      notifications.show({ title: "Error", message: "Los PIN no coinciden", color: "red" });
      return;
    }
    setSavingPin(true);
    try {
      await api.post("/config/admin-pin", { pin: pinValue });
      setHasPin(true);
      setPinValue("");
      setPinConfirm("");
      notifications.show({ title: "PIN guardado", message: "El PIN de administrador fue configurado", color: "green" });
    } catch (err) {
      showApiError(err, "Error al guardar PIN");
    } finally {
      setSavingPin(false);
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
      await api.patch("/config/permissions", { moduleKey, submoduleKey, isEnabled });
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
      await api.patch("/config/permissions", { moduleKey, submoduleKey, allowedRoles });
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
      await api.patch(`/config/users/${userId}`, { role });
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
      await api.patch(`/config/users/${userId}`, { isActive });
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

  const handleCreateUser = async (data: CreateUserForm) => {
    setCreating(true);
    try {
      await api.post("/config/users", data);
      notifications.show({ title: "Usuario creado", message: `${data.name} puede iniciar sesión con su email`, color: "green" });
      setCreateModalOpen(false);
      createForm.reset();
      fetchData();
    } catch (err) {
      showApiError(err, "No se pudo crear el usuario");
    } finally {
      setCreating(false);
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
          <Tabs.Tab value="seguridad" leftSection={<IconLock size={16} />}>
            Seguridad
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
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">Usuarios del negocio</Text>
            <Button leftSection={<IconPlus size={16} />} color="orange" size="xs" onClick={() => setCreateModalOpen(true)}>
              Nuevo usuario
            </Button>
          </Group>
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

        <Modal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nuevo usuario" size="sm">
          <form onSubmit={createForm.handleSubmit(handleCreateUser)}>
            <Stack gap="md">
              <TextInput label="Nombre" placeholder="Juan Pérez" required {...createForm.register("name")} error={createForm.formState.errors.name?.message} />
              <TextInput label="Email" placeholder="juan@ejemplo.com" type="email" required {...createForm.register("email")} error={createForm.formState.errors.email?.message} />
              <PasswordInput label="Contraseña" placeholder="Mínimo 6 caracteres" required {...createForm.register("password")} error={createForm.formState.errors.password?.message} />
              <Select label="Rol" data={ROLE_OPTIONS} value={createForm.watch("role")} onChange={(v) => v && createForm.setValue("role", v)} error={createForm.formState.errors.role?.message} />
              <Group justify="flex-end" gap="xs">
                <Button variant="subtle" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
                <Button type="submit" color="orange" loading={creating}>Crear</Button>
              </Group>
            </Stack>
          </form>
        </Modal>

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

        {/* ── Seguridad Tab ── */}
        <Tabs.Panel value="seguridad" pt="lg">
          <Paper className="gd-card" p="md" maw={480}>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                  <IconLock size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="md">PIN de Administrador</Text>
                  <Text size="sm" c="dimmed">Se pide para cancelar pedidos cobrados</Text>
                </div>
              </Group>

              <Divider />

              {hasPin && (
                <Alert color="green" variant="light" radius="md">
                  <Text size="sm" fw={600}>PIN configurado. Podés cambiarlo ingresando uno nuevo.</Text>
                </Alert>
              )}

              {!hasPin && (
                <Alert color="red" variant="light" radius="md">
                  <Text size="sm" fw={600}>No hay PIN configurado. Configurá uno para proteger cancelaciones.</Text>
                </Alert>
              )}

              <PasswordInput
                label={hasPin ? "Nuevo PIN" : "PIN"}
                placeholder="4-6 dígitos"
                value={pinValue}
                onChange={(e) => setPinValue(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
              <PasswordInput
                label="Confirmar PIN"
                placeholder="Repetí el PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
              <Button
                color="orange"
                onClick={handleSavePin}
                loading={savingPin}
                disabled={pinValue.length < 4 || pinValue !== pinConfirm}
              >
                {hasPin ? "Cambiar PIN" : "Guardar PIN"}
              </Button>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
