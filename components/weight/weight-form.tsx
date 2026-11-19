"use client";

import { useActionState, useState, type FormEvent } from "react";

import { saveWeight, type WeightFormState } from "@/app/peso/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { parseWeightForm, type WeightFieldErrors } from "@/lib/weight/schema";

const INITIAL: WeightFormState = { status: "idle" };

export function WeightForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState(saveWeight, INITIAL);
  const [clientErrors, setClientErrors] = useState<WeightFieldErrors | null>(null);

  const errors: WeightFieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseWeightForm(new FormData(event.currentTarget), today);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else {
      setClientErrors(null);
    }
  }

  const aria = (name: keyof WeightFieldErrors) =>
    ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    }) as const;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="weightKg" label="Peso (kg)" error={errors.weightKg}>
          <Input
            id="weightKg"
            name="weightKg"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="70,5"
            onChange={() => setClientErrors(null)}
            {...aria("weightKg")}
          />
        </Field>
        <Field id="date" label="Fecha" error={errors.date}>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            onChange={() => setClientErrors(null)}
            {...aria("date")}
          />
        </Field>
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" && !clientErrors ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.updated ? "Peso de ese día actualizado." : "Peso registrado."}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Guardando…" : "Registrar peso"}
      </Button>
    </form>
  );
}
