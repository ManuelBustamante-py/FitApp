# 03 · Cálculos y fórmulas

Todas las fórmulas viven en un módulo puro (`lib/calc`) con pruebas unitarias. Los valores se guardan sin redondear.

## 1. Índice de masa corporal (IMC)

```
IMC = peso_kg / estatura_m²
```

| Categoría (OMS) | IMC |
|---|---|
| Bajo peso | < 18,5 |
| Normal | 18,5 – 24,9 |
| Sobrepeso | 25,0 – 29,9 |
| Obesidad grado I | 30,0 – 34,9 |
| Obesidad grado II | 35,0 – 39,9 |
| Obesidad grado III | ≥ 40 |

**Caso de referencia:** 101 / 1,75² = 101 / 3,0625 = **33,0** → obesidad grado I.
Peso para IMC 24,9: 24,9 × 3,0625 = **76,3 kg** (rango normal: 56,7 – 76,3 kg).

## 2. Tasa metabólica basal (TMB), configurable

El usuario elige la fórmula en su perfil. La aplicación muestra el resultado de todas las fórmulas posibles a modo de comparación y usa la elegida.

| Fórmula | Requiere | Cuándo usarla |
|---|---|---|
| **Mifflin-St Jeor** *(predeterminada)* | peso, estatura, edad, sexo | La más exacta en población general y con sobrepeso u obesidad: queda a ±10 % de la medición real en cerca del 70–80 % de los casos (Frankenfield 2005). Es la recomendada por la Academy of Nutrition and Dietetics |
| **Harris-Benedict revisada** (Roza & Shizgal 1984) | peso, estatura, edad, sexo | Alternativa clásica; tiende a sobreestimar entre un 5 y un 15 % |
| **Katch-McArdle** | peso y % de grasa | Cuando el % de grasa es confiable (DEXA o bioimpedancia de calidad) |
| **Cunningham** | peso y % de grasa | Personas con mucha masa muscular |
| **Valor medido** | kcal/día ingresadas por el usuario | Si se hace una calorimetría indirecta (el estándar de oro) |

```
Mifflin-St Jeor   H: 10·P + 6,25·E − 5·A + 5        M: 10·P + 6,25·E − 5·A − 161
Harris-Benedict   H: 88,362 + 13,397·P + 4,799·E − 5,677·A
                  M: 447,593 + 9,247·P + 3,098·E − 4,330·A
Katch-McArdle     370 + 21,6·MLG          (MLG = P × (1 − %grasa/100))
Cunningham        500 + 22·MLG
```
P = kg, E = cm, A = años, MLG = masa libre de grasa (kg).

Caso (101 kg, 175 cm, 23 años, hombre):
- Mifflin-St Jeor: **≈ 1.994 kcal/día**
- Harris-Benedict revisada: ≈ 2.151 kcal/día

La TMB se recalcula con el **peso de tendencia** vigente cada día, así que baja a medida que bajas de peso.

## 3. Gasto diario (TDEE) con perfil de actividad por día

```
TDEE_día = TMB × factor_del_día + kcal_pasos_extra_día + Σ ejercicio_neto_día
```
El ejercicio registrado (sección 4) se suma **aparte** y nunca se incluye en el factor, para no contarlo dos veces.

### 3.1 Niveles de actividad cotidiana

| Nivel | Factor | Descripción |
|---|---|---|
| Solo TMB | 1,0 | Reposo absoluto (referencia o enfermedad) |
| **Sedentario** | 1,2 | Casa, oficina o estudio; < 3.000 pasos |
| Ligero | 1,375 | De pie parte del día; 5.000–7.500 pasos |
| Moderado | 1,55 | Trabajo en movimiento; 7.500–10.000 pasos |
| Activo | 1,725 | Trabajo físico; > 10.000 pasos |
| Muy activo | 1,9 | Trabajo físico pesado |
| Personalizado | x | Factor numérico definido por el usuario |

### 3.2 Modo por pasos
El día se marca como **Sedentario (1,2) más los pasos que superen el umbral sedentario** (2.500 pasos por defecto, configurable):
```
largo_paso_m  = estatura_m × 0,415 (hombre) | × 0,413 (mujer)   (o un valor medido por el usuario)
km_extra      = max(0, pasos − umbral) × largo_paso_m / 1000
kcal_pasos    = km_extra × peso_kg × 0,5          (costo neto de caminar ≈ 0,5 kcal/kg/km)
```

### 3.3 Semana tipo + ajuste de un día
- **Semana tipo:** cada día (lunes a domingo) tiene un nivel (3.1) o una meta de pasos (3.2).
- **Ajuste de un día:** se puede cambiar el nivel de una fecha puntual o ingresar los pasos reales del día. Los pasos reales reemplazan a los estimados de la semana tipo.
- Si una caminata se registra como **sesión de ejercicio**, sus pasos no deben contarse además en el modo por pasos. La interfaz lo advierte.

### 3.4 Caso de referencia (TMB Mifflin = 1.994)
| Días | Configuración | Cálculo | TDEE (sin ejercicio) |
|---|---|---|---|
| Lun–Vie | 5.000 pasos | 1.994 × 1,2 + (2.500 × 0,726 m = 1,82 km × 101 × 0,5 ≈ 92) | **≈ 2.484 kcal** |
| Sáb–Dom | Sedentario | 1.994 × 1,2 | **≈ 2.393 kcal** |
| Promedio semanal | | (5 × 2.484 + 2 × 2.393) / 7 | **≈ 2.458 kcal/día** |

## 4. Gasto del ejercicio

Se calculan hasta tres cifras y se elige una con esta prioridad: **pulso → MET → máquina**.

### 4.1 Por frecuencia cardíaca (Keytel et al., 2005)
```
Hombre: kcal/min = (−55,0969 + 0,6309·FC + 0,1988·peso + 0,2017·edad) / 4,184
Mujer:  kcal/min = (−20,4022 + 0,4472·FC − 0,1263·peso + 0,074·edad) / 4,184
```
Es válida para ejercicio aeróbico con FC ≈ 90–150 lpm; fuera de ese rango se marca como "baja confianza".
Caso: FC 137, 101 kg, 23 años → (−55,10 + 86,43 + 20,08 + 4,64)/4,184 ≈ 13,4 kcal/min × 17 min ≈ **228 kcal**.

### 4.2 Por MET (Compendium of Physical Activities)
```
kcal = MET × peso_kg × horas
```
Bicicleta estática a intensidad moderada, MET ≈ 6,8–7,0 → 7,0 × 101 × 0,283 h ≈ **200 kcal**.

### 4.3 Valor de la máquina
Se guarda como referencia. En el caso de referencia (77 kcal) queda muy por debajo de las otras dos estimaciones; lo más probable es que la consola asuma un peso estándar y no considere el pulso.

### 4.4 Gasto neto (lo que entra al balance)
```
kcal_netas = kcal_brutas − BMR/1440 × minutos
```
Caso: 228 − (1.994/1.440 × 17) ≈ 228 − 24 = **≈ 204 kcal netas**.

> Exactitud del pulso: los saturómetros de dedo pueden perder la señal con el movimiento. Se sugiere anotar el pulso promedio de los tramos estables; una banda de pecho es más exacta.

## 5. Ingesta

```
kcal_ítem = kcal_por_100 × cantidad / 100
```
- Los sólidos se expresan por 100 g y los líquidos por 100 ml. Si falta la densidad, se asume 1 g/ml y se marca el valor.
- Porciones caseras: `cantidad_g = n_porciones × gramos_por_porcion`.
- Si faltan las kcal pero hay macros: `kcal ≈ 4·proteína + 4·carbohidratos + 9·grasa (+ 7·alcohol)`.
- **Recetas:** nutrientes por 100 g = Σ(nutrientes de los ingredientes) / peso_final_cocido × 100. Esto resuelve preparaciones caseras como sopas y guisos, donde el agua se gana o se pierde al cocinar.

## 6. Balance diario

```
balance = ingesta − TDEE_día      (TDEE_día ya incluye los pasos y el ejercicio neto, §3)
balance < 0 → déficit
```

## 7. Ritmo y proyección

- Aproximación clásica: 1 kg de grasa ≈ 7.700 kcal → déficit de 500 kcal/día ≈ 0,45 kg/semana. Esta cifra **sobreestima** la pérdida a largo plazo porque el gasto se adapta, así que la proyección se muestra como un rango y se recalcula con el peso real.
- Ritmo prudente sugerido: 0,5–1 % del peso corporal por semana. La aplicación avisa si la ingesta baja de ~1.500 kcal/día (hombres) o ~1.200 (mujeres) y recomienda consultar a un profesional.
- Peso de tendencia: promedio móvil exponencial de los registros diarios (suaviza el agua y la sal).

## 8. TDEE adaptativo (fase posterior)

En una ventana de 14–28 días:
```
TDEE_real ≈ ingesta_promedio − (Δpeso_tendencia_kg × 7.700) / días
```
Reemplaza al TDEE de fórmula cuando hay datos suficientes (≥ 80 % de los días registrados).

## Referencias
- OMS, clasificación del IMC en adultos.
- Mifflin MD et al. (1990). *Am J Clin Nutr* 51:241-247.
- Frankenfield D et al. (2005). *J Am Diet Assoc* 105(5):775-789 (comparación de ecuaciones de TMB).
- Roza AM, Shizgal HM (1984). *Am J Clin Nutr* 40:168-182 (Harris-Benedict revisada).
- FAO/OMS/UNU (2004). *Human energy requirements* (niveles de actividad física).
- Keytel LR et al. (2005). *J Sports Sci* 23(3):289-297.
- Ainsworth BE et al. *Compendium of Physical Activities* (2011, actualización 2024).
- Hall KD et al. (2011). *Lancet* 378:826-837 (modelo dinámico de pérdida de peso).
