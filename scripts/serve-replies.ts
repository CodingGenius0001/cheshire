/*
 * Standalone POST /api/replies for testing the reply engine without the full Express server.
 *   npx tsx scripts/serve-replies.ts      (from the repo root; reads ./.env like the server does)
 * Listens on REPLIES_PORT (default 8787). Uses node:http only, so it needs no extra packages.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateReplies, RepliesError } from '../server/src/replies';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.REPLIES_PORT ?? 8787);

createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/api/replies') {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const started = Date.now();
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const result = await generateReplies(body);
    console.log(`[replies] ${Date.now() - started} ms`);
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
  } catch (err) {
    const status = err instanceof RepliesError ? err.status : err instanceof SyntaxError ? 400 : 502;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[replies] failed after ${Date.now() - started} ms: ${message}`);
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: message }));
  }
}).listen(PORT, () => console.log(`reply engine on http://localhost:${PORT}/api/replies`));
