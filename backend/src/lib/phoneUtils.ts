/**
 * Normaliza teléfonos argentinos a formato canónico: 5493794687624
 * Acepta: 3794687624, +5493794687624, 54 9 379 4687624, 03794687624, etc.
 * El formato canónico es: 549 + código de área + número (sin 15)
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 8) return digits;

  // Ya tiene formato completo: 5493794687624 (13 dígitos)
  if (digits.length === 13 && digits.startsWith("549")) return digits;

  // Con + al inicio: 5493794687624
  if (digits.length === 12 && digits.startsWith("54")) return "54" + digits.slice(2);
  if (digits.length === 13 && digits.startsWith("549")) return digits;

  // Empieza con 0 (formato con 0 adelante): 03794687624 → 5493794687624
  if (digits.startsWith("0") && digits.length === 11) {
    return "549" + digits.slice(1);
  }

  // 10 dígitos: código de área + número (3794687624)
  if (digits.length === 10) return "549" + digits;

  // 11 dígitos con 15 (viejo formato): 379 15 083069 → 549 379 083069
  if (digits.length === 11 && digits.slice(3, 5) === "15") {
    return "549" + digits.slice(0, 3) + digits.slice(5);
  }

  return digits;
}

/**
 * Compara dos teléfonos normalizándolos primero
 */
export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

/**
 * Formato para mostrar: 379 4687624
 */
export function formatPhoneDisplay(phone: string): string {
  const norm = normalizePhone(phone);
  if (norm.length === 13 && norm.startsWith("549")) {
    const local = norm.slice(3);
    return local.slice(0, 3) + " " + local.slice(3);
  }
  return phone;
}
