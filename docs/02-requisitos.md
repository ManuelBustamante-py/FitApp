# 02 · Requisitos

Prioridad MoSCoW: **M** = imprescindible (Must), **S** = debería (Should), **C** = podría (Could).

## Requisitos funcionales

### Cuenta y perfil
| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Registro e inicio de sesión (email con enlace mágico o contraseña) | M |
| RF-02 | Perfil: fecha de nacimiento, sexo, estatura, nivel de actividad, zona horaria | M |
| RF-03 | Meta: peso objetivo o IMC objetivo y ritmo semanal deseado (0,25–1 kg/semana) | M |

### Cuerpo
| ID | Requisito | Prioridad |
|---|---|---|
| RF-04 | Registrar peso con fecha (y opcionalmente cintura y % de grasa) | M |
| RF-05 | Calcular el IMC y su categoría OMS en cada medición | M |
| RF-06 | Calcular la TMB con una fórmula configurable (Mifflin-St Jeor por defecto, Harris-Benedict revisada, Katch-McArdle, Cunningham o un valor medido), comparando los resultados de todas | M |
| RF-06b | Perfil de actividad cotidiana por día de la semana: nivel (solo TMB, sedentario, ligero, moderado, activo, muy activo, factor personalizado) o meta de pasos | M |
| RF-06c | Ajuste de un día puntual: cambiar su nivel o ingresar sus pasos reales | S |
| RF-06d | Umbral de pasos sedentarios y largo de paso configurables | S |
| RF-07 | Mostrar la tendencia del peso (promedio móvil de 7 días) | S |
| RF-08 | TDEE adaptativo a partir de la ingesta registrada y la tendencia del peso | C |

### Ejercicio
| ID | Requisito | Prioridad |
|---|---|---|
| RF-09 | Catálogo de tipos de actividad con valor MET (bicicleta estática, caminata, trote, pesas…) | M |
| RF-10 | Registrar una sesión: actividad, duración, distancia, kcal de la máquina, pulso promedio, mínimo y máximo, esfuerzo percibido (RPE) y notas | M |
| RF-11 | Estimar las kcal por pulso (Keytel) y por MET; mostrar las tres cifras (máquina, pulso, MET) y la elegida | M |
| RF-12 | Usar kcal **netas** (descontando el gasto en reposo) en el balance para no contarlo dos veces | M |
| RF-13 | Plantillas de sesión ("Spinning 20 min") para repetir con un toque | S |
| RF-14 | Calcular las zonas de frecuencia cardíaca y el tiempo en cada zona | C |

### Alimentación
| ID | Requisito | Prioridad |
|---|---|---|
| RF-15 | Buscar alimentos por nombre (español/inglés, tolerante a errores de escritura) | M |
| RF-16 | Registrar un alimento indicando la cantidad en **g** o **ml**, o en una porción casera (taza, cucharada, unidad) con su equivalencia en gramos | M |
| RF-17 | Agrupar el registro por comida: desayuno, almuerzo, once/merienda, cena, colación | M |
| RF-18 | Mostrar kcal, proteínas, carbohidratos y grasas por ítem, comida y día | M |
| RF-19 | Crear alimentos personalizados (desde una etiqueta nutricional) | M |
| RF-20 | Crear recetas: ingredientes en gramos + peso final cocido → valores por 100 g de la preparación | S |
| RF-21 | Distinguir crudo/cocido (por ejemplo, arroz crudo vs cocido) | M |
| RF-22 | Favoritos, recientes y "copiar comida del día anterior" | S |
| RF-23 | Escanear el código de barras (cámara) y buscarlo en Open Food Facts | S |
| RF-24 | Foto → sugerir el alimento (IA); el usuario confirma el alimento y los gramos | C |
| RF-25 | Texto libre → ítems ("200 g de arroz y 150 g de pollo") | C |

### Balance y reportes
| ID | Requisito | Prioridad |
|---|---|---|
| RF-26 | Balance diario: ingesta − TDEE del día (TMB × factor del día + pasos extra + ejercicio neto) | M |
| RF-27 | Panel con anillo de calorías del día, macros y déficit acumulado de la semana | M |
| RF-28 | Gráficos: peso e IMC en el tiempo, déficit diario, kcal por ejercicio | S |
| RF-29 | Proyección: fecha estimada para llegar a la meta al ritmo actual | S |
| RF-30 | Exportar los datos (CSV) | C |

## Requisitos no funcionales

| ID | Categoría | Requisito |
|---|---|---|
| RNF-01 | Usabilidad | Diseño mobile-first; las acciones frecuentes en ≤ 3 toques |
| RNF-02 | Instalable | PWA con manifest e instalación en Android/iOS |
| RNF-03 | Offline | Registrar comidas y ejercicio sin conexión y sincronizar después (S) |
| RNF-04 | Rendimiento | Búsqueda de alimentos < 300 ms (p95) sobre ≥ 500 mil registros |
| RNF-05 | Seguridad | Row Level Security: cada usuario solo ve sus datos; secretos solo en el servidor |
| RNF-06 | Privacidad | Datos de salud tratados como sensibles; eliminación de la cuenta y sus datos |
| RNF-07 | Exactitud | Las fórmulas con pruebas unitarias contra valores de referencia; los redondeos solo en la vista |
| RNF-08 | Trazabilidad | Cada alimento guarda su fuente, ID externo, licencia y fecha de importación |
| RNF-09 | Mantenibilidad | TypeScript estricto, lint, pruebas en CI y migraciones versionadas |
| RNF-10 | Costo | Operar en los planes gratuitos de Vercel y Supabase durante el MVP |
| RNF-11 | Idioma | Interfaz en español (es-CL), unidades métricas |

## Historias de usuario (MVP)

- **HU-01** Como usuario, quiero registrar mi peso cada mañana para ver cómo cambia mi IMC.
  *Criterio:* al guardar 101 kg con 1,75 m, la aplicación muestra un IMC de 33,0 y la categoría "Obesidad grado I".
- **HU-02** Como usuario, quiero anotar mi sesión de spinning con los datos de la consola y mi pulso promedio para saber cuánto gasté realmente.
  *Criterio:* para 17 min a 137 lpm promedio, 101 kg y 23 años, la estimación por pulso queda en ≈ 228 kcal y se muestra junto a las 77 kcal de la máquina.
- **HU-07** Como usuario, quiero configurar que de lunes a viernes camino 5.000 pasos y que el fin de semana soy sedentario, para que mi gasto diario sea realista.
  *Criterio:* con TMB Mifflin de 1.994 kcal, el TDEE sin ejercicio es ≈ 2.484 kcal de lunes a viernes y ≈ 2.393 el sábado y el domingo.
- **HU-03** Como usuario, quiero buscar "arroz cocido", ingresar 180 g y ver sus calorías.
  *Criterio:* kcal = kcal por 100 g × 180 / 100, redondeado a un entero en pantalla.
- **HU-04** Como usuario, quiero registrar una sopa casera como receta para no ingresar los ingredientes cada vez.
- **HU-05** Como usuario, quiero ver al final del día si estuve en déficit y cuánto.
- **HU-06** Como usuario, quiero ver en qué fecha llegaría a mi meta si mantengo el ritmo actual.
