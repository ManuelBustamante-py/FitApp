"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import {
  sendMagicLink,
  verifyPastedLink,
  type MagicLinkState,
  type PasteLinkState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { magicLinkErrorMessage } from "@/lib/auth/magic-link";

const initialState: MagicLinkState = { status: "idle" };
const initialPasteState: PasteLinkState = { status: "idle" };

const inputClass =
  "border-input focus-visible:ring-ring h-11 rounded-md border bg-transparent px-3 text-base outline-none focus-visible:ring-2";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const linkError = searchParams.get("error");
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="rounded-lg border p-4 text-sm">
          Revisa <strong>{state.email}</strong> y abre el enlace para entrar. Puede tardar
          un minuto; mira también en spam.
        </div>
        <PasteLinkForm next={next} open />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-3">
        {linkError && (
          <p role="alert" className="text-destructive text-sm">
            {magicLinkErrorMessage(linkError)}
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
          className={inputClass}
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
      <PasteLinkForm next={next} />
    </div>
  );
}

/**
 * Alternativa al toque en el enlace: pegarlo en la app. Funciona aunque el correo
 * lo abra en otro navegador y dentro de la app instalada (PWA).
 */
function PasteLinkForm({ next, open = false }: { next: string; open?: boolean }) {
  const [state, formAction, pending] = useActionState(
    verifyPastedLink,
    initialPasteState,
  );

  return (
    <details open={open || state.status === "error"} className="text-sm">
      <summary className="text-muted-foreground cursor-pointer">
        ¿El enlace se abre en otra app? Pégalo aquí
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <p className="text-muted-foreground">
          En el correo, mantén presionado el botón del enlace, elige «Copiar enlace» (sin
          abrirlo) y pégalo aquí.
        </p>
        <input type="hidden" name="next" value={next} />
        <label htmlFor="link" className="sr-only">
          Enlace del correo
        </label>
        <input
          id="link"
          name="link"
          type="url"
          required
          autoComplete="off"
          placeholder="https://…supabase.co/auth/v1/verify?token=…"
          className={inputClass}
        />
        {state.status === "error" && (
          <p role="alert" className="text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" variant="outline" size="lg" disabled={pending}>
          {pending ? "Entrando…" : "Entrar con el enlace"}
        </Button>
      </form>
    </details>
  );
}
