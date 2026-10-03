// Génère l'icône de l'application (ventilateur dans une gaine circulaire, fond bleu canard) et l'écran de démarrage.
// Sorties : public/favicon.png (navigateur) et assets/*.png, sources de `capacitor-assets generate --android`.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#0c6873';
const BG_DARK = '#0e1518';
const PNG = { compressionLevel: 9 };

/** Motif centré sur (0,0), rayon utile 400 : gaine circulaire, 4 pales courbes, moyeu. */
function motif(fg = '#ffffff') {
  const blade = 'M0,-70 C70,-110 230,-150 250,-260 C170,-330 40,-300 -20,-210 C-45,-160 -40,-100 0,-70 Z';
  const blades = [0, 90, 180, 270].map((a) => `<path d="${blade}" transform="rotate(${a})" fill="${fg}"/>`).join('');
  return `<circle r="370" fill="none" stroke="${fg}" stroke-width="44"/>
    <circle r="300" fill="none" stroke="${fg}" stroke-width="10" stroke-opacity=".45"/>
    ${blades}
    <circle r="78" fill="${fg}"/><circle r="34" fill="${BG}"/>`;
}

/** SVG carré de `size` px : fond éventuel + motif réduit à `scale` (part du côté occupée par le diamètre du motif). */
function svg(size, scale, bg) {
  const k = (size * scale) / 800;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    <g transform="translate(${size / 2} ${size / 2}) scale(${k})">${motif()}</g></svg>`);
}
const png = (size, scale, bg) => sharp(svg(size, scale, bg)).png(PNG);

async function main() {
  const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
  mkdirSync(at('../public/'), { recursive: true });
  mkdirSync(at('../assets/'), { recursive: true });

  await png(192, 0.72, BG).toFile(at('../public/favicon.png'));
  await png(512, 0.72, BG).toFile(at('../public/icon-512.png'));

  await png(1024, 0.72, BG).toFile(at('../assets/icon-only.png')); // icône classique (anciens Android)
  await png(1024, 0.56, null).toFile(at('../assets/icon-foreground.png')); // icône adaptative : zone sûre ~66 %
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png(PNG).toFile(at('../assets/icon-background.png'));
  await png(2732, 0.22, BG).toFile(at('../assets/splash.png'));
  await png(2732, 0.22, BG_DARK).toFile(at('../assets/splash-dark.png'));
  console.log('Icônes générées : public/favicon.png, public/icon-512.png, assets/*.png');
}

main();
