import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PasswordUpdateForm } from "./password-update-form";

export const metadata: Metadata = { title: "Contraseña" };

/** Definir o cambiar la contraseña (también es el destino del enlace de recuperación). */
export default function PasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <div>
        <Link
          href="/perfil"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> Perfil
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Contraseña</h1>
        <p className="text-muted-foreground text-sm">
          Elige una contraseña para entrar con tu email sin esperar un enlace.
        </p>
      </div>
      <PasswordUpdateForm />
    </main>
  );
}
