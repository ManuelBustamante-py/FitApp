const nfKcal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const nfMacro = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** kcal (enteras, HU-03) y macronutrientes (1 decimal) de un ítem, comida o día. */
export function MacroSummary({
  kcal,
  proteinG,
  carbG,
  fatG,
}: {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}) {
  const figures = [
    { label: "kcal", value: nfKcal.format(kcal), unit: "" },
    { label: "Proteínas", value: nfMacro.format(proteinG), unit: " g" },
    { label: "Carbohidratos", value: nfMacro.format(carbG), unit: " g" },
    { label: "Grasas", value: nfMacro.format(fatG), unit: " g" },
  ];
  return (
    <dl className="grid grid-cols-4 gap-2 text-center">
      {figures.map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-muted-foreground text-[0.7rem] break-words">{f.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {f.value}
            {f.unit}
          </dd>
        </div>
      ))}
    </dl>
  );
}
