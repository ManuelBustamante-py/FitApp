"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";

import { saveProfile, type ProfileFormState } from "@/app/perfil/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  ACTIVITY_LEVEL_LABELS,
  ONBOARDING_ACTIVITY_LEVELS,
  parseProfileForm,
  type FieldErrors,
} from "@/lib/profile/schema";

export interface ProfileFormDefaults {
  sex: string;
  birthDate: string;
  heightCm: string;
  timezone: string;
  activityLevel: string;
  goalType: string;
  targetWeightKg: string;
  targetBmi: string;
  goalDirection: string;
  weeklyRateKg: string;
}

const INITIAL: ProfileFormState = { status: "idle" };

export function ProfileForm({
  defaults,
  timezones,
  mode,
}: {
  defaults: ProfileFormDefaults;
  timezones: string[];
  mode: "onboarding" | "edit";
}) {
  const [state, formAction, pending] = useActionState(saveProfile, INITIAL);
  const [values, setValues] = useState(defaults);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);

  // En el onboarding la zona horaria se propone desde el navegador.
  useEffect(() => {
    if (mode !== "onboarding") return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el valor del navegador no existe en el servidor
    if (detected) setValues((v) => ({ ...v, timezone: detected }));
  }, [mode]);

  const errors: FieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});

  const set =
    (name: keyof ProfileFormDefaults) => (event: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [name]: event.target.value }));
      setClientErrors(null);
    };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseProfileForm(new FormData(event.currentTarget));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else {
      setClientErrors(null);
    }
  }

  const zones = timezones.includes(values.timezone)
    ? timezones
    : [values.timezone, ...timezones];
  const aria = (name: string) =>
    ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    }) as const;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">Tus datos</legend>

        <Field id="sex" label="Sexo (para las fórmulas)" error={errors.sex}>
          <Select
            id="sex"
            name="sex"
            value={values.sex}
            onChange={set("sex")}
            {...aria("sex")}
          >
            <option value="">Elige…</option>
            <option value="female">Mujer</option>
            <option value="male">Hombre</option>
          </Select>
        </Field>

        <Field id="birthDate" label="Fecha de nacimiento" error={errors.birthDate}>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            value={values.birthDate}
            onChange={set("birthDate")}
            autoComplete="bday"
            {...aria("birthDate")}
          />
        </Field>

        <Field id="heightCm" label="Estatura (cm)" error={errors.heightCm}>
          <Input
            id="heightCm"
            name="heightCm"
            type="text"
            inputMode="decimal"
            placeholder="170"
            value={values.heightCm}
            onChange={set("heightCm")}
            {...aria("heightCm")}
          />
        </Field>

        <Field
          id="activityLevel"
          label="Nivel de vida diaria"
          hint={
            ACTIVITY_LEVEL_LABELS[
              values.activityLevel as (typeof ONBOARDING_ACTIVITY_LEVELS)[number]
            ]?.hint ?? "Podrás ajustarlo por día más adelante."
          }
          error={errors.activityLevel}
        >
          <Select
            id="activityLevel"
            name="activityLevel"
            value={values.activityLevel}
            onChange={set("activityLevel")}
            {...aria("activityLevel")}
          >
            <option value="">Elige…</option>
            {ONBOARDING_ACTIVITY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {ACTIVITY_LEVEL_LABELS[level].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field id="timezone" label="Zona horaria" error={errors.timezone}>
          <Select
            id="timezone"
            name="timezone"
            value={values.timezone}
            onChange={set("timezone")}
            {...aria("timezone")}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">Tu meta</legend>

        <Field id="goalDirection" label="Quiero" error={errors.goalDirection}>
          <Select
            id="goalDirection"
            name="goalDirection"
            value={values.goalDirection}
            onChange={set("goalDirection")}
            {...aria("goalDirection")}
          >
            <option value="lose">Bajar de peso</option>
            <option value="gain">Subir de peso</option>
          </Select>
        </Field>

        <Field id="goalType" label="Definir la meta por" error={errors.goalType}>
          <Select
            id="goalType"
            name="goalType"
            value={values.goalType}
            onChange={set("goalType")}
            {...aria("goalType")}
          >
            <option value="weight">Peso objetivo (kg)</option>
            <option value="bmi">IMC objetivo</option>
          </Select>
        </Field>

        {values.goalType === "bmi" ? (
          <Field
            id="targetBmi"
            label="IMC objetivo"
            hint="Peso normal: IMC entre 18,5 y 24,9."
            error={errors.targetBmi}
          >
            <Input
              id="targetBmi"
              name="targetBmi"
              type="text"
              inputMode="decimal"
              placeholder="22"
              value={values.targetBmi}
              onChange={set("targetBmi")}
              {...aria("targetBmi")}
            />
          </Field>
        ) : (
          <Field
            id="targetWeightKg"
            label="Peso objetivo (kg)"
            error={errors.targetWeightKg}
          >
            <Input
              id="targetWeightKg"
              name="targetWeightKg"
              type="text"
              inputMode="decimal"
              placeholder="68"
              value={values.targetWeightKg}
              onChange={set("targetWeightKg")}
              {...aria("targetWeightKg")}
            />
          </Field>
        )}

        <Field
          id="weeklyRateKg"
          label="Ritmo semanal (kg por semana)"
          hint="Entre 0,25 y 1 kg por semana."
          error={errors.weeklyRateKg}
        >
          <Input
            id="weeklyRateKg"
            name="weeklyRateKg"
            type="text"
            inputMode="decimal"
            placeholder="0,5"
            value={values.weeklyRateKg}
            onChange={set("weeklyRateKg")}
            {...aria("weeklyRateKg")}
          />
        </Field>
      </fieldset>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" && !clientErrors ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Cambios guardados.
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Guardando…" : mode === "onboarding" ? "Empezar" : "Guardar cambios"}
      </Button>
    </form>
  );
}
