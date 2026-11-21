import { useCallback, useEffect, useMemo, useState } from 'react';
import { SELECTION_EVENT_NAME, type SelectionEvent, type SelectionEventDetail } from '../selection';

/** Everything the metrics panel knows about comes in as one of these. All `at` values are performance.now(). */
export type MetricEvent =
  | { type: 'partner_turn'; at: number; text: string }
  | { type: 'replies_requested'; at: number }
  | { type: 'replies_shown'; at: number; count: number }
  | { type: 'replies_failed'; at: number; message: string }
  /** A blink/tilt (or click) while replies were on screen. Counted as one input in KSR. */
  | { type: 'selection'; at: number; gesture: SelectionEvent; index: number }
  /** Any non-modifier key press. Counted as one input in KSR. */
  | { type: 'key'; at: number; key: string }
  /** The user committed to a reply; it becomes their turn. */
  | { type: 'spoken'; at: number; text: string }
  | { type: 'voice_started'; at: number; fallback: boolean };

/** A MetricEvent where `at` is optional (defaults to now). */
export type MetricInput = MetricEvent extends infer E
  ? E extends MetricEvent
    ? Omit<E, 'at'> & { at?: number }
    : never
  : never;

export interface MetricsSummary {
  events: MetricEvent[];
  sessionStart: number | null;
  /** Selections + key presses. */
  inputs: number;
  charsSpoken: number;
  /** Keystroke savings rate: 1 − inputs / charsSpoken. Null until something is spoken. */
  ksr: number | null;
  repliesSpoken: number;
  repliesPerMinute: number | null;
  /** Partner turn ended → replies on screen. */
  medianReplyMs: number | null;
  /** Replies on screen → user chose one. */
  medianSelectMs: number | null;
  /** Choice → voice audible. */
  medianVoiceMs: number | null;
  /** Partner turn ended → voice audible. */
  medianTotalMs: number | null;
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);
/** App shortcuts for the presenter (P = demo mode, D = camera debug), not communication input. */
const CONTROL_KEYS = new Set(['p', 'd']);

/** Replies/min divides by at least this much time, so one quick reply doesn't read as "30/min". */
const MIN_RATE_WINDOW_MS = 60_000;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarize(events: MetricEvent[], now: number): MetricsSummary {
  let inputs = 0;
  let charsSpoken = 0;
  let repliesSpoken = 0;
  const replyMs: number[] = [];
  const selectMs: number[] = [];
  const voiceMs: number[] = [];
  const totalMs: number[] = [];

  // Pair each stage with the most recent event that started it.
  let partnerAt: number | null = null; // start of the current exchange
  let pendingPartnerAt: number | null = null; // waiting for replies_shown
  let shownAt: number | null = null;
  let spokenAt: number | null = null;

  for (const e of events) {
    switch (e.type) {
      case 'partner_turn':
        partnerAt = pendingPartnerAt = e.at;
        break;
      case 'replies_shown':
        if (pendingPartnerAt !== null) replyMs.push(e.at - pendingPartnerAt);
        pendingPartnerAt = null;
        shownAt = e.at;
        break;
      case 'selection':
      case 'key':
        inputs++;
        break;
      case 'spoken':
        repliesSpoken++;
        charsSpoken += e.text.length;
        if (shownAt !== null) selectMs.push(e.at - shownAt);
        shownAt = null;
        spokenAt = e.at;
        break;
      case 'voice_started':
        if (spokenAt !== null) voiceMs.push(e.at - spokenAt);
        if (partnerAt !== null) totalMs.push(e.at - partnerAt);
        spokenAt = partnerAt = null;
        break;
    }
  }

  const sessionStart = events[0]?.at ?? null;
  const elapsed = sessionStart === null ? 0 : Math.max(now - sessionStart, MIN_RATE_WINDOW_MS);

  return {
    events,
    sessionStart,
    inputs,
    charsSpoken,
    ksr: charsSpoken > 0 ? 1 - inputs / charsSpoken : null,
    repliesSpoken,
    repliesPerMinute: sessionStart === null ? null : repliesSpoken / (elapsed / 60_000),
    medianReplyMs: median(replyMs),
    medianSelectMs: median(selectMs),
    medianVoiceMs: median(voiceMs),
    medianTotalMs: median(totalMs),
  };
}

export function useMetrics() {
  const [events, setEvents] = useState<MetricEvent[]>([]);
  const [now, setNow] = useState(() => performance.now());

  const log = useCallback((input: MetricInput) => {
    const event = { ...input, at: input.at ?? performance.now() } as MetricEvent;
    console.debug('[cheshire:metric]', event.type, event);
    setEvents((prev) => [...prev, event]);
  }, []);

  const reset = useCallback(() => {
    console.debug('[cheshire:metric] reset');
    setEvents([]);
  }, []);

  // Blink / tilt / click selections, straight from the selection layer.
  // Events with no replies on screen (index undefined) are camera noise that App ignores, so they don't count.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const d = (e as CustomEvent<SelectionEventDetail>).detail;
      if (!d || d.index === undefined) return;
      log({ type: 'selection', gesture: d.type, index: d.index, at: d.at });
    };
    window.addEventListener(SELECTION_EVENT_NAME, onSelect);
    return () => window.removeEventListener(SELECTION_EVENT_NAME, onSelect);
  }, [log]);

  // Every key press is an input the user had to make.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || MODIFIER_KEYS.has(e.key) || CONTROL_KEYS.has(e.key.toLowerCase())) return;
      log({ type: 'key', key: e.key });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [log]);

  // Tick once a second so replies/min stays live between events.
  const active = events.length > 0;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const summary = useMemo(() => summarize(events, now), [events, now]);

  return { summary, log, reset };
}
