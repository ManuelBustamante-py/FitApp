"use client";

import { Pencil, Play, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import {
  deleteTemplate,
  saveTemplate,
  registerFromTemplate,
  type TemplateFormState,
  type RegisterFromTemplateState,
} from "@/app/ejercicio/template-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ACTIVITY_CATEGORY_LABELS, KCAL_METHOD_LABELS } from "@/lib/workout/context";
import { TEMPLATE_NAME_MAX } from "@/lib/workout/template";

import type { ActivityOption } from "./workout-form";

export interface TemplateItem {
  id: string;
  name: string;
  activity_type_id: number;
  duration_min: number;
  activity_type: { name_es: string } | null;
}

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

const IDLE_FORM: TemplateFormState = { status: "idle" };
const IDLE_USE: RegisterFromTemplateState = { status: "idle" };

function TemplateFields({
  idPrefix,
  activities,
  state,
  defaults,
}: {
  idPrefix: string;
  activities: ActivityOption[];
  state: TemplateFormState;
  defaults?: TemplateItem;
}) {
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const categories = Array.from(new Set(activities.map((a) => a.category)));
  return (
    <>
      <Field id={`${idPrefix}-name`} label="Nombre" error={errors.name}>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          maxLength={TEMPLATE_NAME_MAX}
          autoComplete="off"
          placeholder="Spinning 20 min"
          defaultValue={defaults?.name}
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>
      <Field id={`${idPrefix}-activity`} label="Actividad" error={errors.activityTypeId}>
        <Select
          id={`${idPrefix}-activity`}
          name="activityTypeId"
          defaultValue={defaults?.activity_type_id ?? ""}
          aria-invalid={errors.activityTypeId ? true : undefined}
        >
          <option value="" disabled>
            Elige una actividad
          </option>
          {categories.map((category) => (
            <optgroup
              key={category}
              label={ACTIVITY_CATEGORY_LABELS[category] ?? category}
            >
              {activities
                .filter((a) => a.category === category)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_es}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <Field
        id={`${idPrefix}-duration`}
        label="Duración (min)"
        error={errors.durationMin}
      >
        <Input
          id={`${idPrefix}-duration`}
          name="durationMin"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="20"
          defaultValue={defaults ? String(defaults.duration_min).replace(".", ",") : ""}
          aria-invalid={errors.durationMin ? true : undefined}
        />
      </Field>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-destructive text-sm">
          {state.message}
        </p>
      ) : null}
    </>
  );
}

/** Formulario para crear una plantilla desde cero. */
export function NewTemplateForm({ activities }: { activities: ActivityOption[] }) {
  const [state, action, pending] = useActionState(saveTemplate, IDLE_FORM);
  return (
    <details className="rounded-lg border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Nueva plantilla</summary>
      <form
        // Se remonta al guardar para limpiar los campos.
        key={state.status === "saved" ? "saved" : "form"}
        action={action}
        noValidate
        className="mt-3 flex flex-col gap-3"
      >
        <TemplateFields idPrefix="new-template" activities={activities} state={state} />
        {state.status === "saved" ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            Plantilla guardada.
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar plantilla"}
        </Button>
      </form>
    </details>
  );
}

function TemplateRow({
  template,
  activities,
  canRegister,
}: {
  template: TemplateItem;
  activities: ActivityOption[];
  canRegister: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [useResult, useAction, usePending] = useActionState(
    registerFromTemplate,
    IDLE_USE,
  );
  const [editState, editAction, editPending] = useActionState(saveTemplate, IDLE_FORM);

  return (
    <li className="flex flex-col gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{template.name}</p>
          <p className="text-muted-foreground text-xs">
            {template.activity_type?.name_es ?? "Actividad"} ·{" "}
            {nf1.format(template.duration_min)} min
          </p>
        </div>
        <form action={useAction}>
          <input type="hidden" name="id" value={template.id} />
          <Button
            type="submit"
            size="sm"
            className="h-9 px-3"
            disabled={usePending || !canRegister}
            aria-label={`Registrar ${template.name} hoy`}
          >
            <Play aria-hidden /> {usePending ? "Registrando…" : "Registrar"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          aria-label={`Editar ${template.name}`}
          aria-expanded={editing}
          className="hover:bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <form
          action={deleteTemplate}
          onSubmit={(event) => {
            if (!window.confirm(`¿Eliminar la plantilla «${template.name}»?`))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={template.id} />
          <button
            type="submit"
            aria-label={`Eliminar ${template.name}`}
            className="hover:bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </form>
      </div>

      {useResult.status === "saved" ? (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          Sesión registrada hoy: ≈ {nf0.format(useResult.summary.selectedKcal)} kcal (
          {KCAL_METHOD_LABELS[useResult.summary.method].toLowerCase()}), ≈{" "}
          {nf0.format(useResult.summary.netKcal)} netas.
        </p>
      ) : null}
      {useResult.status === "error" ? (
        <p role="alert" className="text-destructive text-xs">
          {useResult.message}
        </p>
      ) : null}

      {editing ? (
        <form action={editAction} noValidate className="flex flex-col gap-3 pt-1">
          <input type="hidden" name="id" value={template.id} />
          <TemplateFields
            idPrefix={`edit-${template.id}`}
            activities={activities}
            state={editState}
            defaults={template}
          />
          {editState.status === "saved" ? (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              Cambios guardados.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={editPending}>
              {editPending ? "Guardando…" : "Guardar cambios"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cerrar
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function TemplateList({
  templates,
  activities,
  canRegister,
}: {
  templates: TemplateItem[];
  activities: ActivityOption[];
  /** false si aún no hay peso: sin él no se puede estimar. */
  canRegister: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {templates.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Sin plantillas. Marca «Guardar como plantilla» al registrar una sesión o crea
          una nueva.
        </p>
      ) : (
        <>
          {canRegister ? null : (
            <p className="text-muted-foreground text-xs">
              Registra tu peso para poder registrar sesiones con un toque.
            </p>
          )}
          <ul className="divide-y rounded-lg border">
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                activities={activities}
                canRegister={canRegister}
              />
            ))}
          </ul>
        </>
      )}
      <NewTemplateForm activities={activities} />
    </div>
  );
}
