// Utilidad para traducir estados de pedidos a español

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Camino",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  PAID: "Pagado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "orange",
  IN_PROGRESS: "blue",
  READY: "cyan",
  DELIVERED: "green",
  CANCELLED: "red",
  PAID: "green",
};

export function getStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function getStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status] || "gray";
}
