// Genera los íconos PNG de la PWA a partir de scripts/icons/icon.svg.
// Uso: npm run icons
import { readFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const svgPath = path.join(here, "icon.svg");
const svg = await readFile(svgPath);
const outDir = path.join(root, "public", "icons");
await mkdir(outDir, { recursive: true });

const render = (size) => sharp(svg, { density: 384 }).resize(size, size);

await render(192).png().toFile(path.join(outDir, "icon-192.png"));
await render(512).png().toFile(path.join(outDir, "icon-512.png"));

// Maskable: el ícono ocupa el 80 % central (zona segura) sobre fondo lleno.
const inner = await render(410).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#059669" },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(path.join(outDir, "icon-maskable-512.png"));

// Convenciones de archivo de Next: favicon SVG y ícono de iOS.
await copyFile(svgPath, path.join(root, "app", "icon.svg"));
await render(180)
  .flatten({ background: "#059669" })
  .png()
  .toFile(path.join(root, "app", "apple-icon.png"));

console.log("Íconos generados en public/icons y app/");
