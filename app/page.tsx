import { Activity, ChartLine, House, Scale, Search, User, Utensils } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Dashboard } from "@/components/dashboard/dashboard";
import { UserMenu } from "@/components/auth/user-menu";
import { ProfileGate } from "@/components/profile/profile-gate";

const navItems = [
  { label: "Hoy", icon: House },
  { label: "Comidas", icon: Utensils, href: "/comidas" },
  { label: "Alimentos", icon: Search, href: "/alimentos" },
  { label: "Ejercicio", icon: Activity, href: "/ejercicio" },
  { label: "Peso", icon: Scale, href: "/peso" },
  { label: "Gráficos", icon: ChartLine, href: "/tendencias" },
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-end justify-between gap-2 border-b px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
        <div>
          <p className="text-muted-foreground text-sm">Balance de hoy</p>
          <h1 className="text-2xl font-semibold tracking-tight">FitApp</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/perfil"
            aria-label="Perfil y meta"
            className="hover:bg-muted flex size-8 items-center justify-center rounded-lg"
          >
            <User className="size-4" aria-hidden />
          </Link>
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <Suspense>
        <ProfileGate />
      </Suspense>

      <main className="flex flex-1 flex-col gap-4 p-4">
        <Suspense>
          <Dashboard />
        </Suspense>
        <p className="text-muted-foreground text-xs">
          FitApp entrega estimaciones y no reemplaza la indicación de un profesional de la
          salud.
        </p>
      </main>

      <nav
        aria-label="Navegación principal"
        className="bg-background sticky bottom-0 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-6">
          {navItems.map((item) => {
            const { label, icon: Icon } = item;
            const className =
              "text-muted-foreground flex flex-col items-center gap-1 py-2 text-xs";
            const content = (
              <>
                <Icon className="size-5" aria-hidden />
                {label}
              </>
            );
            return (
              <li key={label}>
                {"href" in item ? (
                  <Link href={item.href} className={`${className} hover:text-foreground`}>
                    {content}
                  </Link>
                ) : (
                  <span className={className}>{content}</span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
