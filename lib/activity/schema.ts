import { BMR_FORMULAS, type ActivityLevel, type BmrFormula } from "@/lib/calc";

/** Límites de los CHECK de `profile` y de las tablas de actividad. */
export const MEASURED_BMR_RANGE = { min: 500, max: 6000 } as const;
export const THRESHOLD_RANGE = { min: 0, max: 20000 } as const;
export const STRIDE_RANGE_M = { min: 0.3, max: 1.5 } as const;
export const CUSTOM_FACTOR_RANGE = { min: 1, max: 2.5 } as const;
export const STEPS_RANGE = { min: 0, max: 100000 } as const;

export const BMR_FORMULA_LABELS: Record<BmrFormula, { label: string; hint: string }> = {
  mifflin: { label: "Mifflin-St Jeor", hint: "Recomendada para la mayoría" },
  harris_benedict: { label: "Harris-Benedict revisada", hint: "Tiende a sobreestimar" },
  katch_mcardle: { label: "Katch-McArdle", hint: "Requiere % de grasa" },
  cunningham: { label: "Cunningham", hint: "Requiere % de grasa" },
  measured: { label: "Valor medido", hint: "Calorimetría indirecta" },
};

/** Opciones del selector de actividad de un día. */
export const ACTIVITY_CHOICES = [
  { value: "bmr_only", label: "Solo TMB (1,0)" },
  { value: "sedentary", label: "Sedentario (1,2)" },
  { value: "light", label: "Ligero (1,375)" },
  { value: "moderate", label: "Moderado (1,55)" },
  { value: "active", label: "Activo (1,725)" },
  { value: "very_active", label: "Muy activo (1,9)" },
  { value: "custom", label: "Personalizado" },
  { value: "steps", label: "Por pasos" },
] as const;

export const WEEKDAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export type ActivityChoice =
  | { mode: "level"; level: ActivityLevel; customFactor: number | null }
  | { mode: "steps"; steps: number };

type Input = FormData | Record<string, unknown>;
const getter = (input: Input) => (name: string) =>
  input instanceof FormData ? input.get(name) : input[name];

/** Texto → número (acepta coma decimal); vacío → null; no numérico → NaN. */
export function toNumber(value: unknown): number | null {
  if (typeof value !== "string") return typeof value === "number" ? value : null;
  const text = value.trim();
  if (text === "") return null;
  return Number(text.replace(",", "."));
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const KINDS = ACTIVITY_CHOICES.map((c) => c.value) as readonly string[];

export type Parsed<T, K extends string> =
  { success: true; data: T } | { success: false; errors: Partial<Record<K, string>> };

/** Interpreta un tipo de actividad (`kind`) y su valor numérico (factor o pasos). */
export function parseActivityChoice(
  kind: unknown,
  rawValue: unknown,
): { ok: true; choice: ActivityChoice } | { ok: false; error: string } {
  if (typeof kind !== "string" || !KINDS.includes(kind))
    return { ok: false, error: "Elige una opción." };
  const value = toNumber(rawValue);
  if (kind === "steps") {
    if (
      value === null ||
      !Number.isInteger(value) ||
      value < STEPS_RANGE.min ||
      value > STEPS_RANGE.max
    )
      return {
        ok: false,
        error: "Ingresa los pasos (entero entre 0 y 100.000).",
      };
    return { ok: true, choice: { mode: "steps", steps: value } };
  }
  if (kind === "custom") {
    if (
      value === null ||
      !Number.isFinite(value) ||
      value < CUSTOM_FACTOR_RANGE.min ||
      value > CUSTOM_FACTOR_RANGE.max
    )
      return { ok: false, error: "Ingresa un factor entre 1 y 2,5." };
    return {
      ok: true,
      choice: {
        mode: "level",
        level: "custom",
        customFactor: Math.round(value * 1000) / 1000,
      },
    };
  }
  return {
    ok: true,
    choice: { mode: "level", level: kind as ActivityLevel, customFactor: null },
  };
}

export function parseBmrForm(
  input: Input,
): Parsed<
  { formula: BmrFormula; measuredKcal: number | null },
  "bmrFormula" | "measuredKcal"
> {
  const get = getter(input);
  const formula = get("bmrFormula");
  if (
    typeof formula !== "string" ||
    !(BMR_FORMULAS as readonly string[]).includes(formula)
  )
    return { success: false, errors: { bmrFormula: "Elige una fórmula." } };
  const measured = toNumber(get("measuredKcal"));
  if (
    measured !== null &&
    (!Number.isFinite(measured) ||
      measured < MEASURED_BMR_RANGE.min ||
      measured > MEASURED_BMR_RANGE.max)
  )
    return {
      success: false,
      errors: { measuredKcal: "Ingresa kcal/día entre 500 y 6.000." },
    };
  if (formula === "measured" && measured === null)
    return {
      success: false,
      errors: { measuredKcal: "Ingresa tu TMB medida en kcal/día." },
    };
  return {
    success: true,
    data: {
      formula: formula as BmrFormula,
      measuredKcal: measured === null ? null : Math.round(measured * 10) / 10,
    },
  };
}

export function parseStepsSettingsForm(
  input: Input,
): Parsed<
  { thresholdSteps: number; strideM: number | null },
  "thresholdSteps" | "strideM"
> {
  const get = getter(input);
  const errors: Partial<Record<"thresholdSteps" | "strideM", string>> = {};
  const threshold = toNumber(get("thresholdSteps"));
  if (
    threshold === null ||
    !Number.isInteger(threshold) ||
    threshold < THRESHOLD_RANGE.min ||
    threshold > THRESHOLD_RANGE.max
  )
    errors.thresholdSteps = "Ingresa un entero entre 0 y 20.000.";
  const stride = toNumber(get("strideM"));
  if (
    stride !== null &&
    (!Number.isFinite(stride) ||
      stride < STRIDE_RANGE_M.min ||
      stride > STRIDE_RANGE_M.max)
  )
    errors.strideM = "Ingresa un largo entre 0,3 y 1,5 m (vacío = automático).";
  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      thresholdSteps: threshold as number,
      strideM: stride === null ? null : Math.round(stride * 1000) / 1000,
    },
  };
}

export type ScheduleKey = `day${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

/** Semana tipo: campos `kind1..7` y `value1..7`. */
export function parseScheduleForm(
  input: Input,
): Parsed<{ weekday: number; choice: ActivityChoice }[], ScheduleKey> {
  const get = getter(input);
  const rows: { weekday: number; choice: ActivityChoice }[] = [];
  const errors: Partial<Record<ScheduleKey, string>> = {};
  for (let weekday = 1; weekday <= 7; weekday++) {
    const result = parseActivityChoice(get(`kind${weekday}`), get(`value${weekday}`));
    if (result.ok) rows.push({ weekday, choice: result.choice });
    else errors[`day${weekday}` as ScheduleKey] = result.error;
  }
  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data: rows };
}

export function parseDayAdjustmentForm(
  input: Input,
): Parsed<{ day: string; choice: ActivityChoice }, "day" | "value"> {
  const get = getter(input);
  const errors: Partial<Record<"day" | "value", string>> = {};
  const day = get("day");
  if (!isValidIsoDate(day)) errors.day = "Ingresa una fecha válida.";
  const result = parseActivityChoice(get("kind"), get("value"));
  if (!result.ok) errors.value = result.error;
  if (Object.keys(errors).length > 0 || !result.ok || !isValidIsoDate(day))
    return { success: false, errors };
  return { success: true, data: { day, choice: result.choice } };
}
