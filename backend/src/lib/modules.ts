// ─── Module Registry ──────────────────────────────────────────────────────────
// Single source of truth for all modules and submodules in GastroDash.
// The admin can enable/disable any of these per tenant via ModulePermission.

export interface ModuleDef {
  key: string;
  label: string;
  submodules?: SubmoduleDef[];
}

export interface SubmoduleDef {
  key: string;
  label: string;
}

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Torre de Control",
  },
  {
    key: "caja",
    label: "Gestión de Caja",
    submodules: [
      { key: "caja.turnos", label: "Turnos" },
      { key: "caja.pedidos_kg", label: "Pedidos x KG" },
      { key: "caja.whatsapp", label: "WhatsApp CRM" },
    ],
  },
  {
    key: "whatsapp",
    label: "WhatsApp CRM",
  },
  {
    key: "menu",
    label: "Menú",
    submodules: [
      { key: "menu.pedidos_kg", label: "Pedidos x KG" },
      { key: "menu.carta", label: "Carta (Comidas y Bebidas)" },
    ],
  },
  {
    key: "cocina",
    label: "Cocina",
    submodules: [
      { key: "cocina.comandas", label: "Comandas" },
      { key: "cocina.barra", label: "Barra" },
    ],
  },
  {
    key: "finanzas",
    label: "Finanzas",
    submodules: [
      { key: "finanzas.consolidador", label: "Consolidador de Turnos" },
      { key: "finanzas.gastos", label: "Gastos Estructurales" },
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    submodules: [
      { key: "configuracion.permisos", label: "Permisos de Módulos" },
      { key: "configuracion.usuarios", label: "Gestión de Usuarios" },
      { key: "configuracion.negocio", label: "Datos del Negocio" },
    ],
  },
];

export const ALL_MODULE_KEYS = MODULES.flatMap((m) => [
  m.key,
  ...(m.submodules?.map((s) => s.key) ?? []),
]);

// Default roles allowed per module (used when seeding a new tenant)
export const DEFAULT_ROLE_ACCESS: Record<string, string[]> = {
  dashboard:                    ["OWNER", "MANAGER", "CASHIER", "COOK", "STAFF"],
  caja:                         ["OWNER", "MANAGER", "CASHIER"],
  "caja.turnos":                ["OWNER", "MANAGER", "CASHIER"],
  "caja.pedidos_kg":            ["OWNER", "MANAGER", "CASHIER"],
  "caja.whatsapp":              ["OWNER", "MANAGER", "CASHIER"],
  whatsapp:                     ["OWNER", "MANAGER", "CASHIER"],
  menu:                         ["OWNER", "MANAGER", "CASHIER"],
  "menu.pedidos_kg":            ["OWNER", "MANAGER", "CASHIER"],
  "menu.carta":                 ["OWNER", "MANAGER"],
  cocina:                       ["OWNER", "MANAGER", "COOK"],
  "cocina.comandas":            ["OWNER", "MANAGER", "COOK"],
  "cocina.barra":               ["OWNER", "MANAGER", "COOK"],
  finanzas:                     ["OWNER", "MANAGER"],
  "finanzas.consolidador":      ["OWNER", "MANAGER"],
  "finanzas.gastos":            ["OWNER"],
  configuracion:                ["OWNER"],
  "configuracion.permisos":     ["OWNER"],
  "configuracion.usuarios":     ["OWNER", "MANAGER"],
  "configuracion.negocio":      ["OWNER"],
};
