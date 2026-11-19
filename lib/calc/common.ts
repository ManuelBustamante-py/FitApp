/** Sexo usado por las fórmulas (mismo CHECK que `profile.sex`). */
export type Sex = "male" | "female";

/** kcal equivalentes a 1 kg de grasa (aproximación clásica, docs/03 §7). */
export const KCAL_PER_KG = 7700;

/** Minutos en un día, para prorratear la TMB. */
export const MINUTES_PER_DAY = 1440;

/** Lanza `RangeError` si el valor no es un número finito mayor que 0. */
export function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} debe ser un número mayor que 0 (recibido: ${value})`);
  }
}

/** Lanza `RangeError` si el valor no es un número finito mayor o igual a 0. */
export function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      `${name} debe ser un número mayor o igual a 0 (recibido: ${value})`,
    );
  }
}
