import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/db/server";
import { getProfileBundle } from "@/lib/profile/queries";

/** Redirige al onboarding si el usuario con sesión aún no tiene perfil. */
export async function ProfileGate() {
  const user = await getCurrentUser();
  if (user && !(await getProfileBundle(user.id))) redirect("/onboarding");
  return null;
}
