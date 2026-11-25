import Link from "next/link";

import { CREDITS_PATH, getSourceInfo, ODBL_URL, OFF_URL } from "@/lib/food/attribution";

/**
 * Indica la fuente de un alimento según `food.source` y, para Open Food Facts,
 * el texto de atribución ODbL con enlaces a la licencia y al proyecto.
 *
 * Debe usarse en toda pantalla que muestre un alimento:
 * - #15 (búsqueda de alimentos)
 * - #16 (registro de comidas)
 * - #24 (escaneo de código de barras)
 */
export function FuenteAlimento({ source }: { source: string }) {
  const info = getSourceInfo(source);
  const linkClass = "underline underline-offset-2";

  return (
    <p className="text-muted-foreground text-xs" data-slot="fuente-alimento">
      <span>Fuente: {info?.label ?? source}.</span>{" "}
      {info?.odbl && (
        <span>
          {info.attribution}{" "}
          <a
            href={OFF_URL}
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sitio de Open Food Facts
          </a>
          {" · "}
          <a
            href={ODBL_URL}
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            Licencia ODbL 1.0
          </a>
          {" · "}
        </span>
      )}
      <Link href={CREDITS_PATH} className={linkClass}>
        Fuentes y créditos
      </Link>
    </p>
  );
}
