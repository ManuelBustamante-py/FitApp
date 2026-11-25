"use client";

import { useActionState, useState, type FormEvent } from "react";

import { createCustomFood, type CustomFoodFormState } from "@/app/alimentos/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  NUTRIENT_FIELDS,
  parseCustomFoodForm,
  type CustomFoodField,
  type CustomFoodFieldErrors,
} from "@/lib/food/custom";

const INITIAL: CustomFoodFormState = { status: "idle" };

/** Campos de nutrientes con sangría, como en la etiqueta chilena. */
const NESTED = new Set(["saturated", "trans", "sugar", "fiber"]);

export function CustomFoodForm({ barcode }: { barcode?: string }) {
  const [state, formAction, pending] = useActionState(createCustomFood, INITIAL);
  const [clientErrors, setClientErrors] = useState<CustomFoodFieldErrors | null>(null);
  const [basis, setBasis] = useState("per_100g");
  const [entry, setEntry] = useState("portion");

  const errors: CustomFoodFieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});
  const unit = basis === "per_100ml" ? "ml" : "g";
  const perLabel = entry === "portion" ? "por porción" : `por 100 ${unit}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseCustomFoodForm(new FormData(event.currentTarget));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else setClientErrors(null);
  }

  const aria = (name: CustomFoodField) =>
    ({
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
    }) as const;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onChange={() => setClientErrors(null)}
      noValidate
      className="flex flex-col gap-4"
    >
      {barcode ? (
        <>
          <input type="hidden" name="barcode" value={barcode} />
          <p className="bg-muted rounded-lg px-3 py-2 text-sm">
            Código de barras: <span className="tabular-nums">{barcode}</span>
          </p>
        </>
      ) : null}
      <Field id="name" label="Nombre" error={errors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="off"
          maxLength={200}
          placeholder="Ej.: Yogur natural"
          {...aria("name")}
        />
      </Field>
      <Field id="brand" label="Marca (opcional)" error={errors.brand}>
        <Input
          id="brand"
          name="brand"
          autoComplete="off"
          maxLength={100}
          {...aria("brand")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="basis" label="Alimento en" error={errors.basis}>
          <Select
            id="basis"
            name="basis"
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
            {...aria("basis")}
          >
            <option value="per_100g">Gramos (g)</option>
            <option value="per_100ml">Mililitros (ml)</option>
          </Select>
        </Field>
        <Field id="entry" label="Valores de la etiqueta" error={errors.entry}>
          <Select
            id="entry"
            name="entry"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
            {...aria("entry")}
          >
            <option value="portion">Por porción</option>
            <option value="per100">Por 100 {unit}</option>
          </Select>
        </Field>
      </div>

      <Field
        id="portionSize"
        label={`Tamaño de la porción (${unit})${entry === "portion" ? "" : " · opcional"}`}
        hint="Se guarda como porción para registrarlo después."
        error={errors.portionSize}
      >
        <Input
          id="portionSize"
          name="portionSize"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={unit === "ml" ? "250" : "30"}
          {...aria("portionSize")}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">
          Información nutricional ({perLabel})
        </legend>
        {NUTRIENT_FIELDS.map(({ field, label, unit: nutrientUnit }) => (
          <div key={field} className={NESTED.has(field) ? "pl-4" : undefined}>
            <Field
              id={field}
              label={`${label} (${nutrientUnit})`}
              hint={
                field === "energy"
                  ? "Si la dejas vacía, se calcula desde los macros."
                  : undefined
              }
              error={errors[field]}
            >
              <Input
                id={field}
                name={field}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                {...aria(field)}
              />
            </Field>
          </div>
        ))}
      </fieldset>

      {errors.form ? (
        <p role="alert" className="text-destructive text-sm">
          {errors.form}
        </p>
      ) : null}
      {state.status === "error" && state.message && !clientErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Crear alimento"}
      </Button>
    </form>
  );
}
