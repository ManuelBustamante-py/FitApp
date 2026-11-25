import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ScanPanel } from "@/components/food/scan-panel";
import { getCurrentUser } from "@/lib/db/server";
import { isValidBarcode, normalizeBarcode } from "@/lib/food/barcode";
import { findFoodByBarcode } from "@/lib/food/barcode-queries";
import { getUserCountry } from "@/lib/profile/country-queries";

export const metadata: Metadata = { title: "Escanear código de barras" };

type SearchParams = Promise<{ codigo?: string | string[] }>;

async function Escaneo({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { codigo } = await searchParams;
  const raw = normalizeBarcode(
    Array.isArray(codigo) ? (codigo[0] ?? "") : (codigo ?? ""),
  );

  if (raw === "") return <ScanPanel />;
  if (!isValidBarcode(raw)) return <ScanPanel key={raw} initialError />;

  const foodId = await findFoodByBarcode(raw, user.id, await getUserCountry(user.id));
  if (foodId) redirect(`/alimentos/${foodId}`);

  return (
    <div className="flex flex-col gap-5">
      <section
        className="flex flex-col gap-3 rounded-lg border p-4"
        aria-labelledby="sin-resultado"
      >
        <h2 id="sin-resultado" className="text-base font-semibold">
          No encontramos este producto
        </h2>
        <p className="text-muted-foreground text-sm">
          El código <span className="text-foreground tabular-nums">{raw}</span> no está en
          nuestra base. Puedes crearlo con los datos de su etiqueta; quedará guardado con
          este código solo para ti.
        </p>
        <Link
          href={`/alimentos/nuevo?codigo=${raw}`}
          className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
        >
          <Plus className="size-4" aria-hidden /> Crear alimento con este código
        </Link>
      </section>
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Escanear otro</h2>
        <ScanPanel />
      </div>
    </div>
  );
}

export default function EscanearPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/alimentos"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Buscar alimentos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Escanear código</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Los productos vienen de Open Food Facts (ODbL); ver{" "}
          <Link href="/fuentes" className="underline underline-offset-2">
            fuentes y licencias
          </Link>
          .
        </p>
      </div>
      <Suspense>
        <Escaneo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
