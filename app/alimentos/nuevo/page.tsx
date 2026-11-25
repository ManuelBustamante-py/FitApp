import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomFoodForm } from "@/components/food/custom-food-form";
import { getCurrentUser } from "@/lib/db/server";

export const metadata: Metadata = { title: "Crear alimento" };

async function Form() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <CustomFoodForm />;
}

export default function NuevoAlimentoPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/alimentos"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Buscar alimentos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Crear alimento</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Copia los valores de la etiqueta nutricional. El alimento será solo tuyo.
        </p>
      </div>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
