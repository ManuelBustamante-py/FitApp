"use client";

import { Copy } from "lucide-react";
import { useActionState } from "react";

import { copyMeals, type CopyState } from "@/app/comidas/atajos-actions";

const INITIAL: CopyState = { status: "idle" };

/**
 * Copia al día mostrado el día anterior completo o una de sus comidas (RF-22).
 * `options` son las comidas del día anterior que se pueden copiar.
 */
export function CopyPreviousDay({
  date,
  options,
}: {
  date: string;
  options: { type: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(copyMeals, INITIAL);

  return (
    <section aria-labelledby="copiar-ayer" className="flex flex-col gap-2">
      <h2 id="copiar-ayer" className="text-base font-semibold">
        Copiar del día anterior
      </h2>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="date" value={date} />
        <button
          type="submit"
          name="mealType"
          value=""
          disabled={pending}
          className="bg-secondary text-secondary-foreground inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium disabled:opacity-50"
        >
          <Copy className="size-4" aria-hidden /> Todo el día
        </button>
        {options.map((option) => (
          <button
            key={option.type}
            type="submit"
            name="mealType"
            value={option.type}
            disabled={pending}
            className="hover:bg-muted inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-50"
          >
            <Copy className="size-4" aria-hidden /> {option.label}
          </button>
        ))}
      </form>
      {state.status === "done" ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
