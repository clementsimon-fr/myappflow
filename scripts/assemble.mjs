// Assemble le site final dans dist/ : la vitrine statique (inchangée) + le portail déjà construit dans dist/espace.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const STATIC = ['index.html', 'css', 'js', 'images', 'manifest.webmanifest', 'sw.js', 'myappflow-qrcode.png'];
mkdirSync('dist', { recursive: true });
for (const entry of STATIC) {
  if (existsSync(entry)) cpSync(entry, `dist/${entry}`, { recursive: true });
}
if (!existsSync('dist/espace/index.html')) {
  console.error('dist/espace/index.html manquant : le portail ne s\'est pas construit.');
  process.exit(1);
}
console.log('Site assemblé dans dist/');
