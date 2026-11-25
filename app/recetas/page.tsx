import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/db/server";
import { listRecipes } from "@/lib/recipe/queries";

export const metadata: Metadata = { title: "Recetas" };

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

async function RecipeList() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const recipes = await listRecipes();
  if (recipes.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        Aún no tienes recetas. Crea una con sus ingredientes y el peso final cocido para
        registrarla después como un solo alimento.
      </p>
    );
  return (
    <ul className="divide-y rounded-lg border">
      {recipes.map((recipe) => (
        <li key={recipe.id} className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <Link
              href={`/alimentos/${recipe.foodId}`}
              className="text-sm font-medium break-words underline-offset-2 hover:underline"
            >
              {recipe.name}
            </Link>
            <p className="text-muted-foreground text-xs">
              {nf.format(recipe.cookedWeightG)} g cocido
              {recipe.servings !== null
                ? ` · ${nf.format(recipe.servings)} porciones`
                : ""}
            </p>
          </div>
          <Link
            href={`/recetas/${recipe.id}`}
            className="text-primary shrink-0 text-sm font-medium"
          >
            Editar
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function RecetasPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/alimentos"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Buscar alimentos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Mis recetas</h1>
      </div>
      <Link
        href="/recetas/nueva"
        className="text-primary inline-flex items-center gap-1 self-start text-sm font-medium"
      >
        <Plus className="size-4" aria-hidden /> Crear receta
      </Link>
      <Suspense>
        <RecipeList />
      </Suspense>
    </main>
  );
}
