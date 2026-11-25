import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { RecipeForm } from "@/components/recipe/recipe-form";
import { getCurrentUser } from "@/lib/db/server";
import { getRecipe } from "@/lib/recipe/queries";

import { updateRecipe } from "../actions";

export const metadata: Metadata = { title: "Editar receta" };

type Params = Promise<{ id: string }>;

const num = (value: number) => String(value).replace(".", ",");

async function Form({ params }: { params: Params }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  return (
    <RecipeForm
      action={updateRecipe.bind(null, recipe.id)}
      submitLabel="Guardar cambios"
      initial={{
        name: recipe.name,
        cookedWeight: num(recipe.cookedWeightG),
        servings: recipe.servings === null ? "" : num(recipe.servings),
        ingredients: recipe.ingredients.map((i) => ({
          foodId: i.foodId,
          name: i.name,
          brand: i.brand,
          grams: num(i.grams),
        })),
      }}
    />
  );
}

export default function EditarRecetaPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/recetas"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Mis recetas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar receta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Los registros de comida ya guardados no cambian.
        </p>
      </div>
      <Suspense>
        <Form params={params} />
      </Suspense>
    </main>
  );
}
