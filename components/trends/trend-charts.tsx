"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BalancePoint, WeightPoint } from "@/lib/trends/series";

/** Paleta categórica validada (dataviz): claro y oscuro, por entidad. */
const PALETTE =
  "[--c-weight:#2a78d6] [--c-bmi:#6250d6] [--c-deficit:#2a78d6] [--c-surplus:#eb6834] [--c-exercise:#1baf7a] " +
  "[--c-grid:#e1e0d9] [--c-axis:#898781] " +
  "dark:[--c-weight:#3987e5] dark:[--c-bmi:#9085e9] dark:[--c-deficit:#3987e5] dark:[--c-surplus:#d95926] dark:[--c-exercise:#199e70] " +
  "dark:[--c-grid:#2c2c2a]";

const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const shortDay = (day: string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${day}T00:00:00Z`))
    .replace(".", "");
const longDay = (day: string) =>
  new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));

const tooltipStyle = {
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
};
const axisTick = { fontSize: 11, fill: "var(--c-axis)" };
const common = { margin: { top: 8, right: 8, bottom: 0, left: 0 } };
const yDomain: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min - 1),
  (max) => Math.ceil(max + 1),
];

function Legend({ items }: { items: { label: string; color: string; dot?: boolean }[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={i.dot ? "size-2 rounded-full" : "h-0.5 w-3 rounded"}
            style={{ background: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({
  title,
  legend,
  empty,
  table,
  children,
}: {
  title: string;
  legend: ReactNode;
  empty: boolean;
  table: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-3 ${PALETTE}`}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {empty ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          Aún no hay datos en este rango.
        </p>
      ) : (
        <>
          {legend}
          <div className="h-52 w-full min-w-0">{children}</div>
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer py-1">
              Ver como tabla
            </summary>
            <div className="max-h-60 overflow-y-auto">{table}</div>
          </details>
        </>
      )}
    </section>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-left tabular-nums">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col" className="text-muted-foreground py-1 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-t">
            {r.map((c, i) => (
              <td key={i} className="py-1">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const xAxis = (
  <XAxis
    dataKey="day"
    tickFormatter={shortDay}
    tick={axisTick}
    tickLine={false}
    axisLine={{ stroke: "var(--c-grid)" }}
    minTickGap={28}
  />
);

export function WeightChart({ data }: { data: WeightPoint[] }) {
  return (
    <ChartCard
      title="Peso"
      empty={!data.some((p) => p.weightKg !== null)}
      legend={
        <Legend
          items={[
            { label: "Promedio móvil 7 días", color: "var(--c-weight)" },
            { label: "Peso registrado", color: "var(--c-weight)", dot: true },
          ]}
        />
      }
      table={
        <DataTable
          head={["Día", "Peso", "Promedio"]}
          rows={data
            .filter((p) => p.weightKg !== null)
            .map((p) => [
              shortDay(p.day),
              `${nf1.format(p.weightKg ?? 0)} kg`,
              p.avgKg === null ? "—" : `${nf1.format(p.avgKg)} kg`,
            ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} {...common}>
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          {xAxis}
          <YAxis
            width={36}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickFormatter={(v: number) => nf0.format(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => longDay(String(d))}
            formatter={(v, name) => [`${nf1.format(Number(v))} kg`, String(name)]}
          />
          <Line
            type="monotone"
            dataKey="weightKg"
            name="Peso"
            stroke="none"
            dot={{
              r: 3,
              fill: "var(--c-weight)",
              fillOpacity: 0.55,
              stroke: "var(--card)",
              strokeWidth: 1,
            }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avgKg"
            name="Promedio 7 días"
            stroke="var(--c-weight)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BmiChart({ data }: { data: WeightPoint[] }) {
  return (
    <ChartCard
      title="IMC"
      empty={!data.some((p) => p.bmi !== null)}
      legend={<Legend items={[{ label: "IMC (kg/m²)", color: "var(--c-bmi)" }]} />}
      table={
        <DataTable
          head={["Día", "IMC"]}
          rows={data
            .filter((p) => p.bmi !== null)
            .map((p) => [shortDay(p.day), nf1.format(p.bmi ?? 0)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} {...common}>
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          {xAxis}
          <YAxis
            width={36}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            tickFormatter={(v: number) => nf0.format(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(d) => longDay(String(d))}
            formatter={(v) => [nf1.format(Number(v)), "IMC"]}
          />
          <Line
            type="monotone"
            dataKey="bmi"
            name="IMC"
            stroke="var(--c-bmi)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--c-bmi)", stroke: "var(--card)", strokeWidth: 1 }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DeficitChart({ data }: { data: BalancePoint[] }) {
  return (
    <ChartCard
      title="Déficit diario"
      empty={!data.some((p) => p.deficitKcal !== null)}
      legend={
        <Legend
          items={[
            { label: "Déficit", color: "var(--c-deficit)", dot: true },
            { label: "Superávit", color: "var(--c-surplus)", dot: true },
          ]}
        />
      }
      table={
        <DataTable
          head={["Día", "Balance"]}
          rows={data
            .filter((p) => p.deficitKcal !== null)
            .map((p) => [
              shortDay(p.day),
              (p.deficitKcal ?? 0) >= 0
                ? `Déficit ${nf0.format(p.deficitKcal ?? 0)} kcal`
                : `Superávit ${nf0.format(-(p.deficitKcal ?? 0))} kcal`,
            ])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} {...common} barCategoryGap="15%">
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          {xAxis}
          <YAxis
            width={44}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => nf0.format(v)}
          />
          <ReferenceLine y={0} stroke="var(--c-axis)" />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            contentStyle={tooltipStyle}
            labelFormatter={(d) => longDay(String(d))}
            formatter={(v) => {
              const n = Number(v);
              return n >= 0
                ? [`${nf0.format(n)} kcal`, "Déficit"]
                : [`${nf0.format(-n)} kcal`, "Superávit"];
            }}
          />
          <Bar dataKey="deficitKcal" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((p) => (
              <Cell
                key={p.day}
                fill={(p.deficitKcal ?? 0) >= 0 ? "var(--c-deficit)" : "var(--c-surplus)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ExerciseChart({ data }: { data: BalancePoint[] }) {
  return (
    <ChartCard
      title="Ejercicio"
      empty={!data.some((p) => p.exerciseKcal > 0)}
      legend={
        <Legend
          items={[{ label: "kcal quemadas", color: "var(--c-exercise)", dot: true }]}
        />
      }
      table={
        <DataTable
          head={["Día", "kcal quemadas"]}
          rows={data
            .filter((p) => p.exerciseKcal > 0)
            .map((p) => [shortDay(p.day), nf0.format(p.exerciseKcal)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} {...common} barCategoryGap="15%">
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          {xAxis}
          <YAxis
            width={36}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => nf0.format(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            contentStyle={tooltipStyle}
            labelFormatter={(d) => longDay(String(d))}
            formatter={(v) => [`${nf0.format(Number(v))} kcal`, "Quemadas"]}
          />
          <Bar
            dataKey="exerciseKcal"
            fill="var(--c-exercise)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
