"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { saveMealItem, type MealItemFormState } from "@/app/comidas/actions";
import { Input, Select } from "@/components/ui/field";
import { MEAL_TYPE_LABELS, MEAL_TYPES, type MealType } from "@/lib/meal/meal-types";
import type { QuickFood } from "@/lib/meal/shortcuts";

const INITIAL: MealItemFormState = { status: "idle" };

function unitLabel(food: QuickFood): string {
  if (food.unit === "portion") return food.portionLabel ?? "porción";
  return food.unit;
}

/**
 * Fila de favorito o reciente para agregar de un toque: viene con la última cantidad
 * y unidad usadas, la comida según la hora y el día de hoy. Solo hay que tocar «Agregar»
 * (o ajustar la cantidad o la comida antes).
 */
export function QuickAddRow({
  food,
  today,
  defaultMealType,
}: {
  food: QuickFood;
  today: string;
  defaultMealType: MealType;
}) {
  const [state, formAction, pending] = useActionState(saveMealItem, INITIAL);
  const saved = state.status === "saved";
  const error =
    state.status === "error"
      ? (state.message ?? Object.values(state.errors ?? {})[0])
      : null;

  return (
    <li className="flex flex-col gap-2 px-3 py-3">
      <p className="text-sm font-medium break-words">
        <Link
          href={`/alimentos/${food.foodId}`}
          className="underline-offset-2 hover:underline"
        >
          {food.name}
        </Link>
        {food.brand ? (
          <span className="text-muted-foreground text-xs font-normal">
            {" "}
            · {food.brand}
          </span>
        ) : null}
      </p>
      <form action={formAction} className="flex items-center gap-2" noValidate>
        <input type="hidden" name="foodId" value={food.foodId} />
        <input type="hidden" name="unit" value={food.unit} />
        {food.portionId ? (
          <input type="hidden" name="portionId" value={food.portionId} />
        ) : null}
        <input type="hidden" name="date" value={today} />
        <Input
          name="quantity"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={String(food.quantity).replace(".", ",")}
          aria-label={`Cantidad de ${food.name}`}
          className="w-20 shrink-0"
        />
        <span className="text-muted-foreground min-w-0 shrink text-xs break-words">
          {unitLabel(food)}
        </span>
        <Select
          name="mealType"
          defaultValue={defaultMealType}
          aria-label={`Comida para ${food.name}`}
          className="min-w-0 flex-1"
        >
          {MEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {MEAL_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          disabled={pending}
          aria-label={`Agregar ${food.name}`}
          className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-medium disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden /> Agregar
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          Registrado en {state.summary.mealLabel.toLowerCase()}:{" "}
          {Math.round(state.summary.kcal)} kcal.{" "}
          <Link href="/comidas" className="font-medium underline">
            Ver comidas
          </Link>
        </p>
      ) : null}
    </li>
  );
}
