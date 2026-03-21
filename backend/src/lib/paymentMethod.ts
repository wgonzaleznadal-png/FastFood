/** Alinea variantes con lo que guardan los pedidos (EFECTIVO, MERCADO PAGO, …). */
export function canonicalPaymentMethod(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "EFECTIVO";
  const u = String(raw).trim().toUpperCase().replace(/_/g, " ");
  if (u === "MERCADOPAGO") return "MERCADO PAGO";
  return String(raw).trim();
}

/** Egreso / movimiento que sale del billetes en caja. */
export function isCashDrawerPaymentMethod(raw: string | null | undefined): boolean {
  return canonicalPaymentMethod(raw) === "EFECTIVO";
}

/**
 * Efectivo de ventas que debe figurar en el cajón físico del turno.
 * - Con rendición delivery (>0): retiro en caja + lo que entregó el cadete (no se usa total pedidos delivery para no duplicar).
 * - Sin rendición: todo el efectivo cobrado en pedidos (retiro + delivery) — mismo cajero, sin caja aparte.
 */
export function cashSalesForPhysicalDrawer(
  localCashSales: number,
  cashSalesDeliveryEfectivo: number,
  deliverySettlementAmount: number
): number {
  const settlement = Number(deliverySettlementAmount || 0);
  if (settlement > 0) {
    return localCashSales + settlement;
  }
  return localCashSales + cashSalesDeliveryEfectivo;
}
