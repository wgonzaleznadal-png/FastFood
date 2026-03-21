export function fmt(n: number | string) {
  return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Valor numérico desde Mantine NumberInput con moneyNumberInputProps (miles `.`, decimales `,`).
 * parseFloat/Number rompen montos como "15.000,50" → 15.
 */
export function parseMoneyInput(val: string | number | undefined | null): number {
  if (val === "" || val === undefined || val === null) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const s = String(val)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!s) return 0;
  if (s.includes(",")) {
    const commaIdx = s.lastIndexOf(",");
    const intPart = s.slice(0, commaIdx).replace(/\./g, "");
    const decPart = s.slice(commaIdx + 1).replace(/\./g, "");
    const n = parseFloat(decPart.length ? `${intPart}.${decPart}` : intPart);
    return Number.isFinite(n) ? n : 0;
  }
  if (/^\d+\.\d{1,2}$/.test(s)) return parseFloat(s) || 0;
  const collapsed = s.replace(/\./g, "");
  const n = parseFloat(collapsed);
  return Number.isFinite(n) ? n : 0;
}

/** Montos en inputs: miles con punto, decimales con coma (ej. 1.000,00) */
export const moneyNumberInputProps = {
  decimalScale: 2,
  prefix: "$",
  thousandsSeparator: ".",
  decimalSeparator: ",",
} as const;
