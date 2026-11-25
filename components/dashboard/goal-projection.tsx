import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntakeAlert, ProjectionResult } from "@/lib/balance/projection";

const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const fmtDay = (day: string) => dateFmt.format(new Date(`${day}T00:00:00Z`));

function weeks(days: number) {
  const w = Math.max(1, Math.round(days / 7));
  return `${w} ${w === 1 ? "semana" : "semanas"}`;
}

function noProgressText(p: Extract<ProjectionResult, { status: "no-progress" }>) {
  if (p.avgBalanceKcal === 0)
    return p.direction === "lose"
      ? "Con tu ritmo reciente no hay déficit, así que no hay fecha estimada."
      : "Con tu ritmo reciente no hay superávit, así que no hay fecha estimada.";
  return p.direction === "lose"
    ? "Con tu ritmo reciente estás en superávit, así que tu peso no se acerca a la meta."
    : "Con tu ritmo reciente estás en déficit, así que tu peso se aleja de la meta.";
}

/** Proyección a la meta (RF-29, HU-06): siempre un rango de fechas, nunca una fecha exacta. */
export function GoalProjectionCard({ projection }: { projection: ProjectionResult }) {
  let body: React.ReactNode;
  switch (projection.status) {
    case "no-goal":
      body = (
        <p className="text-muted-foreground text-sm">
          Define una meta de peso para estimar cuándo la alcanzarías.{" "}
          <Link href="/perfil" className="text-foreground underline">
            Configurar meta
          </Link>
        </p>
      );
      break;
    case "reached":
      body = <p className="text-sm font-medium">¡Ya estás en tu peso meta!</p>;
      break;
    case "few-data":
      body = (
        <p className="text-muted-foreground text-sm">
          Aún hay pocos datos: registra tus comidas al menos {projection.minDays} días
          (llevas {projection.countedDays}) y un peso reciente para estimar tu ritmo.
        </p>
      );
      break;
    case "no-progress":
      body = (
        <p className="text-sm">
          {noProgressText(projection)}{" "}
          <span className="text-muted-foreground">
            Balance medio: {nfKcal.format(Math.round(projection.avgBalanceKcal))}{" "}
            kcal/día.
          </span>
        </p>
      );
      break;
    case "too-far":
      body = (
        <p className="text-sm">
          Con tu ritmo actual la meta queda a más de 2 años: no mostramos una fecha.
          Ajusta tu ritmo o tu meta para una estimación útil.{" "}
          <Link href="/perfil" className="underline">
            Configurar meta
          </Link>
        </p>
      );
      break;
    case "ok":
      body = (
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold break-words">
            Entre {fmtDay(projection.from)} y {fmtDay(projection.to)}
          </p>
          <p className="text-muted-foreground text-xs">
            En unas {weeks(projection.minDays)} a {weeks(projection.maxDays)}, si
            mantienes tu {projection.direction === "lose" ? "déficit" : "superávit"} medio
            de {nfKcal.format(Math.round(Math.abs(projection.avgBalanceKcal)))} kcal/día
            (± {nfKcal.format(Math.round(projection.marginKcal))}) de los últimos{" "}
            {projection.countedDays} días registrados. Es una estimación: el gasto se
            adapta y el rango se recalcula con tus datos.
          </p>
        </div>
      );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyección a tu meta</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

/** Aviso de ingesta bajo el mínimo prudente en los últimos días. */
export function IntakeAlertNote({ alert }: { alert: IntakeAlert | null }) {
  if (!alert) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="font-medium">Ingesta por debajo del mínimo</p>
      <p className="mt-1 text-xs">
        {alert.daysBelow === 1 ? "1 día" : `${alert.daysBelow} días`} de los últimos{" "}
        {alert.loggedDays} registrados quedó bajo {nfKcal.format(alert.minKcal)} kcal.
        Comer tan poco puede ser riesgoso: consulta a un profesional de la salud.
      </p>
    </div>
  );
}
