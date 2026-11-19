"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { sendMagicLink, type MagicLinkState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

const initialState: MagicLinkState = { status: "idle" };

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const linkError = searchParams.get("error") === "enlace";
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg border p-4 text-sm">
        Revisa <strong>{state.email}</strong> y abre el enlace para entrar. Puede tardar
        un minuto; mira también en spam.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {linkError && (
        <p role="alert" className="text-destructive text-sm">
          El enlace no es válido o ya venció. Pide uno nuevo.
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="tu@email.com"
        className="border-input focus-visible:ring-ring h-11 rounded-md border bg-transparent px-3 text-base outline-none focus-visible:ring-2"
      />
      {state.status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </Button>
    </form>
  );
}
