import Link from "next/link";

import { basisLabel } from "@/lib/food/search";
import type { FoodSearchResult } from "@/lib/food/search-queries";

import { FavoriteButton } from "./favorite-button";
import { FuenteAlimento } from "./fuente-alimento";

const nfKcal = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });

/**
 * Un resultado de la búsqueda: nombre, marca, categoría, kcal y atribución. El nombre
 * enlaza al registro del alimento en una comida (#16).
 */
export function ResultadoAlimento({
  food,
  isFavorite = false,
}: {
  food: FoodSearchResult;
  isFavorite?: boolean;
}) {
  const details = [food.brand, food.category].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-1 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium break-words">
          <Link
            href={`/alimentos/${food.id}`}
            className="underline-offset-2 hover:underline"
            aria-label={`Registrar ${food.name_es}`}
          >
            {food.name_es}
          </Link>
        </p>
        <div className="flex shrink-0 items-start gap-1">
          <p className="text-right text-sm tabular-nums">
            {food.kcal_per_100 === null ? (
              <span className="text-muted-foreground">Sin dato</span>
            ) : (
              <>
                <span className="font-semibold">{nfKcal.format(food.kcal_per_100)}</span>{" "}
                kcal
              </>
            )}
            <span className="text-muted-foreground block text-xs">
              por {basisLabel(food.basis)}
            </span>
          </p>
          <FavoriteButton
            foodId={food.id}
            foodName={food.name_es}
            isFavorite={isFavorite}
          />
        </div>
      </div>
      {details && <p className="text-muted-foreground text-xs">{details}</p>}
      <FuenteAlimento source={food.source} />
    </li>
  );
}
