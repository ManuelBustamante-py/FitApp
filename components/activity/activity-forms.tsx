"use client";

import { useActionState, useState, type ReactNode } from "react";

import {
  saveBmrFormula,
  saveDayAdjustment,
  saveSchedule,
  saveStepsSettings,
  type ActivityFormState,
} from "@/app/actividad/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select } from "@/components/ui/field";
import {
  ACTIVITY_CHOICES,
  BMR_FORMULA_LABELS,
  WEEKDAY_NAMES,
} from "@/lib/activity/schema";
import { BMR_FORMULAS, type BmrFormula } from "@/lib/calc";

const INITIAL: ActivityFormState = { status: "idle" };

function Status({ state }: { state: ActivityFormState }) {
  if (state.status === "error" && state.message)
    return (
      <p role="alert" className="text-destructive text-sm">
        {state.message}
      </p>
    );
  if (state.status === "saved")
    return (
      <p role="status" className="text-sm text-green-700 dark:text-green-400">
        Guardado.
      </p>
    );
  return null;
}

function errorOf(state: ActivityFormState, key: string): string | undefined {
  return state.status === "error" ? state.errors?.[key] : undefined;
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

export interface BmrOption {
  formula: BmrFormula;
  /** kcal/día; null si faltan datos para calcularla. */
  kcal: number | null;
  missing: string | null;
}

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });

/** Fórmula de TMB con la comparación de todas. */
export function BmrForm({
  options,
  formula,
  measuredKcal,
}: {
  options: BmrOption[];
  formula: BmrFormula;
  measuredKcal: number | null;
}) {
  const [state, action, pending] = useActionState(saveBmrFormula, INITIAL);
  const [selected, setSelected] = useState<BmrFormula>(formula);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Fórmula de TMB</legend>
        {BMR_FORMULAS.map((f) => {
          const option = options.find((o) => o.formula === f);
          return (
            <label
              key={f}
              className="has-[:checked]:border-primary flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2"
            >
              <input
                type="radio"
                name="bmrFormula"
                value={f}
                checked={selected === f}
                onChange={() => setSelected(f)}
                className="size-4"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {BMR_FORMULA_LABELS[f].label}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {option?.missing ?? BMR_FORMULA_LABELS[f].hint}
                </span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {option?.kcal != null ? `${nf0.format(option.kcal)} kcal` : "—"}
              </span>
            </label>
          );
        })}
        {errorOf(state, "bmrFormula") ? (
          <p role="alert" className="text-destructive text-xs">
            {errorOf(state, "bmrFormula")}
          </p>
        ) : null}
      </fieldset>
      <Field
        id="measuredKcal"
        label="TMB medida (kcal/día)"
        hint="Solo para la opción «Valor medido»."
        error={errorOf(state, "measuredKcal")}
      >
        <Input
          id="measuredKcal"
          name="measuredKcal"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={measuredKcal ?? ""}
          placeholder="1850"
          aria-invalid={errorOf(state, "measuredKcal") ? true : undefined}
        />
      </Field>
      <Status state={state} />
      <SubmitButton pending={pending}>Guardar fórmula</SubmitButton>
    </form>
  );
}

/** Selector de actividad + campo numérico (factor o pasos) que aparece según la opción. */
function ActivityInputs({
  idPrefix,
  kindName,
  valueName,
  defaultKind,
  defaultValue,
  error,
}: {
  idPrefix: string;
  kindName: string;
  valueName: string;
  defaultKind: string;
  defaultValue: string;
  error?: string;
}) {
  const [kind, setKind] = useState(defaultKind);
  const needsValue = kind === "custom" || kind === "steps";
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,7rem)] gap-2">
        <Select
          id={`${idPrefix}-kind`}
          name={kindName}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Actividad"
          className={needsValue ? "" : "col-span-2"}
        >
          {ACTIVITY_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {needsValue ? (
          <Input
            id={`${idPrefix}-value`}
            name={valueName}
            type="text"
            inputMode={kind === "steps" ? "numeric" : "decimal"}
            autoComplete="off"
            defaultValue={defaultValue}
            placeholder={kind === "steps" ? "5000" : "1,3"}
            aria-label={kind === "steps" ? "Pasos" : "Factor"}
            aria-invalid={error ? true : undefined}
          />
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface ScheduleDay {
  weekday: number;
  kind: string;
  value: string;
  /** TDEE estimado (sin ejercicio) o null si falta el peso. */
  tdee: number | null;
}

/** Semana tipo: una actividad por día. */
export function ScheduleForm({ days }: { days: ScheduleDay[] }) {
  const [state, action, pending] = useActionState(saveSchedule, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {days.map((d) => (
          <li key={d.weekday} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`d${d.weekday}-kind`}>{WEEKDAY_NAMES[d.weekday - 1]}</Label>
              {d.tdee != null ? (
                <span className="text-muted-foreground text-xs tabular-nums">
                  ≈ {nf0.format(d.tdee)} kcal
                </span>
              ) : null}
            </div>
            <ActivityInputs
              idPrefix={`d${d.weekday}`}
              kindName={`kind${d.weekday}`}
              valueName={`value${d.weekday}`}
              defaultKind={d.kind}
              defaultValue={d.value}
              error={errorOf(state, `day${d.weekday}`)}
            />
          </li>
        ))}
      </ul>
      <Status state={state} />
      <SubmitButton pending={pending}>Guardar semana tipo</SubmitButton>
    </form>
  );
}

/** Ajuste de una fecha puntual. */
export function DayAdjustmentForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(saveDayAdjustment, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field id="adj-day" label="Fecha" error={errorOf(state, "day")}>
        <Input
          id="adj-day"
          name="day"
          type="date"
          defaultValue={today}
          aria-invalid={errorOf(state, "day") ? true : undefined}
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="adj-kind-kind">Actividad ese día</Label>
        <ActivityInputs
          idPrefix="adj-kind"
          kindName="kind"
          valueName="value"
          defaultKind="steps"
          defaultValue=""
          error={errorOf(state, "value")}
        />
      </div>
      <Status state={state} />
      <SubmitButton pending={pending}>Guardar ajuste</SubmitButton>
    </form>
  );
}

/** Umbral de pasos sedentarios y largo de paso. */
export function StepsSettingsForm({
  thresholdSteps,
  strideM,
  autoStrideM,
}: {
  thresholdSteps: number;
  strideM: number | null;
  autoStrideM: number;
}) {
  const [state, action, pending] = useActionState(saveStepsSettings, INITIAL);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field
        id="thresholdSteps"
        label="Umbral de pasos sedentarios"
        hint="Los pasos hasta este número ya están en el factor 1,2."
        error={errorOf(state, "thresholdSteps")}
      >
        <Input
          id="thresholdSteps"
          name="thresholdSteps"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={thresholdSteps}
          aria-invalid={errorOf(state, "thresholdSteps") ? true : undefined}
        />
      </Field>
      <Field
        id="strideM"
        label="Largo de paso (m)"
        hint={`Vacío = automático (${autoStrideM.toFixed(3).replace(".", ",")} m según tu estatura).`}
        error={errorOf(state, "strideM")}
      >
        <Input
          id="strideM"
          name="strideM"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={strideM ?? ""}
          placeholder="0,72"
          aria-invalid={errorOf(state, "strideM") ? true : undefined}
        />
      </Field>
      <Status state={state} />
      <SubmitButton pending={pending}>Guardar pasos</SubmitButton>
    </form>
  );
}
