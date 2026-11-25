import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">FitApp</h1>
        <p className="text-muted-foreground text-sm">
          Entra con tu contraseña o con un enlace a tu email.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
