import { createHash } from "node:crypto";

/**
 * UUID versión 5 (RFC 9562): determinista a partir de un espacio de nombres y un texto.
 * Permite que una reimportación reutilice el mismo id para la misma fila de origen.
 */
export function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error(`Espacio de nombres UUID inválido: ${namespace}`);
  const bytes = createHash("sha1")
    .update(ns)
    .update(name, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
