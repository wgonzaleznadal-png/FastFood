export function fmt(n: number | string) {
  return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Montos en inputs: miles con punto, decimales con coma (ej. 1.000,00) */
export const moneyNumberInputProps = {
  decimalScale: 2,
  prefix: "$",
  thousandsSeparator: ".",
  decimalSeparator: ",",
} as const;
