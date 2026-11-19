/**
 * Categorías WWEIA de FNDDS (What We Eat in America) en español de Chile.
 *
 * Mapa revisado: la clave es la descripción en inglés tal como viene en
 * `wweia_food_category.csv` (el ETL solo recibe la descripción). El código WWEIA
 * va en el comentario de cada fila. Si USDA agrega una categoría nueva, el test
 * `categorias.test.ts` falla hasta que se agregue aquí.
 */
export const CATEGORIAS_WWEIA: Record<string, string> = {
  "Milk, whole": "Leche entera", // 1002
  "Milk, reduced fat": "Leche semidescremada", // 1004
  "Milk, lowfat": "Leche baja en grasa", // 1006
  "Milk, nonfat": "Leche descremada", // 1008
  "Flavored milk, whole": "Leche saborizada entera", // 1202
  "Flavored milk, reduced fat": "Leche saborizada semidescremada", // 1204
  "Flavored milk, lowfat": "Leche saborizada baja en grasa", // 1206
  "Flavored milk, nonfat": "Leche saborizada descremada", // 1208
  "Milk shakes and other dairy drinks": "Malteadas y otras bebidas lácteas", // 1402
  Cheese: "Queso", // 1602
  "Cottage/ricotta cheese": "Queso cottage y ricotta", // 1604
  "Yogurt, regular": "Yogur regular", // 1820
  "Yogurt, Greek": "Yogur griego", // 1822
  "Beef, excludes ground": "Vacuno (sin molido)", // 2002
  "Ground beef": "Carne molida de vacuno", // 2004
  Pork: "Cerdo", // 2006
  "Lamb, goat, game": "Cordero, cabrito y caza", // 2008
  "Liver and organ meats": "Hígado y vísceras", // 2010
  "Chicken, whole pieces": "Pollo en presas", // 2202
  "Chicken patties, nuggets and tenders": "Hamburguesas, nuggets y tiras de pollo", // 2204
  "Turkey, duck, other poultry": "Pavo, pato y otras aves", // 2206
  Fish: "Pescados", // 2402
  Shellfish: "Mariscos", // 2404
  "Eggs and omelets": "Huevos y tortillas de huevo", // 2502
  "Cold cuts and cured meats": "Fiambres y carnes curadas", // 2602
  Bacon: "Tocino", // 2604
  Frankfurters: "Vienesas", // 2606
  Sausages: "Longanizas y embutidos", // 2608
  "Beans, peas, legumes": "Porotos, arvejas y legumbres", // 2802
  "Nuts and seeds": "Frutos secos y semillas", // 2804
  "Soy and meat-alternative products": "Soya y sucedáneos de carne", // 2806
  "Meat mixed dishes": "Platos mixtos con carne", // 3002
  "Poultry mixed dishes": "Platos mixtos con ave", // 3004
  "Seafood mixed dishes": "Platos mixtos con pescados y mariscos", // 3006
  "Bean, pea, legume dishes": "Platos de porotos, arvejas y legumbres", // 3102
  "Vegetable dishes": "Platos de verduras", // 3104
  "Rice mixed dishes": "Platos mixtos con arroz", // 3202
  "Pasta mixed dishes, excludes macaroni and cheese":
    "Platos mixtos con pasta (sin macarrones con queso)", // 3204
  "Macaroni and cheese": "Macarrones con queso", // 3206
  "Turnovers and other grain-based items": "Empanadas y otros platos de cereales", // 3208
  "Fried rice and lo/chow mein": "Arroz frito y chow mein", // 3402
  "Stir-fry and soy-based sauce mixtures": "Salteados y mezclas con salsa de soya", // 3404
  "Egg rolls, dumplings, sushi": "Rollitos primavera, dumplings y sushi", // 3406
  "Burritos and tacos": "Burritos y tacos", // 3502
  Nachos: "Nachos", // 3504
  "Other Mexican mixed dishes": "Otros platos mexicanos", // 3506
  Pizza: "Pizza", // 3602
  Burgers: "Hamburguesas", // 3702
  "Frankfurter sandwiches": "Sándwiches de vienesa (completos)", // 3703
  "Chicken fillet sandwiches": "Sándwiches de filete de pollo", // 3704
  "Egg/breakfast sandwiches": "Sándwiches de huevo y desayuno", // 3706
  "Cheese sandwiches": "Sándwiches de queso", // 3720
  "Peanut butter and jelly sandwiches": "Sándwiches de mantequilla de maní y mermelada", // 3722
  "Seafood sandwiches": "Sándwiches de pescados y mariscos", // 3730
  Rice: "Arroz", // 4002
  "Pasta, noodles, cooked grains": "Pastas, fideos y cereales cocidos", // 4004
  "Yeast breads": "Panes de levadura", // 4202
  "Rolls and buns": "Panecillos y pan de hamburguesa", // 4204
  "Bagels and English muffins": "Bagels y muffins ingleses", // 4206
  Tortillas: "Tortillas", // 4208
  "Biscuits, muffins, quick breads": "Biscuits, muffins y panes rápidos", // 4402
  "Pancakes, waffles, French toast": "Panqueques, waffles y tostadas francesas", // 4404
  "Ready-to-eat cereal, higher sugar (>21.2g/100g)":
    "Cereales listos para comer, alto en azúcar (>21,2 g/100 g)", // 4602
  "Ready-to-eat cereal, lower sugar (=<21.2g/100g)":
    "Cereales listos para comer, bajo en azúcar (≤21,2 g/100 g)", // 4604
  Oatmeal: "Avena", // 4802
  "Grits and other cooked cereals": "Sémola de maíz y otros cereales cocidos", // 4804
  "Potato chips": "Papas fritas de bolsa", // 5002
  "Tortilla, corn, other chips": "Chips de tortilla, maíz y otros", // 5004
  Popcorn: "Cabritas", // 5006
  "Pretzels/snack mix": "Pretzels y mezclas de snacks", // 5008
  "Crackers, excludes saltines": "Galletas de agua y crackers (sin saladas)", // 5202
  "Saltine crackers": "Galletas saladas tipo soda", // 5204
  "Cereal bars": "Barras de cereal", // 5402
  "Nutrition bars": "Barras nutricionales", // 5404
  "Cakes and pies": "Tortas y pasteles", // 5502
  "Cookies and brownies": "Galletas y brownies", // 5504
  "Doughnuts, sweet rolls, pastries": "Donas, bollos dulces y pastelería", // 5506
  "Candy containing chocolate": "Golosinas con chocolate", // 5702
  "Candy not containing chocolate": "Golosinas sin chocolate", // 5704
  "Ice cream and frozen dairy desserts": "Helados y postres lácteos congelados", // 5802
  Pudding: "Flanes y budines", // 5804
  "Gelatins, ices, sorbets": "Gelatinas, helados de agua y sorbetes", // 5806
  Apples: "Manzanas", // 6002
  Bananas: "Plátanos", // 6004
  Grapes: "Uvas", // 6006
  "Peaches and nectarines": "Duraznos y nectarines", // 6008
  Strawberries: "Frutillas", // 6009
  "Blueberries and other berries": "Arándanos y otras bayas", // 6011
  "Citrus fruits": "Cítricos", // 6012
  Melons: "Melones y sandías", // 6014
  "Dried fruits": "Frutas secas", // 6016
  "Other fruits and fruit salads": "Otras frutas y ensaladas de frutas", // 6018
  Pears: "Peras", // 6020
  Pineapple: "Piña", // 6022
  "Mango and papaya": "Mango y papaya", // 6024
  Tomatoes: "Tomates", // 6402
  Carrots: "Zanahorias", // 6404
  "Other red and orange vegetables": "Otras verduras rojas y naranjas", // 6406
  Broccoli: "Brócoli", // 6407
  Spinach: "Espinacas", // 6409
  "Lettuce and lettuce salads": "Lechuga y ensaladas de lechuga", // 6410
  "Other dark green vegetables": "Otras verduras de hoja verde oscura", // 6411
  "String beans": "Porotos verdes", // 6412
  Cabbage: "Repollo", // 6413
  Onions: "Cebollas", // 6414
  Corn: "Choclo", // 6416
  "Other starchy vegetables": "Otras verduras con almidón", // 6418
  "Other vegetables and combinations": "Otras verduras y combinaciones", // 6420
  "Fried vegetables": "Verduras fritas", // 6430
  "Coleslaw, non-lettuce salads": "Ensalada de repollo y otras ensaladas sin lechuga", // 6432
  "Vegetables on a sandwich": "Verduras en sándwich", // 6489
  "White potatoes, baked or boiled": "Papas horneadas o cocidas", // 6802
  "French fries and other fried white potatoes": "Papas fritas a la francesa y otras", // 6804
  "Mashed potatoes and white potato mixtures": "Puré de papas y mezclas de papas", // 6806
  "Citrus juice": "Jugo de cítricos", // 7002
  "Apple juice": "Jugo de manzana", // 7004
  "Other fruit juice": "Otros jugos de fruta", // 7006
  "Vegetable juice": "Jugo de verduras", // 7008
  "Diet soft drinks": "Bebidas gaseosas light", // 7102
  "Diet sport and energy drinks": "Bebidas deportivas y energéticas light", // 7104
  "Other diet drinks": "Otras bebidas light", // 7106
  "Soft drinks": "Bebidas gaseosas", // 7202
  "Fruit drinks": "Bebidas de fruta", // 7204
  "Sport and energy drinks": "Bebidas deportivas y energéticas", // 7206
  "Nutritional beverages": "Bebidas nutricionales", // 7208
  "Smoothies and grain drinks": "Batidos de fruta y bebidas de cereales", // 7220
  Coffee: "Café", // 7302
  Tea: "Té", // 7304
  Beer: "Cerveza", // 7502
  Wine: "Vino", // 7504
  "Liquor and cocktails": "Licores y cócteles", // 7506
  "Tap water": "Agua de la llave", // 7702
  "Bottled water": "Agua embotellada", // 7704
  "Flavored or carbonated water": "Agua saborizada o con gas", // 7802
  "Enhanced water": "Agua enriquecida", // 7804
  "Butter and animal fats": "Mantequilla y grasas animales", // 8002
  Margarine: "Margarina", // 8004
  "Cream cheese, sour cream, whipped cream": "Queso crema, crema ácida y crema batida", // 8006
  "Cream and cream substitutes": "Crema de leche y sucedáneos", // 8008
  Mayonnaise: "Mayonesa", // 8010
  "Salad dressings and vegetable oils": "Aderezos para ensalada y aceites vegetales", // 8012
  "Tomato-based condiments": "Condimentos a base de tomate", // 8402
  "Soy-based condiments": "Condimentos a base de soya", // 8404
  "Mustard and other condiments": "Mostaza y otros condimentos", // 8406
  "Olives, pickles, pickled vegetables": "Aceitunas, pepinillos y verduras en conserva", // 8408
  "Pasta sauces, tomato-based": "Salsas de tomate para pasta", // 8410
  "Dips, gravies, other sauces": "Dips, salsas de carne y otras salsas", // 8412
  "Sugars and honey": "Azúcares y miel", // 8802
  "Sugar substitutes": "Edulcorantes", // 8804
  "Jams, syrups, toppings": "Mermeladas, jarabes y coberturas", // 8806
  "Baby food: cereals": "Alimentos infantiles: cereales", // 9002
  "Baby food: fruit": "Alimentos infantiles: fruta", // 9004
  "Baby food: vegetables": "Alimentos infantiles: verduras", // 9006
  "Baby food: meat and dinners": "Alimentos infantiles: carnes y almuerzos", // 9008
  "Baby food: yogurt": "Alimentos infantiles: yogur", // 9010
  "Baby food: snacks and sweets": "Alimentos infantiles: snacks y dulces", // 9012
  "Baby juice": "Jugo infantil", // 9202
  "Baby water": "Agua infantil", // 9204
  "Formula, ready-to-feed": "Fórmula infantil lista para usar", // 9402
  "Formula, prepared from powder": "Fórmula infantil preparada desde polvo", // 9404
  "Human milk": "Leche materna", // 9602
  "Protein and nutritional powders": "Proteínas y polvos nutricionales", // 9802
  "Not included in a food category": "Sin categoría", // 9999
  "Baby food: mixtures": "Alimentos infantiles: mezclas", // 9007
  "Deli and cured meat sandwiches": "Sándwiches de fiambres y carnes curadas", // 3740
  "Meat and BBQ sandwiches": "Sándwiches de carne y barbacoa", // 3742
  "Vegetable sandwiches/burgers": "Sándwiches y hamburguesas de verduras", // 3744
  "Plant-based milk": "Leche vegetal", // 1902
  "Plant-based yogurt": "Yogur vegetal", // 1904
  "Soups, broth-based": "Sopas con caldo", // 3804
  "Soups, cream-based": "Cremas y sopas con base de crema", // 3806
  "Ramen and Asian broth-based soups": "Ramen y sopas asiáticas con caldo", // 3808
};
