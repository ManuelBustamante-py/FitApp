"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { shouldWriteSchedule } from "@/lib/profile/level";
import { parseProfileForm, type FieldErrors } from "@/lib/profile/schema";
import { toGoalRow, toProfileRow } from "@/lib/profile/transform";

export type ProfileFormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: FieldErrors };

const SAVE_ERROR: ProfileFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

/** Crea o actualiza el perfil, la meta activa y la semana tipo del usuario con sesión. */
export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = parseProfileForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const values = parsed.data;

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("profile")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingError) return SAVE_ERROR;
  const isNew = !existing;

  const { error: profileError } = await supabase.from("profile").upsert(
    {
      user_id: user.id,
      ...toProfileRow(values),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (profileError) return SAVE_ERROR;

  const goalRow = toGoalRow(values);
  const { data: activeGoal, error: goalReadError } = await supabase
    .from("goal")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (goalReadError) return SAVE_ERROR;
  const { error: goalError } = activeGoal
    ? await supabase.from("goal").update(goalRow).eq("id", activeGoal.id)
    : await supabase.from("goal").insert({ user_id: user.id, ...goalRow, active: true });
  if (goalError) return SAVE_ERROR;

  const { data: schedule, error: scheduleReadError } = await supabase
    .from("activity_schedule")
    .select("mode, level")
    .eq("user_id", user.id);
  if (scheduleReadError) return SAVE_ERROR;
  if (shouldWriteSchedule(schedule ?? [], values.activityLevel)) {
    const { error: scheduleError } = await supabase.from("activity_schedule").upsert(
      Array.from({ length: 7 }, (_, i) => ({
        user_id: user.id,
        weekday: i + 1,
        mode: "level",
        level: values.activityLevel,
        custom_factor: null,
        steps_target: null,
      })),
      { onConflict: "user_id,weekday" },
    );
    if (scheduleError) return SAVE_ERROR;
  }

  revalidatePath("/", "layout");
  if (isNew) redirect("/");
  return { status: "saved" };
}
