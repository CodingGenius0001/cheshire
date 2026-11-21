import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_SCRIPT } from './script';

/** The key that starts demo mode, or skips to the next partner line once it's running. */
export const DEMO_KEY = 'p';

/** Pause after the user's reply finishes before the scripted partner "speaks" again. */
const PARTNER_PAUSE_MS = 1500;

export type DemoState =
  | { status: 'off' }
  /** `step` is the index of the partner line most recently delivered. */
  | { status: 'running'; step: number; total: number }
  | { status: 'done'; total: number };

interface Options {
  /** Feeds a scripted line in as if the partner said it (useListener's typed fallback). */
  addPartnerTurn: (text: string) => void;
  /** Demo started: the real mic should stop so room noise doesn't interrupt the script. */
  onStart?: () => void;
  /** Demo finished: hand back to the real mic. */
  onEnd?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Demo mode: press P to play a scripted partner conversation, so the demo works even if the mic fails.
 * The first line arrives immediately; each later line follows a short pause after the user's reply is spoken.
 * Pressing P again skips ahead to the next line; pressing it after the script ends restarts it.
 */
export function useDemoMode({ addPartnerTurn, onStart, onEnd }: Options) {
  const [state, setState] = useState<DemoState>({ status: 'off' });
  const stepRef = useRef<number | null>(null); // null when not running
  const timer = useRef<number | null>(null);

  // Latest callbacks, so the stable functions below never call stale ones.
  const callbacks = useRef({ addPartnerTurn, onStart, onEnd });
  callbacks.current = { addPartnerTurn, onStart, onEnd };

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const deliver = useCallback((step: number) => {
    clearTimer();
    if (step >= DEMO_SCRIPT.length) {
      stepRef.current = null;
      setState({ status: 'done', total: DEMO_SCRIPT.length });
      callbacks.current.onEnd?.();
      return;
    }
    stepRef.current = step;
    setState({ status: 'running', step, total: DEMO_SCRIPT.length });
    callbacks.current.addPartnerTurn(DEMO_SCRIPT[step].partner);
  }, []);

  const startOrSkip = useCallback(() => {
    if (stepRef.current === null) {
      callbacks.current.onStart?.();
      deliver(0);
    } else {
      deliver(stepRef.current + 1);
    }
  }, [deliver]);

  /** Call after the user's reply has finished playing. Queues the next scripted line. */
  const userSpoke = useCallback(() => {
    const step = stepRef.current;
    if (step === null) return;
    clearTimer();
    timer.current = window.setTimeout(() => deliver(step + 1), PARTNER_PAUSE_MS);
  }, [deliver]);

  const isActive = useCallback(() => stepRef.current !== null, []);

  /** Scripted replies for the current line, used only if the reply server fails. */
  const fallbackReplies = useCallback((): string[] | null => {
    const step = stepRef.current;
    return step === null ? null : [...DEMO_SCRIPT[step].replies];
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key.toLowerCase() !== DEMO_KEY) return;
      startOrSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startOrSkip]);

  useEffect(() => clearTimer, []);

  return { state, isActive, userSpoke, fallbackReplies, startOrSkip };
}
