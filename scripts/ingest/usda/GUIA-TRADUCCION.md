# Guía de estilo para los nombres de alimentos (USDA → español de Chile)

Criterios con que se revisó `translations.csv` y que debe seguir cualquier revisión
o corrección posterior. El público son personas en Chile que registran lo que comen
en una app móvil: el nombre debe entenderse a la primera, encontrarse al buscar con
las palabras que usaría alguien en Chile y caber en una línea de 375 px cuando se
pueda.

## 1. Forma del nombre

- **Primero el alimento, en español natural; después los detalles, separados por coma.**
  USDA escribe "categoría, alimento, detalle" (_Chicken, broiler, breast, meat only, raw_).
  En español se escribe el nombre como lo diría una persona y se dejan los detalles
  al final: _Pechuga de pollo, solo carne, cruda_.
  - _Tea, hot, chamomile_ → _Té de manzanilla, caliente_
  - _Cabbage, red, cooked, boiled, drained, without salt_ → _Repollo morado, cocido, hervido, escurrido, sin sal_
  - _Puddings, chocolate, dry mix, instant_ → _Postre tipo pudín sabor chocolate, mezcla instantánea en polvo_
- Los prefijos genéricos de USDA (_Beverages_, _Snacks_, _Fish_, _Spices_, _Candies_,
  _Restaurant_, _Fast foods_, _Babyfood_…) no se traducen como primera palabra si
  sobran: _Fish, salmon, sockeye, raw_ → _Salmón rojo (sockeye), crudo_;
  _Spices, oregano, dried_ → _Orégano, seco_. Se mantienen cuando aportan
  (_Comida para bebé_, _Bebida isotónica_).
- Mayúscula solo al inicio y en nombres propios y marcas. Sin punto final.
- Concordancia de género y número con el sustantivo principal (_Papas fritas, congeladas_;
  _Pechuga de pollo, cruda_). Singular por defecto salvo que el alimento se nombre
  en plural en Chile (_porotos_, _arvejas_, _papas fritas_, _cabritas_, _tallarines_).
- Nada repetido: nunca _Salsa, ají, ají picante_; sí _Salsa de ají picante_.
- No se pierde ninguna información nutricionalmente relevante (crudo/cocido, método
  de cocción, con o sin piel, hueso, sal, azúcar, grasa, enriquecido, marca,
  variedad), porque distingue filas con nutrientes distintos.
- Se elimina el ruido administrativo sin valor para el usuario:
  _(Includes foods for USDA's Food Distribution Program)_, _(USDA Commodity)_ → se
  quita. Si la fila quedara idéntica a otra, se agrega un distintivo breve.
- Longitud máxima 200 caracteres (límite de la base); lo ideal es menos de 80.

## 2. Unidades y números

- Decimales con coma: _2,5 %_. Espacio antes de `%`: _85 % magra_.
- Pulgadas a métrico: grasa recortada a 0" → _sin grasa visible_, 1/8" → _3 mm_,
  1/4" → _6 mm_, 1/2" → _13 mm_. Ej.: _trimmed to 1/8" fat_ → _grasa recortada a 3 mm_.
- Leche: _whole_ → _entera_; _2%_ → _semidescremada 2 %_; _1%_ → _semidescremada 1 %_;
  _skim / nonfat / fat free_ → _descremada_.

## 3. Marcas y nombres propios

- Se respetan tal cual con su escritura oficial (_McDonald's_, _Taco Bell_, _Breyers_,
  _Starburst_, _Kellogg's_, _Minute Maid_, _KFC_, _Burger King_). SR Legacy las
  escribe en mayúsculas: se normalizan (_QUAKER_ → _Quaker_), salvo siglas (_KFC_).
- Formato: **marca, producto traducido**: _Taco Bell, burrito supremo con carne de vacuno_;
  _Breyers, helado de vainilla, sin azúcar agregada_; _Starburst, caramelos masticables
  sabor fruta_. Nunca se traduce el nombre de la marca ni de la línea de producto
  (_Cheerios_, _Big Mac_, _Shake 'n Bake_), pero sí la descripción genérica.

## 4. Vocabulario de Chile (obligatorio)

| Inglés                                              | Español de Chile                                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| beef                                                | vacuno (_carne de vacuno_, _vacuno molido_)                                                        |
| ground beef                                         | carne molida de vacuno                                                                             |
| corn (fresh) / corn (grain, meal)                   | choclo / maíz                                                                                      |
| beans / green beans / lima beans                    | porotos / porotos verdes / porotos pallares                                                        |
| peas                                                | arvejas                                                                                            |
| avocado                                             | palta                                                                                              |
| peach / apricot / strawberry                        | durazno / damasco / frutilla                                                                       |
| beet                                                | betarraga                                                                                          |
| sweet potato                                        | camote                                                                                             |
| bell pepper / chili pepper, hot pepper              | pimentón / ají                                                                                     |
| zucchini / squash, pumpkin                          | zapallo italiano / zapallo                                                                         |
| banana                                              | plátano                                                                                            |
| peanut                                              | maní                                                                                               |
| cantaloupe / honeydew                               | melón calameño / melón tuna                                                                        |
| grapefruit                                          | pomelo                                                                                             |
| popcorn                                             | cabritas                                                                                           |
| frankfurter, hot dog (sausage) / hot dog (sandwich) | vienesa / completo                                                                                 |
| bologna / salami                                    | mortadela / salame                                                                                 |
| beef jerky                                          | charqui de vacuno                                                                                  |
| bacon                                               | tocino                                                                                             |
| pork belly                                          | panceta de cerdo                                                                                   |
| mussels / scallops / crab                           | choritos / ostiones / jaiba                                                                        |
| jack mackerel / Atlantic mackerel                   | jurel / caballa                                                                                    |
| cream / sour cream / whipped cream                  | crema / crema ácida / crema batida                                                                 |
| dulce de leche                                      | manjar                                                                                             |
| cake (layer) / pound cake, loaf cake                | torta / queque                                                                                     |
| cookie / cracker                                    | galleta / galleta salada (de agua si es _water cracker_)                                           |
| pancake (US) / crepe                                | panqueque americano / panqueque                                                                    |
| hamburger bun / hot dog bun                         | pan de hamburguesa / pan de completo                                                               |
| spaghetti / noodles                                 | tallarines / fideos                                                                                |
| jelly (spread) / jam / gelatin dessert              | mermelada / mermelada / jalea (gelatina)                                                           |
| salad dressing                                      | **aderezo** para ensaladas (_aliño_ = condimento o mezcla de especias, _seasoning_)                |
| pudding (dessert)                                   | **postre tipo pudín** (_arroz con leche_ para _rice pudding_; _budín de pan_ para _bread pudding_) |
| gravy                                               | salsa gravy (salsa de jugo de carne)                                                               |
| soda, soft drink                                    | bebida gaseosa                                                                                     |
| juice / nectar                                      | jugo / néctar                                                                                      |
| milk shake / smoothie                               | batido / batido de fruta (smoothie)                                                                |
| french fries / potato chips                         | papas fritas / papas fritas tipo chips                                                             |
| tortilla chips                                      | tortillas chips (nachos)                                                                           |
| candy / gum                                         | dulces, caramelos / chicle                                                                         |
| hot (temperatura) / hot (picante)                   | caliente / picante                                                                                 |
| prepared from recipe                                | casero                                                                                             |
| ready-to-eat / ready-to-drink                       | listo para comer / listo para beber                                                                |
| canned                                              | en conserva (_en lata_ si es bebida)                                                               |
| NS as to form / NFS                                 | (se omite si no aporta) / sin especificar                                                          |
| fat not added in cooking / fat added                | sin grasa agregada / con grasa agregada                                                            |
| from fast food / restaurant / school cafeteria      | de comida rápida / de restaurante / de casino escolar                                              |
| broiler or fryer (chicken)                          | (se omite: es el pollo común)                                                                      |
| variety meats and by-products                       | vísceras                                                                                           |

Otras decisiones fijadas al unificar la revisión: _frosting_ → **betún** (_glaze_/_icing_ → glaseado); _wheat bread_ → **pan de trigo** (no es integral; _whole wheat_ → integral); _swordfish_ → **albacora (pez espada)**; _half and half_ → **crema half and half (mitad leche, mitad crema)**; _cream sauce_ → salsa de crema (_salsa blanca_ es bechamel); _dressing_ en platos de ave → relleno (_stuffing_), no aderezo; pizzas en cm, sin pulgadas.

## 5. Cortes de carne

Se usa el corte chileno cuando la equivalencia es directa; si es aproximada, el
nombre chileno con el estadounidense entre paréntesis para no inducir a error.

**Vacuno**

| USDA                                 | Chile                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------- |
| tenderloin                           | filete                                                                     |
| rib eye, rib (small end)             | lomo vetado                                                                |
| top loin, strip loin, short loin     | lomo liso                                                                  |
| T-bone / porterhouse                 | T-bone / porterhouse                                                       |
| top sirloin                          | punta de picana (top sirloin)                                              |
| top sirloin cap / cap-off            | picaña (top sirloin cap) / punta de picana sin tapa (top sirloin cap-off)  |
| lip-on / lip-off                     | con tapa (lip-on) / sin tapa (lip-off)                                     |
| tri-tip                              | punta de ganso (tri-tip)                                                   |
| eye of round                         | pollo ganso                                                                |
| top round                            | posta negra                                                                |
| bottom round                         | ganso (bottom round)                                                       |
| round tip, knuckle                   | posta rosada                                                               |
| round (sin más)                      | pierna                                                                     |
| chuck, chuck eye, chuck roll         | sobrecostilla / huachalomo (chuck eye, chuck roll)                         |
| shoulder clod, arm                   | paleta                                                                     |
| top blade, flat iron                 | punta paleta                                                               |
| brisket                              | tapapecho                                                                  |
| flank                                | palanca (flank)                                                            |
| skirt (inside / outside)             | entraña interior / exterior (inside / outside skirt)                       |
| plate, short plate                   | malaya (plate)                                                             |
| short ribs / back ribs               | asado de tira / costillar                                                  |
| shank                                | osobuco                                                                    |
| rib (sección completa)               | costillar                                                                  |
| separable lean only / lean and fat   | solo magro / magro y grasa                                                 |
| choice / select / prime / all grades | Choice / Select / Prime / todos los grados (calidades USDA, con mayúscula) |
| steak / roast                        | bistec / asado (corte para asar); _roasted_ = al horno                     |

**Cerdo**: loin → lomo; tenderloin → filete de cerdo; shoulder, Boston butt → paleta
de cerdo; picnic → paleta baja (picnic); leg, ham (fresh) → pierna de cerdo; spareribs
→ costillar de cerdo; back ribs → costillas de cerdo (back ribs); chop → chuleta;
belly → panceta; hocks → codillo; feet → patitas; backfat → tocino dorsal.

**Aves**: breast → pechuga; thigh → trutro largo; drumstick → trutro corto;
leg → trutro entero; wing → ala; back → espalda (de pollo/pavo; _nunca_ «lomo»);
giblets → menudencias; skin → piel; neck → cuello; dark meat / light meat → carne
oscura / carne blanca; ground → molido; rotisserie → rostizado.

**Métodos de cocción**: roasted → asado al horno; broiled → asado al grill; grilled →
a la parrilla; braised → estofado; stewed → guisado; simmered → cocido a fuego lento;
pan-fried → frito en sartén; deep-fried → frito en abundante aceite; baked → horneado;
boiled → hervido; steamed → al vapor; microwaved → al microondas; sautéed → salteado.

## 6. Platos de FNDDS

Son platos de la dieta estadounidense. Se traducen como plato, no palabra por palabra:

- _Peanut butter and jelly sandwich, on white bread_ → _Sándwich de mantequilla de maní y mermelada, en pan blanco_
- _Chicken and vegetable entree with noodles, diet frozen meal_ → _Plato de pollo con verduras y fideos, comida congelada dietética_
- _Kung Pao beef_ → _Vacuno Kung Pao_
- _Beef, rice, and vegetables including carrots, broccoli, and/or dark-green leafy; soy-based sauce_ → _Vacuno con arroz y verduras (con zanahoria, brócoli u hojas verde oscuro), salsa de soya_
- _Potato only from Puerto Rican mixed dishes_ → _Papa de platos mixtos puertorriqueños (solo la papa)_

Los nombres propios de platos sin equivalente se dejan (_congee_, _ramen_, _bagel_,
_burrito_, _pad thai_) y se aclara si hace falta (_Congee (sopa de arroz), con verduras_).

## 7. Estados en `translations.csv`

- `borrador`: propuesta del glosario o edición sin revisar.
- `revisado_ia`: revisado nombre por nombre por un modelo de IA con esta guía. El
  generador no lo pisa. Una persona lo pasa a `revisado` al confirmarlo.
- `revisado`: confirmado por una persona.
