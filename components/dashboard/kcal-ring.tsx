import { ringFraction } from "@/lib/balance/dashboard";

const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const SIZE = 180;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Anillo SVG de kcal del día: consumido frente a la meta (o al gasto si no hay meta). */
export function KcalRing({
  consumedKcal,
  goalKcal,
}: {
  consumedKcal: number;
  goalKcal: number;
}) {
  const fraction = ringFraction(consumedKcal, goalKcal);
  const over = consumedKcal > goalKcal;
  const remaining = Math.round(goalKcal - consumedKcal);
  return (
    <div
      role="img"
      aria-label={`Consumiste ${nfKcal.format(Math.round(consumedKcal))} de ${nfKcal.format(Math.round(goalKcal))} kcal`}
      className="relative mx-auto aspect-square w-full max-w-[180px]"
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          className={over ? "stroke-amber-500" : "stroke-emerald-600"}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-semibold tabular-nums">
          {nfKcal.format(Math.abs(remaining))}
        </span>
        <span className="text-muted-foreground text-xs">
          {remaining >= 0 ? "kcal restantes" : "kcal sobre la meta"}
        </span>
      </div>
    </div>
  );
}
