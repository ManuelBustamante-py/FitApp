import { ArrowLeft, Trash2, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutForm } from "@/components/workout/workout-form";
import type { KcalMethod } from "@/lib/calc";
import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";
import {
  exerciseContext,
  isHrOutOfRange,
  KCAL_METHOD_LABELS,
} from "@/lib/workout/context";
import {
  getBodyData,
  listActivityTypes,
  listRecentWorkouts,
} from "@/lib/workout/queries";

import { deleteWorkout } from "./actions";

export const metadata: Metadata = { title: "Ejercicio" };

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

function formatDay(day: string) {
  return new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

const kcal = (value: number | null) => (value === null ? "—" : nf0.format(value));

async function WorkoutContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");
  const { profile } = bundle;

  const today = todayIn(profile.timezone);
  const [activities, body, sessions] = await Promise.all([
    listActivityTypes(),
    getBodyData(user.id),
    listRecentWorkouts(user.id),
  ]);
  const context = exerciseContext(profile, body.weightKg, body.bodyFatPct, today);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Registrar sesión</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {context ? (
            <>
              <p className="text-muted-foreground text-xs">
                Se estima por pulso (Keytel), por MET y con el valor de la máquina, con{" "}
                {nf1.format(context.weightKg)} kg y {context.ageYears} años. Se usa el
                pulso si lo ingresas; si no, el MET. Las kcal netas descuentan tu TMB (≈{" "}
                {nf0.format(context.bmr)} kcal/día) durante la sesión.
              </p>
              <WorkoutForm
                today={today}
                activities={activities}
                context={context}
                defaultActivityId={sessions[0]?.activity_type_id ?? null}
              />
            </>
          ) : (
            <p className="text-sm">
              Para estimar el gasto necesitamos tu peso.{" "}
              <Link href="/peso" className="font-medium underline">
                Registra tu peso
              </Link>{" "}
              y vuelve para anotar tu sesión.
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="recientes" className="flex flex-col gap-2">
        <h2 id="recientes" className="text-base font-semibold">
          Sesiones recientes
        </h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin sesiones todavía.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.map((s) => {
              const day = s.started_at.slice(0, 10);
              const method = s.kcal_method as KcalMethod;
              return (
                <li key={s.id} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {s.activity_type?.name_es ?? "Actividad"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDay(day)} · {nf1.format(s.duration_min)} min
                      {s.hr_avg !== null ? ` · ${s.hr_avg} lpm` : ""}
                    </p>
                    <p className="text-xs tabular-nums">
                      Pulso {kcal(s.kcal_hr)} · MET {kcal(s.kcal_met)} · Máquina{" "}
                      {kcal(s.machine_kcal)} kcal
                    </p>
                    <p className="text-sm tabular-nums">
                      <span className="font-medium">
                        {nf0.format(s.kcal_selected)} kcal
                      </span>{" "}
                      ({KCAL_METHOD_LABELS[method] ?? method}) ·{" "}
                      <span className="font-medium">{nf0.format(s.kcal_net)} netas</span>
                    </p>
                    {isHrOutOfRange(s.hr_avg) ? (
                      <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="size-3.5" aria-hidden />
                        Pulso fuera de 90–150 lpm: baja confianza
                      </p>
                    ) : null}
                  </div>
                  <form action={deleteWorkout}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      aria-label={`Eliminar sesión del ${formatDay(day)}`}
                      className="hover:bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default function WorkoutPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ejercicio</h1>
      </div>
      <Suspense>
        <WorkoutContent />
      </Suspense>
    </main>
  );
}
