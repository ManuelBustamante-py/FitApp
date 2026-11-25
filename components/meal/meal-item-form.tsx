"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";

import { saveMealItem, type MealItemFormState } from "@/app/comidas/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { basisUnit, type FoodBasis } from "@/lib/calc";
import { MEAL_TYPE_LABELS, MEAL_TYPES, type MealType } from "@/lib/meal/meal-types";
import {
  parseMealItemForm,
  type MealItemField,
  type MealItemFieldErrors,
} from "@/lib/meal/schema";
import { buildMealItemSnapshot, type MealItemSnapshot } from "@/lib/meal/snapshot";

import { MacroSummary } from "./macro-summary";

const INITIAL: MealItemFormState = { status: "idle" };

export interface MealItemFormFood {
  id: string;
  basis: FoodBasis;
  densityGMl: number | null;
  per100: Record<string, number>;
  portions: { id: string; label: string; grams: number }[];
}

const nfGrams = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

function formatDay(day: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function MealItemForm({
  food,
  today,
  defaultMealType,
}: {
  food: MealItemFormFood;
  today: string;
  defaultMealType: MealType;
}) {
  const [state, formAction, pending] = useActionState(saveMealItem, INITIAL);
  const [clientErrors, setClientErrors] = useState<MealItemFieldErrors | null>(null);
  const [unit, setUnit] = useState<string>(basisUnit(food.basis));
  const [preview, setPreview] = useState<{
    snapshot: MealItemSnapshot;
    densityAssumed: boolean;
  } | null>(null);

  const errors: MealItemFieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});
  const baseUnit = basisUnit(food.basis);
  const hasPortions = food.portions.length > 0;

  function updatePreview(form: HTMLFormElement) {
    const data = new FormData(form);
    // Al cambiar a porción, el selector de porción aún no se ha mostrado.
    if (data.get("unit") === "portion" && !data.get("portionId") && food.portions[0])
      data.set("portionId", food.portions[0].id);
    const parsed = parseMealItemForm(data, today);
    if (!parsed.success) {
      setPreview(null);
      return;
    }
    const result = buildMealItemSnapshot(food, parsed.data);
    setPreview(
      result.ok
        ? { snapshot: result.snapshot, densityAssumed: result.densityAssumed }
        : null,
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseMealItemForm(new FormData(event.currentTarget), today);
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else {
      // El formulario se limpia al guardar; la vista previa también.
      setClientErrors(null);
      setPreview(null);
    }
  }

  const aria = (name: MealItemField) =>
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
        updatePreview(event.currentTarget);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="foodId" value={food.id} />

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="quantity"
          label={unit === "portion" ? "Porciones" : `Cantidad (${baseUnit})`}
          error={errors.quantity}
        >
          <Input
            id="quantity"
            name="quantity"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={unit === "portion" ? "1" : "100"}
            {...aria("quantity")}
          />
        </Field>
        <Field id="unit" label="Unidad" error={errors.unit}>
          <Select
            id="unit"
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            {...aria("unit")}
          >
            <option value={baseUnit}>
              {baseUnit === "ml" ? "Mililitros" : "Gramos"}
            </option>
            {hasPortions ? <option value="portion">Porción casera</option> : null}
          </Select>
        </Field>
      </div>

      {hasPortions && unit === "portion" ? (
        <Field id="portionId" label="Porción" error={errors.portionId}>
          <Select
            id="portionId"
            name="portionId"
            defaultValue={food.portions[0]?.id}
            {...aria("portionId")}
          >
            {food.portions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({nfGrams.format(p.grams)} g)
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field id="mealType" label="Comida" error={errors.mealType}>
          <Select
            id="mealType"
            name="mealType"
            defaultValue={defaultMealType}
            {...aria("mealType")}
          >
            {MEAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEAL_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
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
      </div>

      <div className="bg-muted/50 rounded-lg p-3" aria-live="polite">
        {preview ? (
          <>
            <p className="text-muted-foreground mb-2 text-xs">
              Vista previa · {nfGrams.format(preview.snapshot.grams_resolved)} g
              {preview.snapshot.kcal_estimated
                ? " · kcal estimadas desde los macronutrientes"
                : ""}
            </p>
            <MacroSummary
              kcal={preview.snapshot.kcal}
              proteinG={preview.snapshot.protein_g}
              carbG={preview.snapshot.carb_g}
              fatG={preview.snapshot.fat_g}
            />
            {preview.densityAssumed ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Sin densidad informada: se asume 1 g por ml.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Ingresa la cantidad para ver las calorías y los macronutrientes.
          </p>
        )}
      </div>

      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
      {summary ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Registrado en {summary.mealLabel.toLowerCase()} del {formatDay(summary.date)}:{" "}
          {Math.round(summary.kcal)} kcal.{" "}
          <Link href={`/comidas?dia=${summary.date}`} className="font-medium underline">
            Ver comidas del día
          </Link>
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Guardando…" : "Registrar alimento"}
      </Button>
    </form>
  );
}
