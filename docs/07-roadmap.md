# 07 · Roadmap

Las tareas viven en el tablero **FitApp** de Gesti; aquí está la visión por fases. Las estimaciones están en story points (escala Fibonacci).

| Fase | Objetivo | Entregable |
|---|---|---|
| **F0 · Fundaciones** | Repositorio, documentación, proyecto base y CI | App vacía desplegada en Vercel con inicio de sesión |
| **F1 · Cuerpo** | Perfil, peso, IMC, BMR/TDEE y meta | Registrar el peso y ver el IMC y la meta |
| **F2 · Ejercicio** | Sesiones con estimación por pulso y MET | Registrar el spinning y ver las kcal reales estimadas |
| **F3 · Alimentación** | Base de alimentos, búsqueda y registro por gramos | Registrar todas las comidas del día |
| **F4 · Balance** | Panel diario, gráficos y proyección | Saber cada día si hubo déficit y cuánto |
| **F5 · IA y código de barras** | Foto o texto → alimento; escaneo | Registrar más rápido |
| **F6 · Expansión** | Offline, TDEE adaptativo, wearables, apertura pública | Producto para más usuarios |

**MVP usable = F0 + F1 + F2 + F3 (núcleo) + F4 (panel).**

## Ruta crítica
```
Setup → Esquema y RLS → Perfil y peso → Fórmulas → Ejercicio ─┐
                     └→ Ingesta de alimentos → Búsqueda → Registro de comidas ─┴→ Balance diario → Panel
```

## Definición de terminado (DoD)
- Código en `main` mediante PR, con CI en verde.
- Pruebas para la lógica nueva (fórmulas = valores de referencia del documento 03).
- Migraciones SQL versionadas, con RLS cuando aplica.
- Funciona en el celular (viewport de 375 px).
- Documentación actualizada si cambia una decisión.
