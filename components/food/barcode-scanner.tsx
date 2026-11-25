"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isValidBarcode, normalizeBarcode } from "@/lib/food/barcode";

type Props = { onDetect: (code: string) => void };

type Status =
  { kind: "starting" } | { kind: "scanning" } | { kind: "error"; message: string };

/** Subconjunto de la API nativa BarcodeDetector (aún no está en los tipos de DOM). */
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type NativeDetectorCtor = new (opts: { formats: string[] }) => NativeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a"];

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "No tenemos permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código a mano.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No encontramos una cámara en este dispositivo. Escribe el código a mano.";
  if (name === "NotReadableError")
    return "La cámara está en uso por otra aplicación. Ciérrala o escribe el código a mano.";
  return "No pudimos abrir la cámara. Escribe el código a mano.";
}

/**
 * Lee códigos de barras con la cámara trasera. Usa BarcodeDetector nativo si existe y,
 * si no (p. ej. iOS Safari), @zxing/browser cargado bajo demanda. Solo avisa de códigos
 * con dígito verificador válido. Libera la cámara al desmontarse.
 */
export default function BarcodeScanner({ onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  const [status, setStatus] = useState<Status>({ kind: "starting" });

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() =>
        setStatus({
          kind: "error",
          message: window.isSecureContext
            ? "Este navegador no permite usar la cámara. Escribe el código a mano."
            : "La cámara solo funciona en una conexión segura (HTTPS). Escribe el código a mano.",
        }),
      );
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopZxing: (() => void) | undefined;

    const found = (raw: string) => {
      const code = normalizeBarcode(raw);
      if (cancelled || !isValidBarcode(code)) return false;
      cancelled = true;
      onDetectRef.current(code);
      return true;
    };

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    };

    async function startNative(Detector: NativeDetectorCtor) {
      const detector = new Detector({ formats: FORMATS });
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video!.srcObject = stream;
      await video!.play();
      setStatus({ kind: "scanning" });
      const tick = async () => {
        if (cancelled) return;
        try {
          const codes = await detector.detect(video!);
          if (codes.some((c) => found(c.rawValue))) return;
        } catch {
          // Un fotograma que falla no detiene el escaneo.
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    }

    async function startZxing() {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] =
        await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      if (cancelled) return;
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
      ]);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 200,
      });
      const controls = await reader.decodeFromConstraints(constraints, video!, (r) => {
        if (r) found(r.getText());
      });
      if (cancelled) {
        controls.stop();
        return;
      }
      stopZxing = () => controls.stop();
      setStatus({ kind: "scanning" });
    }

    const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor })
      .BarcodeDetector;
    (Native ? startNative(Native) : startZxing()).catch((error: unknown) => {
      if (!cancelled) setStatus({ kind: "error", message: cameraErrorMessage(error) });
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      if (video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((t) => t.stop());
      }
      video.srcObject = null;
    };
  }, []);

  if (status.kind === "error") {
    return (
      <div
        role="alert"
        className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg p-3 text-sm"
      >
        <CameraOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{status.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className="size-full object-cover"
          aria-label="Vista de la cámara para escanear el código de barras"
        />
        <div
          className="pointer-events-none absolute inset-x-[10%] top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80"
          aria-hidden
        />
      </div>
      <p className="text-muted-foreground flex items-center gap-1 text-sm" role="status">
        <Camera className="size-4" aria-hidden />
        {status.kind === "starting"
          ? "Abriendo la cámara…"
          : "Apunta al código de barras del envase."}
      </p>
    </div>
  );
}
