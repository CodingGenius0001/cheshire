import { useCallback, useEffect, useRef, useState } from 'react';
import { useListener } from './listener/useListener';
import { ReplyTiles } from './tiles/ReplyTiles';
import { MetricsPanel } from './metrics/MetricsPanel';
import { useMetrics } from './metrics/useMetrics';
import './styles/app.css';

/*
 * ASSUMED TEAM CONTRACTS — check these against Josh's and Vivek's code:
 *
 *  useListener()  (Josh)   → { turns: { id?: string; text: string }[]; interim?: string; listening?: boolean }
 *                            `turns` holds finished partner utterances and only grows.
 *  <ReplyTiles>   (Vivek)  → props { replies: string[]; loading?: boolean }
 *  "cheshire:select"       → CustomEvent dispatched on `window`, detail { type: 'choose'; index: number; text?: string }
 *  POST /api/replies       → body { history: { speaker: 'partner' | 'user'; text: string }[] } → { replies: string[] }
 *  POST /api/speak         → body { text } → audio bytes (audio/mpeg, audio/wav, ...)
 */

type Speaker = 'partner' | 'user';

interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
}

interface SelectDetail {
  type?: string;
  index?: number;
  text?: string;
}

async function fetchReplies(history: Turn[], signal: AbortSignal): Promise<string[]> {
  const res = await fetch('/api/replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history: history.map(({ speaker, text }) => ({ speaker, text })) }),
    signal,
  });
  if (!res.ok) throw new Error(`Couldn't get replies (HTTP ${res.status})`);
  const data = (await res.json()) as { replies?: unknown };
  if (!Array.isArray(data.replies)) throw new Error('Reply server sent no replies');
  return data.replies.filter((r): r is string => typeof r === 'string').slice(0, 3);
}

/**
 * Speak `text` in the user's cloned voice via /api/speak. If that fails before
 * any audio plays, fall back to the browser's built-in voice so a demo never goes silent.
 * `onStart` fires once, when sound actually begins.
 */
async function speak(text: string, onStart: (usedFallback: boolean) => void): Promise<'voice' | 'fallback'> {
  let started = false;
  try {
    const res = await fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`/api/speak HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    try {
      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.onplaying = () => {
          if (started) return;
          started = true;
          onStart(false);
        };
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
    return 'voice';
  } catch (err) {
    if (started) return 'voice'; // it already spoke; don't say it twice
    console.warn('[cheshire] voice server failed, using browser voice', err);
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => onStart(true);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    });
    return 'fallback';
  }
}

export default function App() {
  const listener = useListener();
  const metrics = useMetrics();
  const { partnerTurnEnded, repliesShown, chosen, voiceStarted } = metrics;

  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [replies, setReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Refs mirror state so event handlers always see the latest values.
  const transcriptRef = useRef<Turn[]>([]);
  const repliesRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const replyAbort = useRef<AbortController | null>(null);
  const seenPartnerTurns = useRef(0);
  const turnCounter = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const appendTurns = useCallback((turns: Omit<Turn, 'id'>[]) => {
    const withIds = turns.map((t) => ({ ...t, id: `${t.speaker}-${++turnCounter.current}` }));
    transcriptRef.current = [...transcriptRef.current, ...withIds];
    setTranscript(transcriptRef.current);
  }, []);

  const showReplies = useCallback((next: string[]) => {
    repliesRef.current = next;
    setReplies(next);
  }, []);

  const requestReplies = useCallback(async () => {
    replyAbort.current?.abort(); // a newer partner turn supersedes any request in flight
    const controller = new AbortController();
    replyAbort.current = controller;

    showReplies([]);
    setLoadingReplies(true);
    try {
      const next = await fetchReplies(transcriptRef.current, controller.signal);
      if (controller.signal.aborted) return;
      showReplies(next);
      repliesShown();
      setNotice(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setNotice(err instanceof Error ? err.message : "Couldn't get replies");
    } finally {
      if (replyAbort.current === controller) {
        replyAbort.current = null;
        setLoadingReplies(false);
      }
    }
  }, [repliesShown, showReplies]);

  // New partner turns from the listener → add to transcript, ask for replies.
  useEffect(() => {
    const turns = listener.turns;
    if (turns.length < seenPartnerTurns.current) seenPartnerTurns.current = 0; // listener was reset
    const fresh = turns
      .slice(seenPartnerTurns.current)
      .map((t) => t.text.trim())
      .filter(Boolean);
    seenPartnerTurns.current = turns.length;
    if (!fresh.length) return;

    appendTurns(fresh.map((text) => ({ speaker: 'partner' as const, text })));
    partnerTurnEnded();
    void requestReplies();
  }, [listener.turns, appendTurns, partnerTurnEnded, requestReplies]);

  const choose = useCallback(
    async (text: string) => {
      speakingRef.current = true;
      setSpeaking(true);
      chosen(text);
      appendTurns([{ speaker: 'user', text }]);
      showReplies([]);
      try {
        const mode = await speak(text, voiceStarted);
        setNotice(mode === 'fallback' ? 'Voice server unavailable, used browser voice' : null);
      } finally {
        speakingRef.current = false;
        setSpeaking(false);
      }
    },
    [appendTurns, chosen, showReplies, voiceStarted],
  );

  // Blink / head-tilt choice from the selection layer.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectDetail>).detail ?? {};
      if (detail.type !== 'choose') return;
      const text = detail.text ?? (detail.index !== undefined ? repliesRef.current[detail.index] : undefined);
      if (!text || speakingRef.current) return;
      void choose(text);
    };
    window.addEventListener('cheshire:select', onSelect);
    return () => window.removeEventListener('cheshire:select', onSelect);
  }, [choose]);

  useEffect(() => () => replyAbort.current?.abort(), []);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript, listener.interim]);

  const status = speaking
    ? 'Speaking…'
    : loadingReplies
      ? 'Thinking of replies…'
      : replies.length
        ? 'Blink or tilt to choose'
        : listener.listening === false
          ? 'Microphone off'
          : 'Listening…';

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">
          Cheshire<span className="brand-dot" aria-hidden>●</span>
        </h1>
        <div className={`status ${speaking ? 'status-speaking' : ''}`} role="status" aria-live="polite">
          {status}
        </div>
      </header>

      <main className="app-grid">
        <section className="panel transcript" aria-label="Conversation">
          <header className="panel-header">
            <h2>Conversation</h2>
          </header>
          <div className="transcript-scroll">
            {transcript.length === 0 && !listener.interim && (
              <p className="empty">Waiting for someone to speak…</p>
            )}
            {transcript.map((turn) => (
              <div key={turn.id} className={`bubble bubble-${turn.speaker}`}>
                <span className="bubble-who">{turn.speaker === 'partner' ? 'Them' : 'You'}</span>
                {turn.text}
              </div>
            ))}
            {listener.interim && <div className="bubble bubble-partner bubble-interim">{listener.interim}</div>}
            <div ref={transcriptEnd} />
          </div>
        </section>

        <section className="panel center" aria-label="Reply options">
          <ReplyTiles replies={replies} loading={loadingReplies} />
          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}
        </section>

        <MetricsPanel summary={metrics.summary} onReset={metrics.reset} />
      </main>
    </div>
  );
}
