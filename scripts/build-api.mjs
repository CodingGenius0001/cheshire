// Bundles the Express server (server/src/index.ts) into .vercel-api/index.js for Vercel.
// Vercel then runs plain JavaScript, so its TypeScript build (which can't resolve
// @types/node in this workspace layout) is skipped. Deploy: node scripts/build-api.mjs,
// then `npx vercel deploy --prod` from .vercel-api/ (linked to the cheshire-api project).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../.vercel-api/', import.meta.url);
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [new URL('../server/src/index.ts', import.meta.url).pathname],
  outfile: new URL('index.js', out).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Express and friends are CommonJS; give the ESM bundle a require() for them.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  // Vercel finds the Express entrypoint by its `import express`, so Express stays external.
  external: ['express'],
  logLevel: 'info',
});

writeFileSync(new URL('package.json', out), JSON.stringify({ private: true, type: 'module', dependencies: { express: '^5.3.0' } }, null, 2) + '\n');
writeFileSync(new URL('vercel.json', out), JSON.stringify({ framework: 'express' }, null, 2) + '\n');
