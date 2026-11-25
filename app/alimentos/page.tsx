import { ArrowLeft, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ResultadoAlimento } from "@/components/food/resultado-alimento";
import { QuickAddRow } from "@/components/meal/quick-add-row";
import { getCurrentUser } from "@/lib/db/server";
import { cleanQuery, isSearchable, MAX_QUERY_LENGTH } from "@/lib/food/search";
import { searchFoods } from "@/lib/food/search-queries";
import { defaultMealType, hourIn } from "@/lib/meal/meal-types";
import { listFavoriteIds, listQuickFoods } from "@/lib/meal/shortcuts-queries";
import { getProfileBundle } from "@/lib/profile/queries";
import { todayIn } from "@/lib/weight/entries";

export const metadata: Metadata = { title: "Alimentos" };

type SearchParams = Promise<{ q?: string | string[] }>;

/** Favoritos y recientes para agregar de un toque (RF-22), antes de buscar. */
async function Shortcuts({ userId }: { userId: string }) {
  const [bundle, { favorites, recents }] = await Promise.all([
    getProfileBundle(userId),
    listQuickFoods(userId),
  ]);
  const timezone = bundle?.profile.timezone ?? "UTC";
  const today = todayIn(timezone);
  const mealType = defaultMealType(hourIn(timezone));
  const favoriteIds = new Set(favorites.map((f) => f.foodId));
  const recentOnly = recents.filter((r) => !favoriteIds.has(r.foodId));

  return (
    <>
      <p className="text-muted-foreground text-sm">
        Escribe el nombre de un alimento, una marca o un código de barras para buscarlo.
      </p>
      {favorites.length > 0 ? (
        <section aria-labelledby="favoritos" className="flex flex-col gap-2">
          <h2 id="favoritos" className="text-base font-semibold">
            Favoritos
          </h2>
          <ul className="divide-y rounded-lg border">
            {favorites.map((food) => (
              <QuickAddRow
                key={food.foodId}
                food={food}
                today={today}
                defaultMealType={mealType}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {recentOnly.length > 0 ? (
        <section aria-labelledby="recientes" className="flex flex-col gap-2">
          <h2 id="recientes" className="text-base font-semibold">
            Recientes
          </h2>
          <ul className="divide-y rounded-lg border">
            {recentOnly.map((food) => (
              <QuickAddRow
                key={food.foodId}
                food={food}
                today={today}
                defaultMealType={mealType}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {favorites.length === 0 && recentOnly.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aquí verás tus favoritos y los alimentos que registraste hace poco, para
          agregarlos con un toque. Marca un alimento con la estrella para guardarlo como
          favorito.
        </p>
      ) : null}
    </>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q: rawQ } = await searchParams;
  const q = cleanQuery(Array.isArray(rawQ) ? (rawQ[0] ?? "") : (rawQ ?? ""));

  if (q === "") return <Shortcuts userId={user.id} />;
  if (!isSearchable(q)) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Escribe al menos 2 caracteres.
      </p>
    );
  }

  const [foods, favoriteIds] = await Promise.all([
    searchFoods(q),
    listFavoriteIds(user.id),
  ]);
  if (foods.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        No encontramos alimentos para «{q}». Prueba con otro nombre o revisa la
        ortografía, o{" "}
        <Link
          href="/alimentos/nuevo"
          className="text-foreground underline underline-offset-2"
        >
          crea el alimento
        </Link>{" "}
        desde su etiqueta.
      </p>
    );
  }
  return (
    <section aria-labelledby="resultados" className="flex flex-col gap-2">
      <h2 id="resultados" className="text-base font-semibold">
        Resultados
        <span className="text-muted-foreground text-sm font-normal">
          {" "}
          · {foods.length}
        </span>
      </h2>
      <ul className="divide-y rounded-lg border">
        {foods.map((food) => (
          <ResultadoAlimento
            key={food.id}
            food={food}
            isFavorite={favoriteIds.has(food.id)}
          />
        ))}
      </ul>
    </section>
  );
}

export default function AlimentosPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Buscar alimentos</h1>
      </div>
      <form action="/alimentos" method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar alimento, marca o código de barras
        </label>
        <input
          id="q"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Ej.: palta, yogur, 7802900…"
          className="border-input bg-background h-10 min-w-0 flex-1 rounded-lg border px-3 text-base"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-1 rounded-lg px-4 text-sm font-medium"
        >
          <Search className="size-4" aria-hidden /> Buscar
        </button>
      </form>
      <Link
        href="/alimentos/nuevo"
        className="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      >
        <Plus className="size-4" aria-hidden /> Crear alimento
      </Link>
      <Link
        href="/recetas"
        className="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      >
        <Plus className="size-4" aria-hidden /> Mis recetas
      </Link>
      <Suspense>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
