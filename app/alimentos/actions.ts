"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getCurrentUser } from "@/lib/db/server";
import { parseCustomFoodForm, type CustomFoodFieldErrors } from "@/lib/food/custom";

export type CustomFoodFormState =
  | { status: "idle" }
  | { status: "error"; message?: string; errors?: CustomFoodFieldErrors };

const SAVE_ERROR: CustomFoodFormState = {
  status: "error",
  message: "No se pudo guardar. Inténtalo de nuevo.",
};

/**
 * Crea un alimento personalizado (RF-19) privado del usuario: `owner_user_id` = usuario y
 * `source` = 'user'. Los nutrientes quedan por 100 g/ml y, si se indicó, también la porción.
 * Si falla un paso posterior se borra el alimento (los nutrientes caen en cascada).
 */
export async function createCustomFood(
  _prev: CustomFoodFormState,
  formData: FormData,
): Promise<CustomFoodFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = parseCustomFoodForm(formData);
  if (!parsed.success) return { status: "error", errors: parsed.errors };
  const values = parsed.data;

  const supabase = await createClient();
  const codes = Object.keys(values.nutrients);
  const { data: catalog, error: catalogError } = await supabase
    .from("nutrient")
    .select("id, code")
    .in("code", codes);
  if (catalogError || catalog.length !== codes.length) return SAVE_ERROR;

  const { data: food, error: foodError } = await supabase
    .from("food")
    .insert({
      name_es: values.name,
      brand: values.brand,
      basis: values.basis,
      source: "user",
      owner_user_id: user.id,
    })
    .select("id")
    .single();
  if (foodError) return SAVE_ERROR;

  const rollback = async () => {
    await supabase.from("food").delete().eq("id", food.id);
    return SAVE_ERROR;
  };

  const { error: nutrientError } = await supabase.from("food_nutrient").insert(
    catalog.map((n) => ({
      food_id: food.id,
      nutrient_id: n.id,
      amount_per_100: values.nutrients[n.code],
    })),
  );
  if (nutrientError) return rollback();

  if (values.portionSize !== null) {
    const unit = values.basis === "per_100ml" ? "ml" : "g";
    const { error: portionError } = await supabase.from("food_portion").insert({
      food_id: food.id,
      label_es: `Porción (${values.portionSize} ${unit})`.replace(".", ","),
      // Sin densidad informada se asume 1 g/ml (docs/03 §5).
      grams: values.portionSize,
    });
    if (portionError) return rollback();
  }

  revalidatePath("/alimentos");
  redirect(`/alimentos/${food.id}`);
}
