import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  BmrForm,
  DayAdjustmentForm,
  ScheduleForm,
  StepsSettingsForm,
  type BmrOption,
} from "@/components/activity/activity-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivityData } from "@/lib/activity/queries";
import { activityToField, describeActivity, rowToActivity } from "@/lib/activity/rows";
import {
  ageOn,
  BMR_FORMULAS,
  bmr,
  bmrComparison,
  dayTdee,
  DEFAULT_DAY_ACTIVITY,
  strideLengthM,
  type BmrFormula,
  type DayActivity,
} from "@/lib/calc";
import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";

import { deleteDayAdjustment } from "./actions";

export const metadata: Metadata = { title: "TMB y actividad" };

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });

function formatDay(day: string) {
  return new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

function addDays(day: string, delta: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

async function ActivityContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");
  const { profile } = bundle;

  const today = todayIn(profile.timezone);
  const data = await getActivityData(user.id, addDays(today, -7));

  const formula = profile.bmr_formula as BmrFormula;
  const autoStrideM = strideLengthM(profile.height_cm, profile.sex as "male" | "female");
  const strideM = profile.stride_m ?? autoStrideM;

  // TMB con el último peso registrado (el peso de tendencia llega con el seguimiento de peso).
  const input =
    data.weightKg === null
      ? null
      : {
          sex: profile.sex as "male" | "female",
          weightKg: data.weightKg,
          heightCm: profile.height_cm,
          ageYears: ageOn(profile.birth_date, today),
          bodyFatPct: data.bodyFatPct,
          measuredKcal: profile.bmr_measured_kcal,
        };

  const comparison = input ? bmrComparison(input) : {};
  const options: BmrOption[] = BMR_FORMULAS.map((f) => {
    const kcal = comparison[f] ?? null;
    let missing: string | null = null;
    if (!input) missing = "Registra tu peso para calcularla";
    else if (kcal === null)
      missing =
        f === "measured"
          ? "Ingresa el valor medido y guarda"
          : "Falta tu % de grasa corporal";
    return { formula: f, kcal, missing };
  });

  let chosenBmr: number | null = null;
  if (input) {
    try {
      chosenBmr = bmr(formula, input);
    } catch {
      chosenBmr = comparison.mifflin ?? null;
    }
  }

  const schedule: Record<number, DayActivity | undefined> = {};
  for (const row of data.schedule) {
    const activity = rowToActivity({ ...row, steps: row.steps_target });
    if (activity) schedule[row.weekday] = activity;
  }

  const tdeeOf = (activity: DayActivity) =>
    chosenBmr !== null && data.weightKg !== null
      ? dayTdee({
          bmr: chosenBmr,
          activity,
          weightKg: data.weightKg,
          strideM,
          thresholdSteps: profile.sedentary_steps_threshold,
        }).total
      : null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const weekday = i + 1;
    const activity = schedule[weekday] ?? DEFAULT_DAY_ACTIVITY;
    return { weekday, ...activityToField(activity), tdee: tdeeOf(activity) };
  });

  const overrides = data.overrides.flatMap((row) => {
    const activity = rowToActivity({ ...row, steps: row.steps_actual });
    return activity ? [{ day: row.day, activity }] : [];
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Fórmula de TMB</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            Cálculo con {data.weightKg !== null ? `${data.weightKg} kg` : "tu peso"},{" "}
            {profile.height_cm} cm y {ageOn(profile.birth_date, today)} años. Compara las
            fórmulas y elige una.
          </p>
          <BmrForm
            options={options}
            formula={formula}
            measuredKcal={profile.bmr_measured_kcal}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Semana tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            Actividad cotidiana de cada día, sin contar el ejercicio registrado. «Por
            pasos» usa Sedentario más los pasos sobre el umbral.
          </p>
          <ScheduleForm days={days} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajuste por fecha</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            Reemplaza a la semana tipo ese día: cambia el nivel o ingresa tus pasos
            reales. Si registras una caminata como ejercicio, no cuentes sus pasos acá.
          </p>
          <DayAdjustmentForm today={today} />
          {overrides.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {overrides.map(({ day, activity }) => {
                const tdee = tdeeOf(activity);
                return (
                  <li key={day} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{formatDay(day)}</p>
                      <p className="text-muted-foreground text-xs">
                        {describeActivity(activity)}
                        {tdee !== null ? ` · ≈ ${nf0.format(tdee)} kcal` : ""}
                      </p>
                    </div>
                    <form action={deleteDayAdjustment}>
                      <input type="hidden" name="day" value={day} />
                      <button
                        type="submit"
                        aria-label={`Quitar ajuste del ${formatDay(day)}`}
                        className="hover:bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pasos</CardTitle>
        </CardHeader>
        <CardContent>
          <StepsSettingsForm
            thresholdSteps={profile.sedentary_steps_threshold}
            strideM={profile.stride_m}
            autoStrideM={autoStrideM}
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function ActivityPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">TMB y actividad</h1>
      </div>
      <Suspense>
        <ActivityContent />
      </Suspense>
    </main>
  );
}
