import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { RecipeForm } from "@/components/recipe/recipe-form";
import { getCurrentUser } from "@/lib/db/server";

import { createRecipe } from "../actions";

export const metadata: Metadata = { title: "Crear receta" };

async function Form() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <RecipeForm action={createRecipe} submitLabel="Crear receta" />;
}

export default function NuevaRecetaPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/recetas"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Mis recetas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Crear receta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Agrega los ingredientes con sus gramos e indica el peso final cocido: los
          valores por 100 g se calculan solos. La receta será solo tuya.
        </p>
      </div>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
