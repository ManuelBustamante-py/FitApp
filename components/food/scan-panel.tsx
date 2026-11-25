"use client";

import { ScanBarcode } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { isValidBarcode, normalizeBarcode } from "@/lib/food/barcode";

const INVALID_MESSAGE =
  "Ese código no es válido. Revisa que tenga 8, 12, 13 o 14 dígitos y que no falte ninguno.";

// La cámara solo existe en el cliente y su código (zxing) pesa: carga perezosa.
const BarcodeScanner = dynamic(() => import("./barcode-scanner"), {
  ssr: false,
  loading: () => (
    <p className="text-muted-foreground text-sm" role="status">
      Cargando el lector…
    </p>
  ),
});

/** Cámara + campo manual. Con un código válido navega a la búsqueda por código. */
export function ScanPanel({ initialError }: { initialError?: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(
    initialError ? INVALID_MESSAGE : null,
  );

  const go = (code: string) => router.push(`/alimentos/escanear?codigo=${code}`);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const code = normalizeBarcode(manual);
    if (!isValidBarcode(code)) {
      setError(INVALID_MESSAGE);
      return;
    }
    setError(null);
    go(code);
  }

  return (
    <div className="flex flex-col gap-5">
      {active ? (
        <div className="flex flex-col gap-2">
          <BarcodeScanner onDetect={go} />
          <button
            type="button"
            onClick={() => setActive(false)}
            className="text-muted-foreground self-start text-sm underline underline-offset-2"
          >
            Cerrar la cámara
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
        >
          <ScanBarcode className="size-4" aria-hidden /> Abrir la cámara
        </button>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor="codigo" className="text-sm font-medium">
          O escribe el código
        </label>
        <div className="flex gap-2">
          <input
            id="codigo"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              setError(null);
            }}
            placeholder="Ej.: 7802900123456"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "codigo-error" : undefined}
            className="border-input bg-background h-10 min-w-0 flex-1 rounded-lg border px-3 text-base"
          />
          <button
            type="submit"
            className="bg-secondary text-secondary-foreground h-10 rounded-lg px-4 text-sm font-medium"
          >
            Buscar
          </button>
        </div>
        {error ? (
          <p id="codigo-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
