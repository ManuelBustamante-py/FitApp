"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import {
  sendMagicLink,
  verifyPastedLink,
  type MagicLinkState,
  type PasteLinkState,
} from "@/app/auth/actions";
import {
  requestPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  type PasswordFormState,
} from "@/app/auth/password-actions";
import { Button } from "@/components/ui/button";
import { magicLinkErrorMessage } from "@/lib/auth/magic-link";
import { PASSWORD_MIN } from "@/lib/auth/password";

const initialState: MagicLinkState = { status: "idle" };
const initialPasteState: PasteLinkState = { status: "idle" };
const initialPasswordState: PasswordFormState = { status: "idle" };

const inputClass =
  "border-input focus-visible:ring-ring h-11 rounded-md border bg-transparent px-3 text-base outline-none focus-visible:ring-2";

type Mode = "contrasena" | "enlace";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const linkError = searchParams.get("error");
  const [mode, setMode] = useState<Mode>("contrasena");

  return (
    <div className="flex flex-col gap-6">
      {linkError && (
        <p role="alert" className="text-destructive text-sm">
          {magicLinkErrorMessage(linkError)}
        </p>
      )}
      <div
        role="tablist"
        aria-label="Forma de entrar"
        className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
      >
        {(
          [
            ["contrasena", "Contraseña"],
            ["enlace", "Enlace por email"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === value ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "contrasena" ? (
        <PasswordForm next={next} />
      ) : (
        <MagicLinkForm next={next} />
      )}
      <PasteLinkForm next={next} />
    </div>
  );
}

function Message({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "error") {
    return (
      <p role="alert" className="text-destructive text-sm">
        {state.message}
      </p>
    );
  }
  if (state.status === "info") {
    return (
      <p role="status" className="rounded-lg border p-3 text-sm">
        {state.message}
      </p>
    );
  }
  return null;
}

function EmailInput() {
  return (
    <>
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
    </>
  );
}

/** Entrar o crear cuenta con email y contraseña; también recuperar la contraseña. */
function PasswordForm({ next }: { next: string }) {
  const [creating, setCreating] = useState(false);
  const [signInState, signInAction, signingIn] = useActionState(
    signInWithPassword,
    initialPasswordState,
  );
  const [signUpState, signUpAction, signingUp] = useActionState(
    signUpWithPassword,
    initialPasswordState,
  );
  const [resetState, resetAction, resetting] = useActionState(
    requestPasswordReset,
    initialPasswordState,
  );
  const pending = signingIn || signingUp || resetting;

  return (
    <form action={creating ? signUpAction : signInAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <EmailInput />
      <label htmlFor="password" className="text-sm font-medium">
        Contraseña
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        minLength={creating ? PASSWORD_MIN : undefined}
        autoComplete={creating ? "new-password" : "current-password"}
        placeholder={creating ? `Mínimo ${PASSWORD_MIN} caracteres` : undefined}
        className={inputClass}
      />
      <Message state={creating ? signUpState : signInState} />
      <Message state={resetState} />
      <Button type="submit" size="lg" disabled={pending}>
        {creating
          ? signingUp
            ? "Creando cuenta…"
            : "Crear cuenta"
          : signingIn
            ? "Entrando…"
            : "Entrar"}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="text-primary underline-offset-4 hover:underline"
        >
          {creating ? "Ya tengo cuenta" : "Crear una cuenta"}
        </button>
        {!creating && (
          <button
            type="submit"
            formAction={resetAction}
            formNoValidate
            disabled={pending}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {resetting ? "Enviando…" : "¿Olvidaste tu contraseña?"}
          </button>
        )}
      </div>
    </form>
  );
}

/** Entrar sin contraseña, con un enlace al email. */
function MagicLinkForm({ next }: { next: string }) {
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
      <input type="hidden" name="next" value={next} />
      <EmailInput />
      <Message state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Enviando…" : "Enviarme el enlace"}
      </Button>
    </form>
  );
}

/**
 * Alternativa al toque en el enlace: pegarlo en la app. Funciona aunque el correo
 * lo abra en otro navegador y dentro de la app instalada (PWA).
 */
function PasteLinkForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(
    verifyPastedLink,
    initialPasteState,
  );

  return (
    <details open={state.status === "error"} className="text-sm">
      <summary className="text-muted-foreground cursor-pointer">
        ¿El enlace del correo se abre en otra app? Pégalo aquí
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
