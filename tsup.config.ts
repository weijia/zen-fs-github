import { defineConfig } from 'tsup';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, renameSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Produces a self-contained browser global build exposed as `window.ZenFSGitHub`.
// `@zenfs/core` and `kerium` are bundled in (noExternal) so the IIFE does not
// rely on a runtime require/import of peer deps in the browser — matching how
// zen-fs-gitee's .global.js is built.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  globalName: 'ZenFSGitHub',
  outfile: resolve(__dirname, 'dist/zen-fs-github.global.js'),
  clean: false, // keep tsc's emitted .js / .d.ts in dist
  dts: false,
  sourcemap: true,
  target: 'es2020',
  minify: false,
  noExternal: ['@zenfs/core', 'kerium'],
  // tsup may fall back to <entryBasename>.global.js; normalize the name here.
  onSuccess: () => {
    if (existsSync('dist/index.global.js')) {
      renameSync('dist/index.global.js', 'dist/zen-fs-github.global.js');
      if (existsSync('dist/index.global.js.map')) {
        renameSync('dist/index.global.js.map', 'dist/zen-fs-github.global.js.map');
      }
    }
  },
});
