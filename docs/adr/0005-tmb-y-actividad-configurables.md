# ADR-0005 · TMB y actividad cotidiana configurables por día

- **Estado:** Aceptada (2026-11-19)

## Contexto
Un único factor de actividad para toda la semana no refleja una rutina real (por ejemplo, 5.000 pasos de lunes a viernes y fines de semana sedentarios). Además, ninguna fórmula de TMB es la mejor para todas las personas.

## Decisión
- La TMB se calcula con una **estrategia intercambiable** (patrón Strategy): Mifflin-St Jeor por defecto, Harris-Benedict revisada, Katch-McArdle, Cunningham o un valor medido.
- La actividad cotidiana se define con una **semana tipo** (7 reglas: un nivel con su factor o una meta de pasos) y **ajustes por fecha**.
- El modo por pasos usa la base sedentaria (1,2) más el costo neto de los pasos que superan un umbral configurable.
- El ejercicio registrado siempre se suma aparte.

Las fórmulas están en [docs/03-calculos-y-formulas.md](../03-calculos-y-formulas.md), §2–3.

## Consecuencias
- (+) Un gasto diario realista y explicable: la interfaz muestra el desglose TMB × factor + pasos + ejercicio.
- (+) Agregar otra fórmula de TMB no cambia el resto del sistema.
- (−) Más configuración: el onboarding sugiere valores por defecto (Mifflin y sedentario todos los días) para no frenar al usuario.
- (−) Riesgo de contar dos veces una caminata registrada como ejercicio; la interfaz lo advierte.
