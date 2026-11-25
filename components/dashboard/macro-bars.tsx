import { macroShares } from "@/lib/balance/dashboard";
import type { Totals } from "@/lib/meal/day";

const nfG = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nfPct = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const COLORS = {
  protein: "bg-sky-600",
  carb: "bg-amber-500",
  fat: "bg-rose-500",
} as const;

/** Barras de macros del día: gramos y porción de las kcal de los macros. */
export function MacroBars({ totals }: { totals: Totals }) {
  const shares = macroShares(totals);
  return (
    <ul className="flex flex-col gap-3">
      {shares.map((m) => (
        <li key={m.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span>{m.label}</span>
            <span className="text-muted-foreground tabular-nums">
              {nfG.format(m.grams)} g · {nfPct.format(m.pct)} %
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={m.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(m.pct)}
            className="bg-muted h-2.5 overflow-hidden rounded-full"
          >
            <div
              className={`h-full rounded-full ${COLORS[m.key]}`}
              style={{ width: `${m.pct}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
