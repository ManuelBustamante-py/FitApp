# 01 · Visión y alcance

## Problema

Quien empieza a entrenar para bajar de peso no sabe con certeza cuánto déficit calórico lleva:

- Las máquinas (bicicleta de spinning, trotadora) muestran calorías calculadas con supuestos genéricos de peso y no consideran el pulso, así que el número suele quedar por debajo o por encima del real.
- Contar lo que se come es tedioso. Una foto no basta para saber las calorías, porque sin el peso de la porción el error es enorme.
- Los datos quedan repartidos entre la máquina, el saturómetro, la balanza y la memoria.

## Visión

Un solo lugar, cómodo de usar desde el celular, donde registrar en menos de un minuto el entrenamiento y cada comida (con sus gramos), y que responda cada día: **¿estoy en déficit, cuánto, y a qué ritmo me acerco a mi meta?**

## Usuario objetivo (MVP)

Persona adulta que empieza a hacer ejercicio con el objetivo de llegar a un IMC saludable. Caso de referencia:

| Dato | Valor |
|---|---|
| Edad / sexo | 23 años, hombre |
| Estatura | 1,75 m |
| Peso actual | 100–102 kg → IMC ≈ **33** (obesidad grado I) |
| Meta | IMC < 25 → peso ≤ **76,5 kg** |
| Equipo | Bicicleta de spinning con consola; saturómetro con lectura de pulso |
| Sesión de ejemplo | 17 min, 5,6 km, 77 kcal (consola), pulso 130–145 lpm |

El sistema se diseña con **cuentas de usuario desde el inicio**, aunque en esta etapa es de uso personal.

## Alcance

### Dentro del MVP (fases 0–4)
- Perfil, mediciones de peso, IMC y meta.
- Metabolismo basal (BMR) y gasto diario (TDEE).
- Registro de sesiones de ejercicio con estimación propia de calorías.
- Base de alimentos importada (USDA + Open Food Facts Chile + tabla chilena) y registro de comidas por gramos/ml.
- Recetas propias (por ejemplo, una sopa casera) y alimentos personalizados.
- Balance diario y semanal, gráficos de tendencia y proyección a la meta.

### Fases posteriores
- Identificación de alimentos por foto o texto libre con IA (el usuario confirma los gramos).
- Escaneo de código de barras.
- Gasto diario adaptativo (calculado a partir de la tendencia real del peso).
- Integraciones con wearables y Health Connect, y apertura pública multiusuario.

### Fuera de alcance
- Diagnóstico o prescripción médica y planes de dieta clínicos.
- Estimar el **peso** de un alimento a partir de una foto: los gramos los ingresa siempre el usuario.

## Indicadores de éxito
- Registrar una comida en ≤ 30 s y una sesión de ejercicio en ≤ 20 s.
- ≥ 90 % de los alimentos que se buscan se encuentran en la base o se crean en menos de 1 minuto.
- Uso diario sostenido durante 8 semanas.
- Tendencia de peso semanal visible y comparable con el déficit estimado.

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Error en la estimación del gasto energético | Mostrar rangos, combinar el pulso con MET y ajustar con la tendencia real del peso (TDEE adaptativo) |
| Datos de alimentos incompletos o duplicados | Prioridad de fuentes, deduplicación y alimentos personalizados |
| Licencias de las bases (ODbL, términos de las API) | Ver [04-fuentes-de-datos.md](04-fuentes-de-datos.md); no hacer scraping sin revisión legal |
| Datos de salud = datos sensibles (Ley 19.628 / Ley 21.719) | RLS por usuario, cifrado en tránsito, mínima recolección; revisión legal antes de abrir al público |
| Abandono por fricción al registrar | Favoritos, comidas recientes, copiar el día anterior, recetas |
