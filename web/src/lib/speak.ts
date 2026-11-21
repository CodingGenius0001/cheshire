import type { SpeakRequest } from "../../../shared/types";

let current: HTMLAudioElement | null = null;

// Audio fetched ahead of time by prefetchSpeech(), keyed by text.
const prefetched = new Map<string, Promise<Blob>>();
const MAX_PREFETCHED = 6;

async function fetchSpeech(text: string): Promise<Response> {
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text } satisfies SpeakRequest),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`speak failed (${res.status}): ${detail}`);
  }
  return res;
}

/**
 * Start fetching audio for texts that may be spoken soon (e.g. the 3 reply
 * options), so speak() can play the chosen one with no network wait.
 * Costs ElevenLabs characters for every option, picked or not.
 */
export function prefetchSpeech(texts: string[]) {
  for (const text of texts) {
    if (!text.trim() || prefetched.has(text)) continue;
    const blob = fetchSpeech(text).then((res) => res.blob());
    blob.catch(() => prefetched.delete(text));
    prefetched.set(text, blob);
  }
  for (const key of prefetched.keys()) {
    if (prefetched.size <= MAX_PREFETCHED) break;
    prefetched.delete(key);
  }
}

/** Stop whatever speak() is currently playing. */
export function stopSpeaking() {
  if (!current) return;
  current.pause();
  current.src = "";
  current = null;
}

/**
 * POST /api/speak and play the result in the user's voice. Uses prefetched
 * audio when available; otherwise plays as the stream arrives (MediaSource)
 * where supported, or after the full download.
 * Resolves when playback ends. `onStart` fires once, when sound actually begins.
 */
export async function speak(text: string, onStart?: () => void): Promise<void> {
  stopSpeaking();

  const cached = prefetched.get(text);
  prefetched.delete(text);
  const cachedBlob = cached ? await cached.catch(() => null) : null;
  const res = cachedBlob ? null : await fetchSpeech(text);

  const audio = new Audio();
  current = audio;
  let started = false;
  audio.onplaying = () => {
    if (started) return;
    started = true;
    onStart?.();
  };
  let failPlayback: (err: unknown) => void = () => {};
  const ended = new Promise<void>((resolve, reject) => {
    failPlayback = reject;
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
  });
  ended.catch(() => {}); // rejections are rethrown by the awaits below

  if (res?.body && typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);
    await new Promise((r) => mediaSource.addEventListener("sourceopen", r, { once: true }));
    const buffer = mediaSource.addSourceBuffer("audio/mpeg");
    const reader = res.body.getReader();
    // Autoplay policy can block play() (a blink is not a click); surface that
    // instead of waiting forever for an "ended" that never comes.
    let playError: unknown = null;
    audio.play().catch((err) => {
      playError = err;
      failPlayback(err);
    });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (playError) {
        void reader.cancel();
        throw playError;
      }
      if (current !== audio) {
        void reader.cancel();
        return;
      }
      buffer.appendBuffer(value);
      await new Promise((r) => buffer.addEventListener("updateend", r, { once: true }));
    }
    if (mediaSource.readyState === "open") mediaSource.endOfStream();
    if (playError) throw playError;
  } else {
    audio.src = URL.createObjectURL(cachedBlob ?? (await res!.blob()));
    await audio.play();
  }

  await ended;
}
