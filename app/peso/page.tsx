import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WeightForm } from "@/components/weight/weight-form";
import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";
import { BMI_CATEGORY_LABELS, todayIn, toEntries } from "@/lib/weight/entries";
import { listWeights } from "@/lib/weight/queries";

import { deleteWeight } from "./actions";

export const metadata: Metadata = { title: "Peso" };

const nf1 = new Intl.NumberFormat("es", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nfWeight = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

function formatDay(day: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

async function WeightContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");

  const entries = toEntries(await listWeights(user.id), bundle.profile.height_cm);
  const latest = entries[0];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Último registro</CardTitle>
        </CardHeader>
        <CardContent>
          {latest ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {nfWeight.format(latest.weightKg)} kg
                </p>
                <p className="text-muted-foreground text-xs">{formatDay(latest.day)}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold tabular-nums">
                  IMC {nf1.format(latest.bmi)}
                </p>
                <p className="text-sm">{BMI_CATEGORY_LABELS[latest.category]}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aún no registras tu peso. Agrega el primero abajo.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar peso</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightForm today={todayIn(bundle.profile.timezone)} />
        </CardContent>
      </Card>

      <section aria-labelledby="historial" className="flex flex-col gap-2">
        <h2 id="historial" className="text-base font-semibold">
          Historial
        </h2>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin registros todavía.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium tabular-nums">
                    {nfWeight.format(entry.weightKg)} kg
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {formatDay(entry.day)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    IMC {nf1.format(entry.bmi)} · {BMI_CATEGORY_LABELS[entry.category]}
                  </p>
                </div>
                <form action={deleteWeight}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button
                    type="submit"
                    aria-label={`Eliminar registro del ${formatDay(entry.day)}`}
                    className="hover:bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function WeightPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Peso e IMC</h1>
      </div>
      <Suspense>
        <WeightContent />
      </Suspense>
    </main>
  );
}
