import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/db/server";
import { ODBL_URL } from "@/lib/food/attribution";

export const metadata: Metadata = { title: "Fuentes y créditos" };

async function SourceList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_source")
    .select("source, name, license, attribution, url")
    .order("name");
  if (error) throw new Error("No se pudieron leer las fuentes de datos.");

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No hay fuentes registradas.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {data.map((s) => (
        <li key={s.source}>
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                <h2>{s.name}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>{s.attribution}</p>
              <p className="text-muted-foreground">Licencia: {s.license}</p>
              {s.url && (
                <a
                  href={s.url}
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sitio de {s.name}
                </a>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function SourcesPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/perfil"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Perfil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Fuentes y créditos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Los datos nutricionales provienen de las siguientes fuentes.
        </p>
      </div>
      <Suspense>
        <SourceList />
      </Suspense>
      <p className="text-muted-foreground text-xs">
        Los datos de Open Food Facts se redistribuyen bajo la{" "}
        <a
          href={ODBL_URL}
          className="underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          licencia Open Database License (ODbL) 1.0
        </a>
        .
      </p>
    </main>
  );
}
