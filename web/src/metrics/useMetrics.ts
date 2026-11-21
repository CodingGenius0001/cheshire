import { useCallback, useMemo, useRef, useState } from 'react';

/**
 * Typical communication rate for eye-gaze / switch AAC typing, used as the
 * comparison line in the metrics panel. Verify and cite a source before the
 * pitch, and change it here if your source gives a different figure.
 */
export const AAC_BASELINE_WPM = 10;

/** One completed exchange: partner finished speaking → user's voice started. */
export interface Exchange {
  id: number;
  /** Partner turn ended → 3 replies on screen. */
  replyMs: number | null;
  /** Replies on screen → user chose one (blink / tilt). */
  selectMs: number | null;
  /** Choice made → audio started playing. */
  voiceMs: number;
  /** Partner turn ended → user's voice started. */
  totalMs: number | null;
  words: number;
  usedFallbackVoice: boolean;
}

export interface MetricsSummary {
  exchanges: Exchange[];
  medianReplyMs: number | null;
  medianSelectMs: number | null;
  medianVoiceMs: number | null;
  medianTotalMs: number | null;
  /** Words spoken ÷ time the user spent choosing + waiting for voice. */
  effectiveWpm: number | null;
  totalWords: number;
}

interface Marks {
  partnerEndAt: number | null;
  repliesAt: number | null;
  chosenAt: number | null;
  words: number;
}

const emptyMarks = (): Marks => ({ partnerEndAt: null, repliesAt: null, chosenAt: null, words: 0 });

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function useMetrics() {
  const marks = useRef<Marks>(emptyMarks());
  const nextId = useRef(1);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  const partnerTurnEnded = useCallback((at: number = performance.now()) => {
    marks.current = { ...emptyMarks(), partnerEndAt: at };
  }, []);

  const repliesShown = useCallback(() => {
    marks.current.repliesAt = performance.now();
  }, []);

  const chosen = useCallback((text: string) => {
    marks.current.chosenAt = performance.now();
    marks.current.words = countWords(text);
  }, []);

  const voiceStarted = useCallback((usedFallbackVoice = false) => {
    const now = performance.now();
    const { partnerEndAt, repliesAt, chosenAt, words } = marks.current;
    if (chosenAt === null) return;
    const exchange: Exchange = {
      id: nextId.current++,
      replyMs: partnerEndAt !== null && repliesAt !== null ? repliesAt - partnerEndAt : null,
      selectMs: repliesAt !== null ? chosenAt - repliesAt : null,
      voiceMs: now - chosenAt,
      totalMs: partnerEndAt !== null ? now - partnerEndAt : null,
      words,
      usedFallbackVoice,
    };
    marks.current = emptyMarks();
    setExchanges((prev) => [...prev, exchange]);
  }, []);

  const reset = useCallback(() => {
    marks.current = emptyMarks();
    setExchanges([]);
  }, []);

  const summary = useMemo<MetricsSummary>(() => {
    const nums = (pick: (e: Exchange) => number | null) =>
      exchanges.map(pick).filter((v): v is number => v !== null);

    const timed = exchanges.filter((e) => e.selectMs !== null);
    const userMs = timed.reduce((sum, e) => sum + (e.selectMs ?? 0) + e.voiceMs, 0);
    const timedWords = timed.reduce((sum, e) => sum + e.words, 0);

    return {
      exchanges,
      medianReplyMs: median(nums((e) => e.replyMs)),
      medianSelectMs: median(nums((e) => e.selectMs)),
      medianVoiceMs: median(nums((e) => e.voiceMs)),
      medianTotalMs: median(nums((e) => e.totalMs)),
      effectiveWpm: userMs > 0 ? timedWords / (userMs / 60_000) : null,
      totalWords: exchanges.reduce((sum, e) => sum + e.words, 0),
    };
  }, [exchanges]);

  return { summary, partnerTurnEnded, repliesShown, chosen, voiceStarted, reset };
}
