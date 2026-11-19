# ADR-0004 · Los gramos los ingresa el usuario; la IA solo identifica

- **Estado:** Aceptada (2026-11-19)

## Contexto
Estimar el peso de una porción a partir de una foto tiene errores grandes (fácilmente ±30–50 %), lo que anula la utilidad del conteo de calorías.

## Decisión
La cantidad (g, ml o porción casera con su equivalencia en gramos) siempre la ingresa el usuario. La IA (fase 5) solo sugiere *qué* alimento es, y el usuario confirma.

## Consecuencias
- (+) La exactitud depende de los datos y de una balanza de cocina, no de la IA.
- (+) La IA puede incorporarse sin bloquear el MVP.
- (−) Más fricción al registrar; se mitiga con porciones caseras, recientes, favoritos y recetas.
