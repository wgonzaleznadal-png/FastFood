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
