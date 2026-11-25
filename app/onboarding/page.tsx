import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUser } from "@/lib/db/server";
import { isLatamCountry, normalizeCountry, proposeCountry } from "@/lib/profile/country";
import { getIpCountry } from "@/lib/profile/country-queries";
import { getProfileBundle } from "@/lib/profile/queries";
import { listTimeZones } from "@/lib/profile/timezones";

export const metadata: Metadata = { title: "Bienvenida" };

async function OnboardingContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await getProfileBundle(user.id)) redirect("/perfil");
  const ipCountry = normalizeCountry(await getIpCountry());

  return (
    <ProfileForm
      mode="onboarding"
      timezones={listTimeZones()}
      countryFromIp={isLatamCountry(ipCountry)}
      defaults={{
        sex: "",
        birthDate: "",
        heightCm: "",
        timezone: "America/Santiago",
        country: proposeCountry({ ipCountry, timezone: "America/Santiago" }),
        activityLevel: "sedentary",
        goalType: "weight",
        targetWeightKg: "",
        targetBmi: "",
        goalDirection: "lose",
        weeklyRateKg: "0.5",
      }}
    />
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cuéntanos de ti</h1>
        <p className="text-muted-foreground text-sm">
          Con estos datos calculamos tu gasto diario y tu meta. Puedes cambiarlos cuando
          quieras.
        </p>
      </div>
      <Suspense>
        <OnboardingContent />
      </Suspense>
    </main>
  );
}
