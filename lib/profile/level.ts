/** Nivel dominante de la semana tipo (el más repetido entre los días en modo nivel). */
export function dominantLevel(
  rows: readonly { mode: string; level: string | null }[],
): string | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.mode === "level" && row.level) {
      counts.set(row.level, (counts.get(row.level) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) {
      best = level;
      bestCount = count;
    }
  }
  return best;
}

/**
 * La semana tipo se reescribe con el mismo nivel los 7 días salvo que ya exista
 * completa y el nivel elegido sea el dominante (así no se pisa lo configurado por día).
 */
export function shouldWriteSchedule(
  rows: readonly { mode: string; level: string | null }[],
  chosenLevel: string,
): boolean {
  return !(rows.length === 7 && dominantLevel(rows) === chosenLevel);
}
