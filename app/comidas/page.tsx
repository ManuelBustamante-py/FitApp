import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FuenteAlimento } from "@/components/food/fuente-alimento";
import { MacroSummary } from "@/components/meal/macro-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/db/server";
import { groupDay, shiftDay } from "@/lib/meal/day";
import { listDayMeals } from "@/lib/meal/queries";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";

import { deleteMealItem } from "./actions";

export const metadata: Metadata = { title: "Comidas" };

type SearchParams = Promise<{ dia?: string | string[] }>;

const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nfMacro = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatDay(day: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function DayContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");

  const today = todayIn(bundle.profile.timezone);
  const { dia } = await searchParams;
  const requested = Array.isArray(dia) ? dia[0] : dia;
  const day = requested && isIsoDay(requested) && requested <= today ? requested : today;
  const isToday = day === today;

  const { meals, totals } = groupDay(await listDayMeals(user.id, day));

  return (
    <>
      <nav
        aria-label="Cambiar de día"
        className="flex items-center justify-between gap-2"
      >
        <Link
          href={`/comidas?dia=${shiftDay(day, -1)}`}
          aria-label="Día anterior"
          className="hover:bg-muted flex size-9 items-center justify-center rounded-lg border"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <p className="text-sm font-medium first-letter:uppercase" aria-live="polite">
          {isToday ? "Hoy, " : ""}
          {formatDay(day)}
        </p>
        {isToday ? (
          <span className="size-9" aria-hidden />
        ) : (
          <Link
            href={
              day === shiftDay(today, -1)
                ? "/comidas"
                : `/comidas?dia=${shiftDay(day, 1)}`
            }
            aria-label="Día siguiente"
            className="hover:bg-muted flex size-9 items-center justify-center rounded-lg border"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Total del día</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroSummary {...totals} />
        </CardContent>
      </Card>

      <Link
        href="/alimentos"
        className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center gap-1 rounded-lg px-4 text-base font-medium"
      >
        <Plus className="size-4" aria-hidden /> Agregar alimento
      </Link>

      {meals.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay comidas registradas {isToday ? "hoy" : "este día"}. Busca un alimento
          para agregarlo.
        </p>
      ) : (
        meals.map((meal) => (
          <section
            key={meal.type}
            aria-labelledby={`comida-${meal.type}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 id={`comida-${meal.type}`} className="text-base font-semibold">
                {meal.label}
              </h2>
              <p className="text-muted-foreground text-xs tabular-nums">
                {nfKcal.format(meal.totals.kcal)} kcal · P{" "}
                {nfMacro.format(meal.totals.proteinG)} · C{" "}
                {nfMacro.format(meal.totals.carbG)} · G {nfMacro.format(meal.totals.fatG)}
              </p>
            </div>
            <ul className="divide-y rounded-lg border">
              {meal.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">{item.foodName}</p>
                      <p className="text-muted-foreground text-xs">
                        {[item.quantityLabel, item.brand].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {nfKcal.format(item.kcal)} kcal
                      {item.kcalEstimated ? (
                        <span className="text-muted-foreground block text-right text-xs font-normal">
                          estimadas
                        </span>
                      ) : null}
                    </p>
                    <form action={deleteMealItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        aria-label={`Eliminar ${item.foodName} de ${meal.label.toLowerCase()}`}
                        className="hover:bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </form>
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Proteínas {nfMacro.format(item.proteinG)} g · Carbohidratos{" "}
                    {nfMacro.format(item.carbG)} g · Grasas {nfMacro.format(item.fatG)} g
                  </p>
                  {item.source ? <FuenteAlimento source={item.source} /> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-muted-foreground text-xs">
        Cada registro guarda los nutrientes del alimento al momento de registrarlo: si el
        alimento cambia después, tu historial no cambia.
      </p>
    </>
  );
}

export default function MealsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Comidas</h1>
      </div>
      <Suspense>
        <DayContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
