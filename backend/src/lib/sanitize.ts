/**
 * Sanitiza nombres de usuario/clientes para evitar inyección de caracteres especiales y XSS.
 */
export function sanitizeName(name: string): string {
  return name
    .trim()
    .replace(/[<>\"'`]/g, "")
    .substring(0, 100);
}
