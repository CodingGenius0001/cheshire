import { useCallback, useEffect, useRef, useState } from "react";
import type { Speaker, Turn } from "../../../shared/types";

// Minimal Web Speech API typings (not in TypeScript's DOM lib).
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Chrome often finalizes one sentence in pieces ("Do you want" / "to get lunch?").
// Finished pieces are held this long after speech stops, then emitted as one turn,
// so replies are generated for the whole thought, not half of it.
const PHRASE_GAP_MS = 800;

function makeTurn(speaker: Speaker, text: string, source: Turn["source"]): Turn {
  return { id: crypto.randomUUID(), speaker, text, timestamp: Date.now(), source };
}

export interface Listener {
  turns: Turn[];
  listening: boolean;
  start: () => void;
  stop: () => void;
  addUserTurn: (text: string) => void;
  /** Toggle for push-to-listen buttons. */
  toggle: () => void;
  /** Typed fallback for when recognition struggles in a noisy room. */
  addPartnerTurn: (text: string) => void;
  /** Words recognized so far in the current, not-yet-final phrase. */
  interim: string;
  supported: boolean;
  error: string | null;
}

export function useListener(lang = "en-US"): Listener {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // True while the user wants to listen; Chrome ends sessions on its own after
  // silence, so onend restarts while this is set.
  const wantListeningRef = useRef(false);
  const supported = typeof window !== "undefined" && Boolean(getRecognitionCtor());

  const addTurn = useCallback((speaker: Speaker, text: string, source: Turn["source"]) => {
    const clean = text.trim();
    if (!clean) return;
    setTurns((prev) => [...prev, makeTurn(speaker, clean, source)]);
  }, []);

  // Finalized partner speech not yet emitted as a turn (see PHRASE_GAP_MS).
  const phraseRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flushPhrase = useCallback(() => {
    clearTimeout(flushTimerRef.current);
    const text = phraseRef.current;
    phraseRef.current = "";
    setInterim("");
    addTurn("partner", text, "speech");
  }, [addTurn]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition not supported in this browser (use Chrome).");
      return;
    }
    if (wantListeningRef.current) return;
    wantListeningRef.current = true;
    setError(null);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) phraseRef.current = `${phraseRef.current} ${result[0].transcript.trim()}`.trim();
        else pending += result[0].transcript;
      }
      setInterim(`${phraseRef.current} ${pending.trim()}`.trim());
      // Still talking: wait for the next final. Quiet: emit after the gap.
      clearTimeout(flushTimerRef.current);
      if (!pending.trim() && phraseRef.current) {
        flushTimerRef.current = setTimeout(flushPhrase, PHRASE_GAP_MS);
      }
    };

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are routine; onend restarts if still wanted.
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListeningRef.current = false;
      }
    };

    rec.onend = () => {
      // A newer session replaced this one (stop then start); leave its state alone.
      if (recognitionRef.current !== rec) return;
      setInterim(phraseRef.current);
      if (wantListeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // fall through and stop
        }
      }
      recognitionRef.current = null;
      wantListeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      wantListeningRef.current = false;
      recognitionRef.current = null;
      setError(String(err));
    }
  }, [flushPhrase, lang]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    // stop() (not abort()) lets Chrome deliver the final result for the phrase in progress.
    recognitionRef.current?.stop();
    flushPhrase();
    setListening(false);
  }, [flushPhrase]);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  // Flush first so held partner speech stays ahead of the new turn.
  const addUserTurn = useCallback(
    (text: string) => {
      flushPhrase();
      addTurn("user", text, "reply");
    },
    [addTurn, flushPhrase],
  );
  const addPartnerTurn = useCallback(
    (text: string) => {
      flushPhrase();
      addTurn("partner", text, "typed");
    },
    [addTurn, flushPhrase],
  );

  useEffect(
    () => () => {
      clearTimeout(flushTimerRef.current);
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return {
    turns,
    listening,
    start,
    stop,
    addUserTurn,
    toggle,
    addPartnerTurn,
    interim,
    supported,
    error,
  };
}
