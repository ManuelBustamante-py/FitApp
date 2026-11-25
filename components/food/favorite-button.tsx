import { Star } from "lucide-react";

import { toggleFavorite } from "@/app/comidas/atajos-actions";

/** Estrella para marcar o desmarcar un alimento como favorito (RF-22). */
export function FavoriteButton({
  foodId,
  foodName,
  isFavorite,
}: {
  foodId: string;
  foodName: string;
  isFavorite: boolean;
}) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="foodId" value={foodId} />
      <input type="hidden" name="favorite" value={isFavorite ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        aria-label={
          isFavorite
            ? `Quitar ${foodName} de favoritos`
            : `Marcar ${foodName} como favorito`
        }
        className="hover:bg-muted flex size-9 items-center justify-center rounded-lg"
      >
        <Star
          className={
            isFavorite
              ? "size-5 fill-amber-400 text-amber-500"
              : "text-muted-foreground size-5"
          }
          aria-hidden
        />
      </button>
    </form>
  );
}
