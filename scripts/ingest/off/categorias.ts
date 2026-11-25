/**
 * Mapeo de categorías de Open Food Facts (OFF) a las categorías en español de
 * Chile que ya usa USDA (`usda/categorias.ts`), para que la búsqueda y los filtros
 * por categoría traten igual a los productos envasados y a los alimentos USDA.
 *
 * - La clave es la etiqueta de `categories_tags` sin el prefijo de idioma
 *   (`en:`, `es:`…), en minúsculas, sin tildes y con espacios convertidos en
 *   guiones (`normalizarEtiqueta`). El valor es la CLAVE en inglés de `CATEGORIAS_WWEIA`; así el
 *   texto en español sale siempre de una sola fuente y no se puede desviar
 *   (`categorias.test.ts` falla si una clave no existe en USDA).
 * - `categories_tags` va de lo general a lo específico: se elige la etiqueta más
 *   específica que tenga mapeo. Si el producto trae `main_category`, se prueba antes.
 * - Sin coincidencia → "Sin categoría" (igual que USDA), nunca null.
 * - Etiquetas genéricas de OFF (`beverages`, `snacks`, `plant-based-foods`,
 *   `dairies`…) se dejan sin mapear a propósito: agruparían mal. Salen en el
 *   informe de cobertura si el producto no tiene otra etiqueta con mapeo.
 * - Etiquetas en español (`es:yogures`, `galletas`…): muchos productos chilenos
 *   no están taxonomizados en inglés y solo traen la etiqueta en español. Van al
 *   final, en un bloque aparte, y apuntan a la misma clave WWEIA que su par en inglés.
 * - No se inventan categorías nuevas: todas son valores de `CATEGORIAS_WWEIA`.
 *   Las equivalencias aproximadas llevan "aprox.". Los cereales de desayuno
 *   se reparten por azúcar según el nombre de la etiqueta; el resto va a
 *   "alto en azúcar" (lo más habitual en el mercado chileno), aprox.
 */

import { CATEGORIAS_WWEIA } from "../usda/categorias.ts";

export const SIN_CATEGORIA = "Sin categoría";

const CEREAL_ALTO = "Ready-to-eat cereal, higher sugar (>21.2g/100g)";
const CEREAL_BAJO = "Ready-to-eat cereal, lower sugar (=<21.2g/100g)";

/** Etiqueta OFF (sin prefijo de idioma) → clave de CATEGORIAS_WWEIA. */
export const MAPEO_CATEGORIAS_OFF: Record<string, string> = {
  // Lácteos
  milks: "Milk, whole", // aprox.: no distingue el contenido graso
  "whole-milks": "Milk, whole",
  "semi-skimmed-milks": "Milk, reduced fat",
  "skimmed-milks": "Milk, nonfat",
  "flavoured-milks": "Flavored milk, whole", // aprox.
  "chocolate-milks": "Flavored milk, whole", // aprox.
  milkshakes: "Milk shakes and other dairy drinks",
  "dairy-drinks": "Milk shakes and other dairy drinks",
  cheeses: "Cheese",
  "fresh-cheeses": "Cheese",
  "cottage-cheeses": "Cottage/ricotta cheese",
  ricottas: "Cottage/ricotta cheese",
  "cream-cheeses": "Cream cheese, sour cream, whipped cream",
  yogurts: "Yogurt, regular",
  "greek-yogurts": "Yogurt, Greek",
  "plant-based-milks": "Plant-based milk",
  "plant-based-yogurts": "Plant-based yogurt",
  "soy-milks": "Plant-based milk",
  "almond-milks": "Plant-based milk",
  "oat-milks": "Plant-based milk",
  creams: "Cream and cream substitutes",
  "sour-creams": "Cream cheese, sour cream, whipped cream",
  butters: "Butter and animal fats",
  margarines: "Margarine",
  puddings: "Pudding",
  "dairy-desserts": "Pudding", // aprox.
  "ice-creams": "Ice cream and frozen dairy desserts",
  "ice-creams-and-sorbets": "Ice cream and frozen dairy desserts",
  sorbets: "Gelatins, ices, sorbets",
  gelatins: "Gelatins, ices, sorbets",

  // Bebidas
  sodas: "Soft drinks",
  "carbonated-drinks": "Soft drinks",
  colas: "Soft drinks",
  "sweetened-beverages": "Fruit drinks", // aprox.
  "artificially-sweetened-beverages": "Diet soft drinks", // aprox.
  "diet-sodas": "Diet soft drinks",
  "fruit-based-beverages": "Fruit drinks",
  "fruit-nectars": "Fruit drinks",
  "fruit-juices": "Other fruit juice",
  "orange-juices": "Citrus juice",
  "citrus-juices": "Citrus juice",
  "apple-juices": "Apple juice",
  "vegetable-juices": "Vegetable juice",
  "energy-drinks": "Sport and energy drinks",
  "sports-drinks": "Sport and energy drinks",
  waters: "Bottled water",
  "spring-waters": "Bottled water",
  "mineral-waters": "Bottled water",
  "flavored-waters": "Flavored or carbonated water",
  "flavoured-waters": "Flavored or carbonated water",
  "carbonated-waters": "Flavored or carbonated water",
  coffees: "Coffee",
  "instant-coffees": "Coffee",
  teas: "Tea",
  "tea-bags": "Tea",
  "iced-teas": "Tea", // aprox.
  beers: "Beer",
  wines: "Wine",
  "red-wines": "Wine",
  "white-wines": "Wine",
  spirits: "Liquor and cocktails",
  "alcoholic-beverages": "Liquor and cocktails", // aprox.
  "meal-replacement": "Protein and nutritional powders", // aprox.
  "protein-powders": "Protein and nutritional powders",
  "dietary-supplements": "Protein and nutritional powders", // aprox.

  // Carnes, pescados y huevos
  beef: "Beef, excludes ground",
  "ground-beef": "Ground beef",
  pork: "Pork",
  lamb: "Lamb, goat, game",
  livers: "Liver and organ meats",
  chickens: "Chicken, whole pieces",
  "chicken-breasts": "Chicken, whole pieces",
  "chicken-nuggets": "Chicken patties, nuggets and tenders",
  turkeys: "Turkey, duck, other poultry",
  poultry: "Turkey, duck, other poultry", // aprox.
  fishes: "Fish",
  salmons: "Fish",
  tunas: "Fish",
  "canned-fishes": "Fish",
  "canned-tunas": "Fish",
  sardines: "Fish",
  seafood: "Shellfish", // aprox.
  shellfish: "Shellfish",
  shrimps: "Shellfish",
  "canned-seafood": "Shellfish", // aprox.
  eggs: "Eggs and omelets",
  "chicken-eggs": "Eggs and omelets",
  "cured-meats": "Cold cuts and cured meats",
  "cold-cuts": "Cold cuts and cured meats",
  hams: "Cold cuts and cured meats",
  "cooked-hams": "Cold cuts and cured meats",
  "dry-sausages": "Sausages",
  salamis: "Cold cuts and cured meats",
  pates: "Cold cuts and cured meats", // aprox.
  bacons: "Bacon",
  sausages: "Sausages",
  frankfurters: "Frankfurters",
  "hot-dogs": "Frankfurters",
  "meat-based-products": "Cold cuts and cured meats", // aprox.
  "meat-analogues": "Soy and meat-alternative products",
  "meatless-burgers": "Vegetable sandwiches/burgers", // aprox.
  burgers: "Burgers",
  hamburgers: "Burgers",

  // Legumbres, frutos secos, frutas y verduras
  legumes: "Beans, peas, legumes",
  "canned-legumes": "Beans, peas, legumes",
  beans: "Beans, peas, legumes",
  lentils: "Beans, peas, legumes",
  chickpeas: "Beans, peas, legumes",
  nuts: "Nuts and seeds",
  seeds: "Nuts and seeds",
  peanuts: "Nuts and seeds",
  almonds: "Nuts and seeds",
  walnuts: "Nuts and seeds",
  "dried-fruits": "Dried fruits",
  raisins: "Dried fruits",
  fruits: "Other fruits and fruit salads", // aprox.
  "fruit-salads": "Other fruits and fruit salads",
  "canned-fruits": "Other fruits and fruit salads", // aprox.
  apples: "Apples",
  bananas: "Bananas",
  grapes: "Grapes",
  peaches: "Peaches and nectarines",
  strawberries: "Strawberries",
  berries: "Blueberries and other berries",
  citrus: "Citrus fruits",
  oranges: "Citrus fruits",
  lemons: "Citrus fruits",
  pears: "Pears",
  pineapples: "Pineapple",
  mangos: "Mango and papaya",
  vegetables: "Other vegetables and combinations", // aprox.
  "canned-vegetables": "Other vegetables and combinations", // aprox.
  tomatoes: "Tomatoes",
  carrots: "Carrots",
  "green-beans": "String beans",
  "sweet-corn": "Corn",
  "canned-corn": "Corn",
  corn: "Corn",
  potatoes: "White potatoes, baked or boiled",
  "mashed-potatoes": "Mashed potatoes and white potato mixtures",
  "french-fries": "French fries and other fried white potatoes",
  "frozen-french-fries": "French fries and other fried white potatoes",
  pickles: "Olives, pickles, pickled vegetables",
  olives: "Olives, pickles, pickled vegetables",
  "pickled-vegetables": "Olives, pickles, pickled vegetables",

  // Cereales, panes, pastas y arroz
  breads: "Yeast breads",
  "sliced-breads": "Yeast breads",
  "sandwich-breads": "Yeast breads",
  "wheat-breads": "Yeast breads",
  "whole-wheat-breads": "Yeast breads",
  buns: "Rolls and buns",
  "bread-rolls": "Rolls and buns",
  "hamburger-buns": "Rolls and buns",
  bagels: "Bagels and English muffins",
  tortillas: "Tortillas",
  "wheat-tortillas": "Tortillas",
  muffins: "Biscuits, muffins, quick breads",
  pancakes: "Pancakes, waffles, French toast",
  waffles: "Pancakes, waffles, French toast",
  "breakfast-cereals": CEREAL_ALTO, // aprox.
  "extruded-cereals": CEREAL_ALTO, // aprox.
  "chocolate-cereals": CEREAL_ALTO,
  "sugared-cereals": CEREAL_ALTO,
  "cereals-with-honey": CEREAL_ALTO,
  "unsweetened-cereals": CEREAL_BAJO,
  "corn-flakes": CEREAL_BAJO,
  muesli: CEREAL_BAJO, // aprox.
  granola: CEREAL_BAJO, // aprox.
  oatmeals: "Oatmeal",
  "rolled-oats": "Oatmeal",
  "oat-flakes": "Oatmeal",
  oats: "Oatmeal",
  rices: "Rice",
  "white-rices": "Rice",
  "long-grain-rices": "Rice",
  pastas: "Pasta, noodles, cooked grains",
  "dry-pastas": "Pasta, noodles, cooked grains",
  spaghetti: "Pasta, noodles, cooked grains",
  noodles: "Pasta, noodles, cooked grains",
  "instant-noodles": "Ramen and Asian broth-based soups", // aprox.
  couscous: "Pasta, noodles, cooked grains",
  quinoas: "Pasta, noodles, cooked grains", // aprox.
  "cereal-bars": "Cereal bars",
  "granola-bars": "Cereal bars",
  "protein-bars": "Nutrition bars",
  "energy-bars": "Nutrition bars",

  // Snacks y galletas
  "potato-chips": "Potato chips",
  crisps: "Potato chips",
  "salty-snacks": "Pretzels/snack mix", // aprox.
  "corn-chips": "Tortilla, corn, other chips",
  "tortilla-chips": "Tortilla, corn, other chips",
  popcorn: "Popcorn",
  pretzels: "Pretzels/snack mix",
  crackers: "Crackers, excludes saltines",
  "salted-crackers": "Saltine crackers",
  "saltine-crackers": "Saltine crackers",
  "rice-cakes": "Crackers, excludes saltines", // aprox.
  biscuits: "Cookies and brownies",
  cookies: "Cookies and brownies",
  "sweet-biscuits": "Cookies and brownies",
  "chocolate-biscuits": "Cookies and brownies",
  "shortbread-cookies": "Cookies and brownies",
  "sandwich-cookies": "Cookies and brownies",
  wafers: "Cookies and brownies", // aprox.
  brownies: "Cookies and brownies",
  cakes: "Cakes and pies",
  "sponge-cakes": "Cakes and pies",
  pies: "Cakes and pies",
  pastries: "Doughnuts, sweet rolls, pastries",
  viennoiseries: "Doughnuts, sweet rolls, pastries",
  croissants: "Doughnuts, sweet rolls, pastries",
  doughnuts: "Doughnuts, sweet rolls, pastries",

  // Dulces y untables
  chocolates: "Candy containing chocolate",
  "milk-chocolates": "Candy containing chocolate",
  "dark-chocolates": "Candy containing chocolate",
  "chocolate-bars": "Candy containing chocolate",
  "chocolate-candies": "Candy containing chocolate",
  "filled-chocolates": "Candy containing chocolate",
  "cocoa-and-hazelnuts-spreads": "Jams, syrups, toppings", // aprox.
  confectioneries: "Candy not containing chocolate", // aprox.
  candies: "Candy not containing chocolate",
  "hard-candies": "Candy not containing chocolate",
  "gummi-candies": "Candy not containing chocolate",
  jellies: "Candy not containing chocolate", // aprox.
  "chewing-gum": "Candy not containing chocolate",
  lollipops: "Candy not containing chocolate",
  sugars: "Sugars and honey",
  honeys: "Sugars and honey",
  sweeteners: "Sugar substitutes",
  jams: "Jams, syrups, toppings",
  "fruit-jams": "Jams, syrups, toppings",
  marmalades: "Jams, syrups, toppings",
  "fruit-spreads": "Jams, syrups, toppings",
  syrups: "Jams, syrups, toppings",
  "dulce-de-leche": "Jams, syrups, toppings", // aprox.
  "peanut-butters": "Jams, syrups, toppings", // aprox.: USDA no tiene categoría propia

  // Salsas, condimentos, aceites y sopas
  ketchup: "Tomato-based condiments",
  "tomato-ketchup": "Tomato-based condiments",
  "tomato-sauces": "Pasta sauces, tomato-based",
  "pasta-sauces": "Pasta sauces, tomato-based",
  "tomato-pastes": "Tomato-based condiments",
  "tomato-purees": "Tomato-based condiments",
  "soy-sauces": "Soy-based condiments",
  mustards: "Mustard and other condiments",
  condiments: "Mustard and other condiments", // aprox.
  "hot-sauces": "Dips, gravies, other sauces",
  sauces: "Dips, gravies, other sauces",
  dips: "Dips, gravies, other sauces",
  guacamoles: "Dips, gravies, other sauces",
  "barbecue-sauces": "Dips, gravies, other sauces",
  mayonnaises: "Mayonnaise",
  "salad-dressings": "Salad dressings and vegetable oils",
  dressings: "Salad dressings and vegetable oils",
  vinegars: "Salad dressings and vegetable oils", // aprox.
  "vegetable-oils": "Salad dressings and vegetable oils",
  "olive-oils": "Salad dressings and vegetable oils",
  "sunflower-oils": "Salad dressings and vegetable oils",
  fats: "Butter and animal fats", // aprox.
  soups: "Soups, broth-based",
  broths: "Soups, broth-based",
  bouillons: "Soups, broth-based",
  "cream-soups": "Soups, cream-based",
  "instant-soups": "Soups, broth-based",

  // Platos preparados, congelados y pizzas
  pizzas: "Pizza",
  "frozen-pizzas": "Pizza",
  "pizza-pies-and-quiches": "Pizza", // aprox.
  sandwiches: "Cheese sandwiches", // aprox.
  "meat-sandwiches": "Deli and cured meat sandwiches",
  empanadas: "Turnovers and other grain-based items",
  turnovers: "Turnovers and other grain-based items",
  "meat-pies": "Turnovers and other grain-based items", // aprox.
  "prepared-meats": "Meat mixed dishes", // aprox.
  "meat-dishes": "Meat mixed dishes",
  "chicken-dishes": "Poultry mixed dishes",
  "fish-dishes": "Seafood mixed dishes",
  "rice-dishes": "Rice mixed dishes",
  "pasta-dishes": "Pasta mixed dishes, excludes macaroni and cheese",
  lasagnes: "Pasta mixed dishes, excludes macaroni and cheese",
  "prepared-lasagnes": "Pasta mixed dishes, excludes macaroni and cheese",
  "vegetable-dishes": "Vegetable dishes",
  "legume-dishes": "Bean, pea, legume dishes",
  burritos: "Burritos and tacos",
  tacos: "Burritos and tacos",
  sushi: "Egg rolls, dumplings, sushi",
  dumplings: "Egg rolls, dumplings, sushi",
  "spring-rolls": "Egg rolls, dumplings, sushi",
  "macaroni-and-cheese": "Macaroni and cheese",

  // Alimentación infantil
  "baby-foods": "Baby food: mixtures", // aprox.
  "baby-cereals": "Baby food: cereals",
  "baby-fruit-purees": "Baby food: fruit",
  "baby-vegetable-purees": "Baby food: vegetables",
  "baby-milks": "Formula, prepared from powder", // aprox.
  "infant-formulas": "Formula, prepared from powder",
  "baby-biscuits": "Baby food: snacks and sweets",

  // Etiquetas en español (sin taxonomizar en OFF, p. ej. `es:yogures`).
  // Mismas claves WWEIA que su par en inglés; "dulces untables" es aprox.
  galletas: "Cookies and brownies", // = biscuits
  yogures: "Yogurt, regular", // = yogurts
  leches: "Milk, whole", // = milks; aprox.: no distingue el contenido graso
  quesos: "Cheese", // = cheeses
  pan: "Yeast breads", // = breads
  "leches-saborizadas": "Flavored milk, whole", // = flavoured-milks; aprox.
  "jugos-de-fruta": "Other fruit juice", // = fruit-juices
  "dulces-untables": "Jams, syrups, toppings", // aprox.: untables dulces
};

/**
 * Quita el prefijo de idioma (`en:`, `es:`…), pasa a minúsculas, quita tildes y
 * convierte espacios en guiones: "Leches saborizadas" y "leches-saborizadas" dan
 * la misma clave.
 */
export function normalizarEtiqueta(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/^[a-z]{2}:/, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Categoría en español de una etiqueta OFF, o null si no tiene mapeo. */
export function categoriaDeEtiqueta(tag: string): string | null {
  const key = MAPEO_CATEGORIAS_OFF[normalizarEtiqueta(tag)];
  if (key === undefined) return null;
  return CATEGORIAS_WWEIA[key] ?? null;
}

export interface CategoriaResuelta {
  /** Siempre un texto: "Sin categoría" si nada coincide. */
  category: string;
  /** Etiquetas (sin `en:`) del producto; solo se llenan si quedó sin categoría. */
  sinMapear: string[];
}

/**
 * Categoría del producto: prueba `main_category` y luego `categories_tags` de la
 * más específica (última) a la más general; la primera con mapeo gana.
 */
export function resolverCategoria(
  categoriesTags: readonly string[],
  mainCategory = "",
): CategoriaResuelta {
  const candidatas = [mainCategory, ...[...categoriesTags].reverse()].filter(
    (t) => t.trim() !== "",
  );
  for (const tag of candidatas) {
    const category = categoriaDeEtiqueta(tag);
    if (category !== null) return { category, sinMapear: [] };
  }
  const tags = [...categoriesTags, mainCategory].map(normalizarEtiqueta).filter(Boolean);
  return { category: SIN_CATEGORIA, sinMapear: [...new Set(tags)] };
}
