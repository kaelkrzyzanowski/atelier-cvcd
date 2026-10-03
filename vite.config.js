import { defineConfig } from 'vite';

// Chemins relatifs : l'app est servie par Capacitor depuis les fichiers embarqués dans l'APK.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
