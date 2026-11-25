import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { FuenteAlimento } from "@/components/food/fuente-alimento";
import { MealItemForm } from "@/components/meal/meal-item-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/db/server";
import { basisLabel } from "@/lib/food/search";
import { defaultMealType, hourIn } from "@/lib/meal/meal-types";
import { getFoodForLogging } from "@/lib/meal/queries";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";

export const metadata: Metadata = { title: "Registrar alimento" };

type Params = Promise<{ id: string }>;

const STATE_LABELS: Record<string, string> = { crudo: "Crudo", cocido: "Cocido" };

const nfNutrient = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

async function FoodContent({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");

  const { id } = await params;
  const food = await getFoodForLogging(id);
  if (!food) notFound();

  const { timezone } = bundle.profile;
  const details = [food.brand, food.category, STATE_LABELS[food.state]]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{food.name}</h1>
        {details && <p className="text-muted-foreground text-sm">{details}</p>}
        <FuenteAlimento source={food.source} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar en una comida</CardTitle>
        </CardHeader>
        <CardContent>
          <MealItemForm
            food={{
              id: food.id,
              basis: food.basis,
              densityGMl: food.densityGMl,
              per100: food.per100,
              portions: food.portions,
            }}
            today={todayIn(timezone)}
            defaultMealType={defaultMealType(hourIn(timezone))}
          />
        </CardContent>
      </Card>

      <section aria-labelledby="nutrientes" className="flex flex-col gap-2">
        <h2 id="nutrientes" className="text-base font-semibold">
          Información nutricional por {basisLabel(food.basis)}
        </h2>
        {food.nutrientList.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Este alimento no informa nutrientes.
          </p>
        ) : (
          <dl className="divide-y rounded-lg border text-sm">
            {food.nutrientList.map((n) => (
              <div key={n.code} className="flex justify-between gap-3 px-3 py-2">
                <dt>{n.name}</dt>
                <dd className="tabular-nums">
                  {nfNutrient.format(n.per100)} {n.unit}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}

export default function FoodPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/alimentos"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Buscar alimentos
        </Link>
        <Link
          href="/comidas"
          className="text-sm font-medium underline underline-offset-2"
        >
          Comidas de hoy
        </Link>
      </div>
      <Suspense>
        <FoodContent params={params} />
      </Suspense>
    </main>
  );
}
