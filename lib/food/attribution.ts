/** Enlaces fijos de atribución (ODbL exige citar la licencia y la fuente). */
export const ODBL_URL = "https://opendatacommons.org/licenses/odbl/1-0/";
export const OFF_URL = "https://world.openfoodfacts.org";
export const CREDITS_PATH = "/fuentes";

export type FoodSourceInfo = {
  /** Texto corto para mostrar junto al alimento. */
  label: string;
  /** Texto de atribución legal (refleja public.data_source). */
  attribution: string;
  /** Si es true se muestran los enlaces a Open Food Facts y a la licencia ODbL. */
  odbl: boolean;
};

const SOURCES: Record<string, FoodSourceInfo> = {
  off: {
    label: "Open Food Facts",
    attribution:
      "Contiene información de Open Food Facts, disponible bajo la Open Database License (ODbL).",
    odbl: true,
  },
  usda_fdc: {
    label: "USDA FoodData Central",
    attribution: "Datos de USDA FoodData Central (dominio público, CC0).",
    odbl: false,
  },
  usda_fndds: {
    label: "USDA FoodData Central (FNDDS)",
    attribution: "Datos de USDA FoodData Central (FNDDS, dominio público, CC0).",
    odbl: false,
  },
  user: {
    label: "Alimento personalizado",
    attribution: "Creado por el usuario.",
    odbl: false,
  },
  recipe: {
    label: "Receta propia",
    attribution: "Receta creada por el usuario.",
    odbl: false,
  },
};

/** Información de atribución de un `food.source`; null si la fuente no se conoce. */
export function getSourceInfo(source: string): FoodSourceInfo | null {
  return Object.hasOwn(SOURCES, source) ? SOURCES[source] : null;
}
