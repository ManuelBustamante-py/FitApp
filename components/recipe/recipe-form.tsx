"use client";

import { Search, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition, type FormEvent } from "react";

import {
  searchIngredients,
  type IngredientOption,
  type RecipeFormState,
} from "@/app/recetas/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cleanQuery, isSearchable } from "@/lib/food/search";
import { parseRecipeForm, type RecipeFieldErrors } from "@/lib/recipe/schema";

interface IngredientRow {
  foodId: string;
  name: string;
  brand: string | null;
  grams: string;
}

export interface RecipeFormInitial {
  name: string;
  cookedWeight: string;
  servings: string;
  ingredients: IngredientRow[];
}

const INITIAL_STATE: RecipeFormState = { status: "idle" };

/**
 * Formulario de receta (RF-20): ingredientes con gramos, peso final cocido y, opcional,
 * número de porciones. Los nutrientes por 100 g se calculan en el servidor al guardar.
 */
export function RecipeForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: RecipeFormState, formData: FormData) => Promise<RecipeFormState>;
  initial?: RecipeFormInitial;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const [clientErrors, setClientErrors] = useState<RecipeFieldErrors | null>(null);
  const [rows, setRows] = useState<IngredientRow[]>(initial?.ingredients ?? []);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<IngredientOption[] | null>(null);
  const [searching, startSearch] = useTransition();

  const errors: RecipeFieldErrors =
    clientErrors ?? (state.status === "error" ? (state.errors ?? {}) : {});

  function search() {
    const q = cleanQuery(query);
    if (!isSearchable(q)) {
      setOptions([]);
      return;
    }
    startSearch(async () => setOptions(await searchIngredients(q)));
  }

  function addIngredient(option: IngredientOption) {
    setRows((current) =>
      current.some((r) => r.foodId === option.id)
        ? current
        : [
            ...current,
            { foodId: option.id, name: option.name, brand: option.brand, grams: "" },
          ],
    );
    setOptions(null);
    setQuery("");
  }

  const serialized = JSON.stringify(
    rows.map((r) => ({ foodId: r.foodId, grams: r.grams })),
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const result = parseRecipeForm(new FormData(event.currentTarget));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(result.errors);
    } else setClientErrors(null);
  }

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      onChange={() => setClientErrors(null)}
      noValidate
      className="flex flex-col gap-4"
    >
      <Field id="name" label="Nombre de la receta" error={errors.name}>
        <Input
          id="name"
          name="name"
          autoComplete="off"
          maxLength={120}
          defaultValue={initial?.name}
          placeholder="Ej.: Sopa de verduras"
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Ingredientes</legend>
        <div className="flex gap-2">
          <label htmlFor="ingredient-search" className="sr-only">
            Buscar ingrediente
          </label>
          <Input
            id="ingredient-search"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            maxLength={100}
            placeholder="Busca un alimento…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                search();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={search} disabled={searching}>
            <Search className="size-4" aria-hidden /> Buscar
          </Button>
        </div>

        {options !== null ? (
          options.length === 0 ? (
            <p className="text-muted-foreground text-sm" role="status">
              {searching
                ? "Buscando…"
                : "No encontramos alimentos. Prueba con otro nombre."}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Resultados">
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(option)}
                    className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                  >
                    <span className="min-w-0 break-words">
                      {option.name}
                      {option.brand ? (
                        <span className="text-muted-foreground"> · {option.brand}</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {option.kcalPer100 === null
                        ? "sin dato"
                        : `${Math.round(option.kcalPer100)} kcal/100`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Busca y agrega los ingredientes (alimentos del catálogo o propios).
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.foodId} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field
                    id={`grams-${index}`}
                    label={`${row.name}${row.brand ? ` · ${row.brand}` : ""} (g)`}
                  >
                    <Input
                      id={`grams-${index}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.grams}
                      placeholder="Gramos"
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((r) =>
                            r.foodId === row.foodId
                              ? { ...r, grams: event.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`Quitar ${row.name}`}
                  onClick={() =>
                    setRows((current) => current.filter((r) => r.foodId !== row.foodId))
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <input type="hidden" name="ingredients" value={serialized} />
        {errors.ingredients ? (
          <p role="alert" className="text-destructive text-xs">
            {errors.ingredients}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="cookedWeight"
          label="Peso final cocido (g)"
          hint="Pesa la preparación terminada."
          error={errors.cookedWeight}
        >
          <Input
            id="cookedWeight"
            name="cookedWeight"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial?.cookedWeight}
            aria-invalid={errors.cookedWeight ? true : undefined}
          />
        </Field>
        <Field
          id="servings"
          label="Porciones (opcional)"
          hint="Porción = peso cocido / porciones."
          error={errors.servings}
        >
          <Input
            id="servings"
            name="servings"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={initial?.servings}
            aria-invalid={errors.servings ? true : undefined}
          />
        </Field>
      </div>

      {state.status === "error" && state.message && !clientErrors ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
