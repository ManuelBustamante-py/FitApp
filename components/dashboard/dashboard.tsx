import Link from "next/link";
import { redirect } from "next/navigation";

import { KcalRing } from "@/components/dashboard/kcal-ring";
import { MacroBars } from "@/components/dashboard/macro-bars";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDayBalance } from "@/lib/balance/queries";
import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";

const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const kcal = (v: number) => `${nfKcal.format(Math.round(v))} kcal`;

/** Panel del día (RF-27): anillo de kcal, macros y déficit acumulado de la semana. */
export async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");

  const today = todayIn(bundle.profile.timezone);
  const balance = await getDayBalance(user.id, today);
  if (!balance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Configura tu meta</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Aún no tenemos tu perfil para calcular el balance.{" "}
          <Link href="/perfil" className="underline">
            Configurar perfil y meta
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { day, week } = balance;
  if (!day.energy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Falta tu peso</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Para calcular tu gasto y tu balance necesitamos un peso registrado.{" "}
          <Link href="/peso" className="underline">
            Registrar peso
          </Link>
        </CardContent>
      </Card>
    );
  }

  const goalKcal = day.target?.kcal ?? day.energy.tdee;
  const weekText =
    week.countedDays === 0
      ? "Sin días con comidas registradas esta semana."
      : week.deficitKcal >= 0
        ? `Déficit acumulado de ${kcal(week.deficitKcal)}`
        : `Superávit acumulado de ${kcal(-week.deficitKcal)}`;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Calorías de hoy</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <KcalRing consumedKcal={day.intake.kcal} goalKcal={goalKcal} />
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Consumido", value: day.intake.kcal },
              { label: day.target ? "Meta" : "Meta (mantener)", value: goalKcal },
              { label: "Gasto", value: day.energy.tdee },
            ].map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-muted-foreground text-[0.7rem] break-words">
                  {f.label}
                </dt>
                <dd className="text-sm font-semibold tabular-nums">{kcal(f.value)}</dd>
              </div>
            ))}
          </dl>
          {day.target ? null : (
            <p className="text-muted-foreground text-xs">
              Sin meta activa: se usa tu gasto como referencia.{" "}
              <Link href="/perfil" className="text-foreground underline">
                Configurar meta
              </Link>
            </p>
          )}
          {day.belowMinimum ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Tu ingesta de hoy está bajo el mínimo prudente.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Macros</CardTitle>
        </CardHeader>
        <CardContent>
          <MacroBars totals={day.intake} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Déficit semanal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <p className="font-semibold tabular-nums">{weekText}</p>
          {week.countedDays > 0 ? (
            <p className="text-muted-foreground text-xs">
              En {week.countedDays} {week.countedDays === 1 ? "día" : "días"} desde el
              lunes
              {week.targetDeficitKcal !== null
                ? ` · tu meta pedía ${kcal(week.targetDeficitKcal)}`
                : ""}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
