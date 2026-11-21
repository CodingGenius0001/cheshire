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
        if (result.isFinal) addTurn("partner", result[0].transcript, "speech");
        else pending += result[0].transcript;
      }
      setInterim(pending);
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
      setInterim("");
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
  }, [addTurn, lang]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    // stop() (not abort()) lets Chrome deliver the final result for the phrase in progress.
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (wantListeningRef.current) stop();
    else start();
  }, [start, stop]);

  const addUserTurn = useCallback((text: string) => addTurn("user", text, "reply"), [addTurn]);
  const addPartnerTurn = useCallback((text: string) => addTurn("partner", text, "typed"), [addTurn]);

  useEffect(
    () => () => {
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
