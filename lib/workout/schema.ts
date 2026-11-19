import { toNumber } from "@/lib/activity/schema";

/** Límites de los CHECK de `workout_session`. */
export const DURATION_RANGE_MIN = { min: 0.1, max: 1440 } as const;
export const HR_RANGE = { min: 30, max: 250 } as const;
export const MACHINE_KCAL_MAX = 10000;
export const DISTANCE_MAX_KM = 1000;
export const NOTES_MAX = 1000;

export type WorkoutField =
  | "activityTypeId"
  | "date"
  | "durationMin"
  | "hrAvg"
  | "hrMin"
  | "hrMax"
  | "machineKcal"
  | "distanceKm"
  | "rpe"
  | "notes";

export type WorkoutFieldErrors = Partial<Record<WorkoutField, string>>;

export interface WorkoutFormValues {
  activityTypeId: number;
  date: string;
  durationMin: number;
  hrAvg: number | null;
  hrMin: number | null;
  hrMax: number | null;
  machineKcal: number | null;
  distanceKm: number | null;
  rpe: number | null;
  notes: string | null;
}

export type WorkoutParseResult =
  | { success: true; data: WorkoutFormValues }
  | { success: false; errors: WorkoutFieldErrors };

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const round = (value: number, decimals: number) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Valida el formulario de sesión de ejercicio (RF-10). `today` (AAAA-MM-DD) es el
 * día actual del usuario: la fecha no puede ser posterior. Los campos opcionales
 * vacíos quedan en null.
 */
export function parseWorkoutForm(
  input: FormData | Record<string, unknown>,
  today: string,
): WorkoutParseResult {
  const get = (name: string) =>
    input instanceof FormData ? input.get(name) : input[name];
  const errors: WorkoutFieldErrors = {};

  const activity = toNumber(get("activityTypeId"));
  if (activity === null || !Number.isInteger(activity) || activity <= 0)
    errors.activityTypeId = "Elige una actividad.";

  const date = get("date");
  if (!isValidIsoDate(date)) errors.date = "Ingresa una fecha válida.";
  else if (date > today) errors.date = "La fecha no puede ser futura.";

  const duration = toNumber(get("durationMin"));
  if (
    duration === null ||
    !Number.isFinite(duration) ||
    round(duration, 1) < DURATION_RANGE_MIN.min ||
    duration > DURATION_RANGE_MIN.max
  )
    errors.durationMin = "Ingresa la duración en minutos (entre 0,1 y 1.440).";

  const heartRate = (field: "hrAvg" | "hrMin" | "hrMax") => {
    const value = toNumber(get(field));
    if (value === null) return null;
    if (!Number.isFinite(value) || value < HR_RANGE.min || value > HR_RANGE.max) {
      errors[field] = "Ingresa un pulso entre 30 y 250 lpm.";
      return null;
    }
    return Math.round(value);
  };
  const hrAvg = heartRate("hrAvg");
  const hrMin = heartRate("hrMin");
  const hrMax = heartRate("hrMax");
  if (hrMin !== null && hrAvg !== null && hrMin > hrAvg)
    errors.hrMin = "El mínimo no puede superar al promedio.";
  if (hrMax !== null && hrAvg !== null && hrMax < hrAvg)
    errors.hrMax = "El máximo no puede ser menor que el promedio.";
  if (hrMin !== null && hrMax !== null && hrMin > hrMax)
    errors.hrMax ??= "El máximo no puede ser menor que el mínimo.";

  const machine = toNumber(get("machineKcal"));
  if (
    machine !== null &&
    (!Number.isFinite(machine) || machine < 0 || machine > MACHINE_KCAL_MAX)
  )
    errors.machineKcal = "Ingresa las kcal de la máquina (entre 0 y 10.000).";

  const distance = toNumber(get("distanceKm"));
  if (
    distance !== null &&
    (!Number.isFinite(distance) || distance < 0 || distance > DISTANCE_MAX_KM)
  )
    errors.distanceKm = "Ingresa la distancia en km (entre 0 y 1.000).";

  const rpe = toNumber(get("rpe"));
  if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10))
    errors.rpe = "Elige un esfuerzo entre 1 y 10.";

  const rawNotes = get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  if (notes.length > NOTES_MAX)
    errors.notes = `Las notas pueden tener hasta ${NOTES_MAX} caracteres.`;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      activityTypeId: activity as number,
      date: date as string,
      durationMin: round(duration as number, 1),
      hrAvg,
      hrMin,
      hrMax,
      machineKcal: machine === null ? null : round(machine, 1),
      distanceKm: distance === null ? null : round(distance, 2),
      rpe,
      notes: notes === "" ? null : notes,
    },
  };
}
