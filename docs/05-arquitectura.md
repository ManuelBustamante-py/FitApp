# 05 · Arquitectura

## Vista general

```
[Celular / navegador (PWA)]
      │  HTTPS
      ▼
[Next.js en Vercel]  ── Server Components / Route Handlers / Server Actions
      │                    ├─ lib/calc  (fórmulas puras)
      │                    └─ lib/ai    (visión, fase 5)
      ▼
[Supabase]
  ├─ Auth (email)
  ├─ Postgres (RLS, pg_trgm, unaccent) ← scripts de ingesta (USDA, OFF, tabla chilena)
  └─ Storage (fotos de comidas, fase 5)
```
Diagramas: [uml/componentes.puml](uml/componentes.puml), [uml/despliegue.puml](uml/despliegue.puml).

## Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (App Router) + React + TypeScript | Un solo proyecto para la interfaz y el servidor; despliegue simple |
| Estilos / UI | Tailwind CSS + shadcn/ui | Mobile-first y rápido de construir |
| Gráficos | Recharts | Tendencias de peso, déficit y ejercicio |
| PWA | Manifest (`app/manifest.ts`) + service worker mínimo; Serwist en la fase 6 | Instalable desde F0; caché offline en la fase 6 |
| Datos | Supabase Postgres | SQL, RLS por usuario, búsqueda de texto, plan gratuito |
| Auth | Supabase Auth | Enlace mágico por email |
| Validación | Zod | Mismos esquemas en el formulario y el servidor |
| Pruebas | Vitest (unitarias) + Playwright (E2E) | Las fórmulas se prueban contra valores de referencia |
| CI/CD | GitHub Actions + Vercel | Lint, pruebas y preview por PR |
| IA (fase 5) | API de Claude (visión) | Identificar alimentos a partir de una foto o texto |

## Estructura del repositorio (propuesta)

```
app/                    rutas (dashboard, registro, alimentos, ejercicio, perfil)
components/             UI
lib/calc/               imc, bmr, tdee, ejercicio, balance, proyección (+ tests)
lib/db/                 cliente Supabase, consultas tipadas
lib/ai/                 reconocimiento (fase 5)
supabase/migrations/    SQL versionado (esquema, RLS, índices)
scripts/ingest/         ETL de USDA, Open Food Facts y tabla chilena
docs/                   esta documentación
```

## Decisiones clave (ADR)

- [ADR-0001](adr/0001-pwa-nextjs.md) · PWA con Next.js en vez de una app nativa
- [ADR-0002](adr/0002-supabase.md) · Supabase como base de datos, autenticación y almacenamiento
- [ADR-0003](adr/0003-base-alimentos-propia.md) · Base de alimentos propia, importada de fuentes abiertas
- [ADR-0004](adr/0004-gramos-ingresados-por-usuario.md) · Los gramos los ingresa el usuario; la IA solo identifica
- [ADR-0005](adr/0005-tmb-y-actividad-configurables.md) · TMB y actividad cotidiana configurables por día

## Seguridad y privacidad
- RLS en todas las tablas con `user_id`; las tablas de alimentos públicos son de solo lectura para los usuarios.
- `service_role` solo en los scripts de ingesta y en el servidor, nunca en el cliente.
- Datos de salud: mínima recolección, eliminación de la cuenta en cascada y sin compartir con terceros. Antes de abrir el registro al público: política de privacidad y revisión según la Ley 19.628 y la Ley 21.719.
- Fotos (fase 5): bucket privado y URLs firmadas.

## Calidad
- TypeScript `strict`, ESLint y Prettier.
- Cobertura ≥ 90 % en `lib/calc`.
- Cada PR: lint, pruebas y build en CI, más un preview en Vercel.
