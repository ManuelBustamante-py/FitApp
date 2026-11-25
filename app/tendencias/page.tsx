import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  BmiChart,
  DeficitChart,
  ExerciseChart,
  WeightChart,
} from "@/components/trends/trend-charts";
import { getBalanceRange } from "@/lib/balance/queries";
import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";
import { listWeightsInRange } from "@/lib/trends/queries";
import {
  TREND_RANGES,
  buildBalanceSeries,
  buildWeightSeries,
  parseRange,
  rangeBounds,
} from "@/lib/trends/series";
import { todayIn } from "@/lib/weight/entries";

export const metadata: Metadata = { title: "Tendencias" };

type SearchParams = Promise<{ dias?: string | string[] }>;

async function Trends({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");

  const { dias } = await searchParams;
  const range = parseRange(dias);
  const { from, to } = rangeBounds(todayIn(bundle.profile.timezone), range);

  const [weights, balance] = await Promise.all([
    listWeightsInRange(user.id, from, to),
    getBalanceRange(user.id, from, to),
  ]);
  const weightSeries = buildWeightSeries(from, to, weights, bundle.profile.height_cm);
  const balanceSeries = buildBalanceSeries(balance ?? []);

  return (
    <>
      <nav aria-label="Rango de fechas">
        <ul className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
          {TREND_RANGES.map((r) => (
            <li key={r}>
              <Link
                href={`/tendencias?dias=${r}`}
                replace
                aria-current={r === range ? "page" : undefined}
                className={`flex h-9 items-center justify-center rounded-md text-sm font-medium ${
                  r === range
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r} días
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <WeightChart data={weightSeries} />
      <BmiChart data={weightSeries} />
      <DeficitChart data={balanceSeries} />
      <ExerciseChart data={balanceSeries} />
    </>
  );
}

export default function TendenciasPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tendencias</h1>
      </div>
      <Suspense>
        <Trends searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
