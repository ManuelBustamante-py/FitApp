import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUser } from "@/lib/db/server";
import { proposeCountry } from "@/lib/profile/country";
import { getIpCountry } from "@/lib/profile/country-queries";
import { getProfileBundle } from "@/lib/profile/queries";
import { listTimeZones } from "@/lib/profile/timezones";
import { toFormDefaults } from "@/lib/profile/transform";

export const metadata: Metadata = { title: "Perfil y meta" };

async function ProfileContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const bundle = await getProfileBundle(user.id);
  if (!bundle) redirect("/onboarding");
  const { country, timezone } = bundle.profile;
  const proposedCountry = country
    ? country
    : proposeCountry({ ipCountry: await getIpCountry(), timezone });

  return (
    <ProfileForm
      mode="edit"
      timezones={listTimeZones()}
      defaults={toFormDefaults({
        sex: bundle.profile.sex,
        birth_date: bundle.profile.birth_date,
        height_cm: bundle.profile.height_cm,
        timezone,
        country,
        proposedCountry,
        level: bundle.level,
        goal: bundle.goal,
      })}
    />
  );
}

export default function ProfilePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil y meta</h1>
      </div>
      <Suspense>
        <ProfileContent />
      </Suspense>
      <Link
        href="/actividad"
        className="hover:bg-muted rounded-lg border px-3 py-3 text-sm font-medium"
      >
        TMB y actividad cotidiana
        <span className="text-muted-foreground block text-xs font-normal">
          Fórmula de TMB, semana tipo y ajustes por fecha
        </span>
      </Link>
      <Link
        href="/cuenta/contrasena"
        className="hover:bg-muted rounded-lg border px-3 py-3 text-sm font-medium"
      >
        Contraseña
        <span className="text-muted-foreground block text-xs font-normal">
          Define o cambia la contraseña para entrar sin enlace
        </span>
      </Link>
      <Link
        href="/fuentes"
        className="hover:bg-muted rounded-lg border px-3 py-3 text-sm font-medium"
      >
        Fuentes y créditos
        <span className="text-muted-foreground block text-xs font-normal">
          Origen y licencias de los datos de alimentos
        </span>
      </Link>
    </main>
  );
}
