import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileInkFile } from './scripts/compileInk.ts';

// Imports of *.ink return the compiled ink JSON as a string. Every .ink file is
// watched, so editing any chapter recompiles the story in dev.
function inkPlugin(): Plugin {
  return {
    name: 'ink',
    transform(_code, id) {
      if (!id.endsWith('.ink')) return null;
      const dir = resolve(id, '..');
      for (const f of readdirSync(dir)) if (f.endsWith('.ink')) this.addWatchFile(resolve(dir, f));
      const json = compileInkFile(id);
      return { code: `export default ${JSON.stringify(json)};`, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [inkPlugin(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    // Images stay as files in dist/assets (copied from public/), fonts + story + code are inlined.
    copyPublicDir: true,
  },
});
