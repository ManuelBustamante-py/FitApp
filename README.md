# FitApp

Plataforma web instalable en el celular (PWA) para llevar el **balance calórico diario**: lo que se come, lo que se gasta en el ejercicio y cómo evoluciona el peso y el IMC hacia una meta saludable.

> FitApp entrega **estimaciones** y no reemplaza la indicación de un profesional de la salud.

## Funcionalidades previstas

| Módulo | Qué hace |
|---|---|
| Perfil y cuerpo | Registro de peso, IMC (kg/m²), metabolismo basal y gasto diario estimado, meta de peso |
| Ejercicio | Registro de sesiones (máquina, minutos, distancia, kcal de la máquina, pulso promedio, mínimo y máximo) y estimación propia del gasto según pulso y MET |
| Alimentación | Búsqueda de alimentos (USDA, Open Food Facts, tabla chilena), registro por **gramos o ml**, recetas propias, código de barras |
| Balance | Déficit o superávit diario y semanal, tendencias y proyección hacia la meta |
| IA (fase posterior) | Identificar el alimento a partir de una foto o de texto libre; el usuario siempre confirma los gramos |

## Stack

Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Tailwind CSS · Vercel. Detalle en [docs/05-arquitectura.md](docs/05-arquitectura.md).

## Desarrollo

Requiere Node.js 22 o superior.

```bash
npm install
cp .env.example .env.local   # completar con la URL y la publishable key de Supabase
npm run dev                  # http://localhost:3000
```

### Supabase (Auth por enlace mágico)

En el panel del proyecto:

1. **Authentication → URL Configuration**: *Site URL* = la URL de producción; en *Redirect URLs* agregar `http://localhost:3000/**` y la URL de Vercel (`https://<app>.vercel.app/**`).
2. *(Opcional; Supabase exige SMTP propio para editar plantillas)* **Authentication → Emails → Magic Link**: cambiar el enlace de la plantilla por
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   (`RedirectTo` ya trae `/auth/confirm?next=…`; por eso la URL debe estar en *Redirect URLs*). Así funciona aunque el correo se abra en otro navegador o en la app de correo. Sin este cambio también funciona (flujo PKCE), pero solo en el mismo navegador donde se pidió el enlace.
3. Para regenerar los tipos (`npm run db:types`) hay que iniciar sesión una vez con `npx supabase login`.

| Script | Qué hace |
|---|---|
| `npm run build` / `npm start` | Build de producción y servidor (el service worker solo se registra en producción) |
| `npm run lint` | ESLint (config de Next + Prettier) |
| `npm run typecheck` | Genera los tipos de rutas y corre `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier (con orden de clases de Tailwind) |
| `npm run icons` | Regenera los íconos de la PWA desde `scripts/icons/icon.svg` |

Componentes de UI: shadcn/ui (`npx shadcn@latest add <componente>`).

## Documentación

| # | Documento |
|---|---|
| 01 | [Visión y alcance](docs/01-vision-y-alcance.md) |
| 02 | [Requisitos e historias de usuario](docs/02-requisitos.md) |
| 03 | [Cálculos y fórmulas](docs/03-calculos-y-formulas.md) |
| 04 | [Fuentes de datos nutricionales](docs/04-fuentes-de-datos.md) |
| 05 | [Arquitectura](docs/05-arquitectura.md) |
| 06 | [Modelo de datos](docs/06-modelo-de-datos.md) |
| 07 | [Roadmap](docs/07-roadmap.md) |
| — | [Diagramas UML (PlantUML)](docs/uml/) · [Decisiones de arquitectura (ADR)](docs/adr/) |

La gestión de tareas está en el tablero **FitApp** de Gesti.
