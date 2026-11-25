import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DayBalance, WeekSummary } from "@/lib/balance/compute";

const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nfFactor = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });

function kcal(value: number) {
  return `${nfKcal.format(Math.round(value))} kcal`;
}

/**
 * Resumen del balance del día (RF-26) en /comidas: consumido, meta, gasto y lo
 * que queda, más el déficit acumulado de la semana. El panel completo es #21.
 */
export function DayBalanceCard({
  day,
  week,
  isToday,
  minKcal,
}: {
  day: DayBalance;
  week: WeekSummary;
  isToday: boolean;
  /** Ingesta mínima prudente según el sexo del perfil (kcal). */
  minKcal: number;
}) {
  if (!day.energy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Balance del día</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Consumido: <strong className="tabular-nums">{kcal(day.intake.kcal)}</strong>
          </p>
          <p className="text-muted-foreground mt-1">
            Para calcular tu gasto y tu balance necesitamos un peso registrado en o antes
            de este día.{" "}
            <Link href="/peso" className="text-foreground underline">
              Registrar peso
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const goalKcal = day.target?.kcal ?? day.energy.tdee;
  const remaining = day.remainingKcal ?? 0;
  const balance = day.balanceKcal ?? 0;
  const figures = [
    { label: "Consumido", value: kcal(day.intake.kcal) },
    { label: day.target ? "Meta" : "Meta (mantener)", value: kcal(goalKcal) },
    { label: "Gasto", value: kcal(day.energy.tdee) },
    {
      label: remaining >= 0 ? "Restante" : "Sobre la meta",
      value: kcal(Math.abs(remaining)),
    },
  ];

  let balanceText: string;
  if (day.status === "deficit") balanceText = `Déficit de ${kcal(-balance)}`;
  else if (day.status === "surplus") balanceText = `Superávit de ${kcal(balance)}`;
  else balanceText = "En equilibrio";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance del día</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-muted-foreground text-[0.7rem] break-words">
                {f.label}
              </dt>
              <dd className="text-base font-semibold tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
        <p
          className={`text-sm font-medium ${
            day.status === "deficit"
              ? "text-emerald-700 dark:text-emerald-400"
              : day.status === "surplus"
                ? "text-amber-700 dark:text-amber-400"
                : ""
          }`}
        >
          {balanceText}
          {isToday && day.itemCount > 0 ? " hasta ahora" : ""}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          Gasto = TMB {nfKcal.format(day.energy.bmr)} ×{" "}
          {nfFactor.format(day.energy.factor)}
          {day.energy.stepsKcal > 0
            ? ` + pasos ${nfKcal.format(day.energy.stepsKcal)}`
            : ""}
          {day.energy.exerciseNetKcal > 0
            ? ` + ejercicio ${nfKcal.format(day.energy.exerciseNetKcal)}`
            : ""}
          .
        </p>
        {day.belowMinimum ? (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
            {isToday
              ? `Llevas menos de ${nfKcal.format(minKcal)} kcal hoy, el mínimo prudente. Si es todo lo que comerás, es muy poco.`
              : `La ingesta de este día quedó bajo ${nfKcal.format(minKcal)} kcal, el mínimo prudente. Si se repite, consulta a un profesional de la salud.`}
          </p>
        ) : null}
        {day.target?.limitedToMinimum ? (
          <p className="text-muted-foreground text-xs">
            Tu meta se ajustó al mínimo prudente de ingesta para tu ritmo de baja.
          </p>
        ) : null}
        <p className="border-t pt-2 text-sm">
          Semana (desde el lunes):{" "}
          {week.countedDays === 0 ? (
            <span className="text-muted-foreground">
              sin días con comidas registradas
            </span>
          ) : (
            <strong className="tabular-nums">
              {week.deficitKcal >= 0
                ? `déficit acumulado de ${kcal(week.deficitKcal)}`
                : `superávit acumulado de ${kcal(-week.deficitKcal)}`}
            </strong>
          )}
          {week.countedDays > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              en {week.countedDays} {week.countedDays === 1 ? "día" : "días"}
            </span>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
