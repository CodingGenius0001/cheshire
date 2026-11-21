import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepliesRequest, RepliesResponse, Turn } from '../../shared/types';
import { useListener } from './listener/useListener';
import { speak } from './lib/speak';
import { useDemoMode } from './demo/useDemoMode';
import { ReplyTiles } from './tiles/ReplyTiles';
import { MetricsPanel } from './metrics/MetricsPanel';
import { useMetrics } from './metrics/useMetrics';
import './styles/app.css';

/*
 * TEAM CONTRACTS
 *
 *  useListener()  (Jash)   → shared Listener: `turns` is the whole conversation (partner speech + replies we add
 *                            with addUserTurn), `interim`, `listening`, `start`/`stop`, `supported`, `error`.
 *  speak(text, onStart)    (Jash, web/src/lib/speak.ts) → streams POST /api/speak and resolves when playback ends.
 *  <ReplyTiles>   (Vivek)  → props { replies: string[]; loading?: boolean }
 *  "cheshire:select"       → CustomEvent on `window`, detail { type: 'choose'; index: number; text?: string }
 *  POST /api/replies       → RepliesRequest → RepliesResponse (shared/types.ts, server/src/replies.ts)
 *  Demo mode (P key)       → web/src/demo: feeds scripted partner lines through addPartnerTurn.
 */

interface SelectDetail {
  type?: string;
  index?: number;
  text?: string;
}

async function fetchReplies(history: Turn[], signal: AbortSignal): Promise<string[]> {
  const body: RepliesRequest = { history: history.map(({ speaker, text }) => ({ speaker, text })) };
  const res = await fetch('/api/replies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Couldn't get replies (HTTP ${res.status})`);
  }
  const data = (await res.json()) as Partial<RepliesResponse>;
  if (!Array.isArray(data.replies)) throw new Error('Reply server sent no replies');
  return data.replies.filter((r): r is string => typeof r === 'string').slice(0, 3);
}

/**
 * Speak `text` in the user's cloned voice. If that fails before any audio plays,
 * fall back to the browser's built-in voice so a demo never goes silent.
 * `onStart` fires once, when sound actually begins.
 */
async function speakWithFallback(text: string, onStart: (usedFallback: boolean) => void): Promise<'voice' | 'fallback'> {
  let started = false;
  try {
    await speak(text, () => {
      started = true;
      onStart(false);
    });
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
  const { turns, start: startListening, stop: stopListening, addUserTurn, addPartnerTurn } = listener;
  const metrics = useMetrics();
  const { log } = metrics;
  // The scripted conversation replaces the mic while it runs, then hands back.
  const demo = useDemoMode({ addPartnerTurn, onStart: stopListening, onEnd: startListening });
  const { isActive: demoActive, userSpoke: demoUserSpoke, fallbackReplies: demoFallbackReplies } = demo;

  const [replies, setReplies] = useState<string[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Refs mirror state so event handlers always see the latest values.
  const turnsRef = useRef<Turn[]>([]);
  const repliesRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const replyAbort = useRef<AbortController | null>(null);
  const seenTurns = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);

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
    log({ type: 'replies_requested' });
    try {
      const next = await fetchReplies(turnsRef.current, controller.signal);
      if (controller.signal.aborted) return;
      showReplies(next);
      log({ type: 'replies_shown', count: next.length });
      setNotice(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Couldn't get replies";
      log({ type: 'replies_failed', message });
      const scripted = demoFallbackReplies();
      if (scripted) {
        // Demo must not stall: fall back to the script's own replies.
        showReplies(scripted);
        log({ type: 'replies_shown', count: scripted.length });
        console.warn('[cheshire] demo: reply server failed, using scripted replies:', message);
        setNotice('Reply server unavailable, showing scripted replies');
      } else {
        setNotice(message);
      }
    } finally {
      if (replyAbort.current === controller) {
        replyAbort.current = null;
        setLoadingReplies(false);
      }
    }
  }, [demoFallbackReplies, log, showReplies]);

  // New partner turns from the listener → ask for replies. (User turns are ones we added ourselves.)
  useEffect(() => {
    turnsRef.current = turns;
    if (turns.length < seenTurns.current) seenTurns.current = 0; // listener was reset
    const fresh = turns.slice(seenTurns.current).filter((t) => t.speaker === 'partner');
    seenTurns.current = turns.length;
    if (!fresh.length) return;

    for (const t of fresh) log({ type: 'partner_turn', text: t.text });
    void requestReplies();
  }, [turns, log, requestReplies]);

  const choose = useCallback(
    async (text: string) => {
      speakingRef.current = true;
      setSpeaking(true);
      log({ type: 'spoken', text });
      addUserTurn(text);
      showReplies([]);
      // Mute the mic while we talk, or it transcribes our own voice as a partner turn.
      stopListening();
      try {
        const mode = await speakWithFallback(text, (fallback) => log({ type: 'voice_started', fallback }));
        setNotice(mode === 'fallback' ? 'Voice server unavailable, used browser voice' : null);
      } finally {
        speakingRef.current = false;
        setSpeaking(false);
        if (demoActive()) demoUserSpoke();
        else startListening();
      }
    },
    [addUserTurn, demoActive, demoUserSpoke, log, showReplies, startListening, stopListening],
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
  }, [turns, listener.interim]);

  // During the demo the mic is off on purpose, so its problems don't matter.
  const micProblem = demo.state.status === 'running'
    ? null
    : !listener.supported
    ? 'Speech recognition needs Chrome'
    : listener.error
      ? `Microphone: ${listener.error}`
      : null;

  const status = speaking
    ? 'Speaking…'
    : loadingReplies
      ? 'Thinking of replies…'
      : replies.length
        ? 'Blink or tilt to choose'
        : demo.state.status === 'running'
          ? 'Listening (demo)…'
          : !listener.listening
            ? 'Microphone off'
            : 'Listening…';

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="brand">
          Cheshire<span className="brand-dot" aria-hidden>●</span>
        </h1>
        <div className="header-right">
          {demo.state.status === 'running' && (
            <span className="demo-chip" title="Press P to skip to the next line">
              Demo {demo.state.step + 1} / {demo.state.total}
            </span>
          )}
          {demo.state.status === 'done' && <span className="demo-chip">Demo finished · P to replay</span>}
          <div className={`status ${speaking ? 'status-speaking' : ''}`} role="status" aria-live="polite">
            {status}
          </div>
        </div>
      </header>

      <main className="app-grid">
        <section className="panel transcript" aria-label="Conversation">
          <header className="panel-header">
            <h2>Conversation</h2>
          </header>
          <div className="transcript-scroll">
            {turns.length === 0 && !listener.interim && (
              <p className="empty">
                Waiting for someone to speak…
                <span className="empty-hint">
                  Press <kbd>P</kbd> for a demo conversation
                </span>
              </p>
            )}
            {turns.map((turn) => (
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
          {(notice ?? micProblem) && (
            <p className="notice" role="alert">
              {notice ?? micProblem}
            </p>
          )}
        </section>

        <MetricsPanel summary={metrics.summary} onReset={metrics.reset} />
      </main>
    </div>
  );
}
