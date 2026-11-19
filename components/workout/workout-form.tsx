"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState, type FormEvent } from "react";

import { saveWorkout, type WorkoutFormState } from "@/app/ejercicio/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  estimateExercise,
  KEYTEL_HR_MAX,
  KEYTEL_HR_MIN,
  type ExerciseEstimate,
} from "@/lib/calc";
import {
  ACTIVITY_CATEGORY_LABELS,
  isHrOutOfRange,
  KCAL_METHOD_LABELS,
  type ExerciseContext,
} from "@/lib/workout/context";
import {
  parseWorkoutForm,
  type WorkoutField,
  type WorkoutFieldErrors,
} from "@/lib/workout/schema";

const INITIAL: WorkoutFormState = { status: "idle" };

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });

export interface ActivityOption {
  id: number;
  name_es: string;
  met: number;
  category: string;
}

export function HrWarning() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      Pulso fuera de {KEYTEL_HR_MIN}–{KEYTEL_HR_MAX} lpm: la estimación por pulso es de
      baja confianza.
    </p>
  );
}

function Estimates({ estimate }: { estimate: ExerciseEstimate }) {
  const figures = [
    { method: "hr", kcal: estimate.hr?.kcal ?? null, missing: "Sin pulso" },
    { method: "met", kcal: estimate.met, missing: "" },
    { method: "machine", kcal: estimate.machine, missing: "Sin dato" },
  ] as const;
  return (
    <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-3" aria-live="polite">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {figures.map(({ method, kcal, missing }) => {
          const chosen = estimate.selected.method === method;
          return (
            <div
              key={method}
              className={`rounded-md border px-1 py-1.5 ${chosen ? "border-primary bg-background" : "border-transparent"}`}
            >
              <dt className="text-muted-foreground text-xs">
                {KCAL_METHOD_LABELS[method]}
                {chosen ? " · elegida" : ""}
              </dt>
              <dd className="text-base font-semibold tabular-nums">
                {kcal === null ? (
                  <span className="text-muted-foreground text-xs font-normal">
                    {missing}
                  </span>
                ) : (
                  `${nf0.format(kcal)} kcal`
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-sm">
        Gasto ≈ <strong>{nf0.format(estimate.selected.kcal)} kcal</strong> (
        {KCAL_METHOD_LABELS[estimate.selected.method].toLowerCase()}). Aporte al déficit:{" "}
        <strong>≈ {nf0.format(estimate.netKcal)} kcal netas</strong>.
      </p>
    </div>
  );
}

export function WorkoutForm({
  today,
  activities,
  context,
  defaultActivityId,
}: {
  today: string;
  activities: ActivityOption[];
  context: ExerciseContext;
  defaultActivityId: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveWorkout, INITIAL);
  const [clientErrors, setClientErrors] = useState<WorkoutFieldErrors | null>(null);
  const [estimate, setEstimate] = useState<ExerciseEstimate | null>(null);
  const [hrAvg, setHrAvg] = useState<number | null>(null);

  const errors: WorkoutFieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});

  const categories = Array.from(new Set(activities.map((a) => a.category)));

  function preview(form: HTMLFormElement) {
    const data = new FormData(form);
    const parsed = parseWorkoutForm(data, today);
    const hr = Number(String(data.get("hrAvg") ?? "").replace(",", "."));
    setHrAvg(data.get("hrAvg") && Number.isFinite(hr) ? hr : null);
    if (!parsed.success) {
      setEstimate(null);
      return;
    }
    const activity = activities.find((a) => a.id === parsed.data.activityTypeId);
    setEstimate(
      activity
        ? estimateExercise({
            ...context,
            met: activity.met,
            durationMin: parsed.data.durationMin,
            hrAvg: parsed.data.hrAvg,
            machineKcal: parsed.data.machineKcal,
          })
        : null,
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseWorkoutForm(new FormData(event.currentTarget), today);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else {
      // El formulario se limpia al guardar; la vista previa también.
      setClientErrors(null);
      setEstimate(null);
      setHrAvg(null);
    }
  }

  const aria = (name: WorkoutField) =>
    ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    }) as const;

  const summary = state.status === "saved" && !clientErrors ? state.summary : null;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onChange={(event) => {
        setClientErrors(null);
        preview(event.currentTarget);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field id="activityTypeId" label="Actividad" error={errors.activityTypeId}>
        <Select
          id="activityTypeId"
          name="activityTypeId"
          defaultValue={defaultActivityId ?? ""}
          {...aria("activityTypeId")}
        >
          <option value="" disabled>
            Elige una actividad
          </option>
          {categories.map((category) => (
            <optgroup
              key={category}
              label={ACTIVITY_CATEGORY_LABELS[category] ?? category}
            >
              {activities
                .filter((a) => a.category === category)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_es} · MET {String(a.met).replace(".", ",")}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="durationMin" label="Duración (min)" error={errors.durationMin}>
          <Input
            id="durationMin"
            name="durationMin"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="30"
            {...aria("durationMin")}
          />
        </Field>
        <Field id="date" label="Fecha" error={errors.date}>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            {...aria("date")}
          />
        </Field>
        <Field
          id="hrAvg"
          label="Pulso promedio"
          hint="lpm, opcional"
          error={errors.hrAvg}
        >
          <Input
            id="hrAvg"
            name="hrAvg"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="137"
            {...aria("hrAvg")}
          />
        </Field>
        <Field
          id="machineKcal"
          label="Kcal de la máquina"
          hint="Opcional"
          error={errors.machineKcal}
        >
          <Input
            id="machineKcal"
            name="machineKcal"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="77"
            {...aria("machineKcal")}
          />
        </Field>
      </div>
      {!errors.hrAvg && isHrOutOfRange(hrAvg) ? <HrWarning /> : null}

      <details className="rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Más datos (opcional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field id="hrMin" label="Pulso mínimo" error={errors.hrMin}>
            <Input
              id="hrMin"
              name="hrMin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              {...aria("hrMin")}
            />
          </Field>
          <Field id="hrMax" label="Pulso máximo" error={errors.hrMax}>
            <Input
              id="hrMax"
              name="hrMax"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              {...aria("hrMax")}
            />
          </Field>
          <Field id="distanceKm" label="Distancia (km)" error={errors.distanceKm}>
            <Input
              id="distanceKm"
              name="distanceKm"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              {...aria("distanceKm")}
            />
          </Field>
          <Field id="rpe" label="Esfuerzo (1–10)" error={errors.rpe}>
            <Select id="rpe" name="rpe" defaultValue="" {...aria("rpe")}>
              <option value="">—</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2">
            <Field id="notes" label="Notas" error={errors.notes}>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={1000}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-3 md:text-sm"
                {...aria("notes")}
              />
            </Field>
          </div>
        </div>
      </details>

      {estimate ? <Estimates estimate={estimate} /> : null}

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
      {summary ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Sesión guardada. Gastaste ≈ {nf0.format(summary.selectedKcal)} kcal (
          {KCAL_METHOD_LABELS[summary.method].toLowerCase()}
          {summary.machineKcal !== null
            ? `; máquina: ${nf0.format(summary.machineKcal)}`
            : ""}
          ). Aporte al déficit: ≈ {nf0.format(summary.netKcal)} kcal.
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Guardando…" : "Registrar sesión"}
      </Button>
    </form>
  );
}
