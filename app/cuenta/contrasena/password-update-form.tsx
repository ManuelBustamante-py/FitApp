"use client";

import Link from "next/link";
import { useActionState } from "react";

import { updatePassword, type PasswordFormState } from "@/app/auth/password-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { PASSWORD_MIN } from "@/lib/auth/password";

const initialState: PasswordFormState = { status: "idle" };

const inputClass =
  "border-input focus-visible:ring-ring h-11 rounded-md border bg-transparent px-3 text-base outline-none focus-visible:ring-2";

export function PasswordUpdateForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  if (state.status === "info") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-lg border p-4 text-sm">
          {state.message}
        </p>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-sm font-medium">
        Contraseña nueva
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={PASSWORD_MIN}
        autoComplete="new-password"
        placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
        className={inputClass}
      />
      <label htmlFor="confirm" className="text-sm font-medium">
        Repite la contraseña
      </label>
      <input
        id="confirm"
        name="confirm"
        type="password"
        required
        autoComplete="new-password"
        className={inputClass}
      />
      {state.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
