// Checks .env before a demo: `npx tsx server/src/checkEnv.ts` from the repo root.
// Uses only free, read-only endpoints, so it spends no credits.
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

let failed = false;
const ok = (msg: string) => console.log(`  ok    ${msg}`);
const bad = (msg: string) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
};

async function checkElevenLabs() {
  console.log("ElevenLabs");
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key) return bad("ELEVENLABS_API_KEY is empty");
  if (!voiceId) return bad("ELEVENLABS_VOICE_ID is empty");

  const voice = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, {
    headers: { "xi-api-key": key },
  });
  if (voice.status === 401) return bad("API key rejected (401)");
  if (!voice.ok) return bad(`voice ${voiceId} not found on this account (${voice.status})`);
  const { name, category } = (await voice.json()) as { name?: string; category?: string };
  ok(`voice "${name}" (${category === "cloned" ? "instant clone" : category})`);

  // Needs the "user_read" permission; restricted keys may not have it.
  const sub = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
  if (sub.ok) {
    const { tier, character_count, character_limit } = (await sub.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
    };
    const left = (character_limit ?? 0) - (character_count ?? 0);
    (left > 2000 ? ok : bad)(`plan "${tier}": ${left} characters left`);
  } else {
    console.log("  skip  character balance (key lacks user_read permission)");
  }
}

async function checkAnthropic() {
  console.log("Anthropic");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return bad("ANTHROPIC_API_KEY is empty");
  const model = process.env.REPLIES_MODEL || "claude-opus-5-5";
  const res = await fetch(`https://api.anthropic.com/v1/models/${model}`, {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  if (res.status === 401) return bad("API key rejected (401)");
  if (!res.ok) return bad(`model ${model} not available to this key (${res.status})`);
  ok(`key works, ${model} available`);
}

for (const check of [checkElevenLabs, checkAnthropic]) {
  try {
    await check();
  } catch (err) {
    bad(`request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
console.log(failed ? "\nFix the FAIL lines in .env, then restart npm run dev." : "\nAll good.");
process.exit(failed ? 1 : 0);
