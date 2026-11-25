import { ArrowLeft, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ResultadoAlimento } from "@/components/food/resultado-alimento";
import { getCurrentUser } from "@/lib/db/server";
import { cleanQuery, isSearchable, MAX_QUERY_LENGTH } from "@/lib/food/search";
import { searchFoods } from "@/lib/food/search-queries";

export const metadata: Metadata = { title: "Alimentos" };

type SearchParams = Promise<{ q?: string | string[] }>;

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q: rawQ } = await searchParams;
  const q = cleanQuery(Array.isArray(rawQ) ? (rawQ[0] ?? "") : (rawQ ?? ""));

  if (q === "") {
    return (
      <p className="text-muted-foreground text-sm">
        Escribe el nombre de un alimento, una marca o un código de barras para buscarlo.
      </p>
    );
  }
  if (!isSearchable(q)) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Escribe al menos 2 caracteres.
      </p>
    );
  }

  const foods = await searchFoods(q);
  if (foods.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        No encontramos alimentos para «{q}». Prueba con otro nombre o revisa la
        ortografía.
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
          <ResultadoAlimento key={food.id} food={food} />
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
      <Suspense>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
