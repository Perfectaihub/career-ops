#!/usr/bin/env node
/**
 * Generate a branded QR code that points at the live lead-capture form.
 *
 * Usage:
 *   node scripts/gen-qr.mjs [url]
 *   node scripts/gen-qr.mjs https://connect.perfectaihub.com
 *
 * Outputs PNG + SVG into public/qr/. Modules are PerfectAI ink (#0D2626) on
 * white, error-correction level H (survives a logo overlay / print smudges).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/qr');

const url = process.argv[2] || 'https://connect.perfectaihub.com';

const options = {
  errorCorrectionLevel: 'H',
  margin: 2,
  color: {
    dark: '#0D2626',
    light: '#FFFFFF',
  },
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // PNG — high resolution for print.
  const pngPath = resolve(OUT_DIR, 'connect.png');
  await QRCode.toFile(pngPath, url, { ...options, type: 'png', width: 1024 });

  // SVG — infinitely scalable for signage / decks.
  const svgPath = resolve(OUT_DIR, 'connect.svg');
  const svg = await QRCode.toString(url, { ...options, type: 'svg' });
  await writeFile(svgPath, svg, 'utf8');

  console.log(`QR generated for: ${url}`);
  console.log(`  → ${pngPath}`);
  console.log(`  → ${svgPath}`);
}

main().catch((err) => {
  console.error('QR generation failed:', err);
  process.exit(1);
});
