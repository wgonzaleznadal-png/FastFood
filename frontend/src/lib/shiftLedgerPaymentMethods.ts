/** Valores que envía el backend (misma convención que pedidos). */
export const SHIFT_LEDGER_PAYMENT_OPTIONS = [
  { value: "EFECTIVO", label: "Efectivo (cajón)" },
  { value: "MERCADO PAGO", label: "Mercado Pago" },
  { value: "TARJETA", label: "Débito / crédito" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
] as const;

export type ShiftLedgerPaymentMethod = (typeof SHIFT_LEDGER_PAYMENT_OPTIONS)[number]["value"];

export function ledgerMethodShortLabel(method: string): string {
  const m = SHIFT_LEDGER_PAYMENT_OPTIONS.find((o) => o.value === method);
  return m?.label ?? method;
}
