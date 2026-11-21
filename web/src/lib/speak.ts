import type { SpeakRequest } from "../../../shared/types";

let current: HTMLAudioElement | null = null;

/** Stop whatever speak() is currently playing. */
export function stopSpeaking() {
  if (!current) return;
  current.pause();
  current.src = "";
  current = null;
}

/**
 * POST /api/speak and play the result in the user's voice. Plays as the stream
 * arrives (MediaSource) where supported, otherwise after the full download.
 * Resolves when playback ends.
 */
export async function speak(text: string): Promise<void> {
  stopSpeaking();
  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text } satisfies SpeakRequest),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`speak failed (${res.status}): ${detail}`);
  }

  const audio = new Audio();
  current = audio;
  const ended = new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio playback failed"));
  });

  if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);
    await new Promise((r) => mediaSource.addEventListener("sourceopen", r, { once: true }));
    const buffer = mediaSource.addSourceBuffer("audio/mpeg");
    const reader = res.body.getReader();
    void audio.play().catch(() => {});
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (current !== audio) {
        void reader.cancel();
        return;
      }
      buffer.appendBuffer(value);
      await new Promise((r) => buffer.addEventListener("updateend", r, { once: true }));
    }
    if (mediaSource.readyState === "open") mediaSource.endOfStream();
  } else {
    audio.src = URL.createObjectURL(await res.blob());
    await audio.play();
  }

  await ended;
}
