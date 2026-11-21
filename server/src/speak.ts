import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { Router } from "express";
import type { SpeakRequest } from "../../shared/types";

// Flash is ElevenLabs' lowest-latency model; the /stream endpoint returns audio
// as it is generated, so the browser can start playing before synthesis ends.
// ELEVENLABS_MODEL_ID=eleven_multilingual_v2 sounds closer to the clone but is slower.
const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const MAX_CHARS = 1000;

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return process.env[name] && Number.isFinite(value) ? value : fallback;
}

// Tuned for a cloned voice: high similarity keeps it sounding like the user,
// mid stability keeps it expressive without wandering. Override from .env.
function voiceSettings() {
  return {
    stability: envNumber("ELEVENLABS_STABILITY", 0.5),
    similarity_boost: envNumber("ELEVENLABS_SIMILARITY", 0.85),
    style: 0,
    use_speaker_boost: true,
    speed: envNumber("ELEVENLABS_SPEED", 1),
  };
}

// Finished audio by voice + settings + text. Demo lines and common replies repeat,
// so a hit plays instantly and costs no ElevenLabs characters. Oldest evicted first.
const cache = new Map<string, Buffer>();
const MAX_CACHED = 200;

function cacheSet(key: string, audio: Buffer) {
  cache.delete(key);
  cache.set(key, audio);
  for (const oldest of cache.keys()) {
    if (cache.size <= MAX_CACHED) break;
    cache.delete(oldest);
  }
}

export const speakRouter = Router();

speakRouter.post("/", async (req, res) => {
  const { text } = (req.body ?? {}) as Partial<SpeakRequest>;
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "body must be { text: string }" });
    return;
  }
  if (text.length > MAX_CHARS) {
    res.status(400).json({ error: `text longer than ${MAX_CHARS} chars` });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    res.status(500).json({ error: "ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set in .env" });
    return;
  }

  const body = {
    text: text.trim(),
    model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
    voice_settings: voiceSettings(),
  };
  const cacheKey = JSON.stringify([voiceId, body]);
  const cached = cache.get(cacheKey);
  if (cached) {
    cacheSet(cacheKey, cached); // mark as recently used
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Speak-Cache", "hit");
    res.end(cached);
    return;
  }

  // Stop paying for synthesis if the browser goes away mid-stream.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      },
    );

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error(`ElevenLabs ${upstream.status}: ${detail}`);
      res.status(502).json({ error: `ElevenLabs error ${upstream.status}`, detail });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Speak-Cache", "miss");
    const audio = Readable.fromWeb(upstream.body as WebReadableStream);
    const chunks: Buffer[] = [];
    audio.on("data", (chunk: Buffer) => chunks.push(chunk));
    // Only cache complete audio, never a stream the browser abandoned.
    audio.on("end", () => {
      if (!abort.signal.aborted) cacheSet(cacheKey, Buffer.concat(chunks));
    });
    audio.pipe(res);
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error("speak failed:", err);
    if (!res.headersSent) res.status(502).json({ error: "failed to reach ElevenLabs" });
    else res.end();
  }
});
