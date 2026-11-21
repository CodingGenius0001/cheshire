import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  GestureDetector,
  pitchFromMatrix,
  rollFromMatrix,
  type GestureState,
  type SelectionEvent,
} from './gestureDetector';
import { FACE_LANDMARKER_MODEL_URL, SELECTION_TUNING, WASM_BASE_URL, type SelectionTuning } from './tuning';

export type { SelectionEvent } from './gestureDetector';
export { SELECTION_TUNING } from './tuning';

/**
 * Window event fired for every selection, so other parts of the app can listen without importing this hook.
 * App.tsx acts on { type: 'choose', index, text }; prev/next carry the newly highlighted index;
 * 'nod' means the user wants to answer (with requireNod it reveals the replies).
 */
export const SELECTION_EVENT_NAME = 'cheshire:select';
export type SelectionEventDetail = {
  type: SelectionEvent;
  /** Highlighted reply after this event (undefined when there are no replies on screen). */
  index?: number;
  /** replies[index], so listeners don't need their own copy of the list. */
  text?: string;
  at: number;
};

export type BlinkTiltStatus = 'idle' | 'loading' | 'running' | 'error';

export interface BlinkTiltDebug extends GestureState {
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  /** Highest recent score per eye, decaying slowly, so a blink's top value can be read off. */
  eyeBlinkLeftPeak: number;
  eyeBlinkRightPeak: number;
  rollDeg: number;
  pitchDeg: number;
  fps: number;
  /** Top blendshapes this frame, highest first. */
  topBlendshapes: { name: string; score: number }[];
}

export interface UseBlinkTiltOptions {
  /**
   * The replies currently on screen. Tilt moves the highlight through them (wrapping),
   * blink chooses the highlighted one. The highlight resets to 0 when the list changes.
   */
  replies?: string[];
  /**
   * Replies stay hidden until the user nods. While hidden, tilt and blink do nothing;
   * after a choose they hide again. Default false (replies always live).
   */
  requireNod?: boolean;
  /** Called for every choose/prev/next/nod. Also dispatched as a "cheshire:select" window event. */
  onSelect?: (detail: SelectionEventDetail) => void;
  /** Set false to release the camera and stop detection. Default true. */
  enabled?: boolean;
  /** Override any of the constants in SELECTION_TUNING. */
  tuning?: Partial<SelectionTuning>;
}

export interface UseBlinkTiltResult {
  status: BlinkTiltStatus;
  error: string | null;
  /** The webcam stream, for an optional preview <video>. */
  stream: MediaStream | null;
  lastEvent: SelectionEventDetail | null;
  /** Index of the highlighted reply, or null when there are no replies. Render this as the focus ring. */
  highlighted: number | null;
  /** With requireNod: whether the user has nodded and the replies should be shown. Always true otherwise. */
  revealed: boolean;
  /** Show the replies as if the user nodded (mouse/touch fallback). Dispatches a 'nod' event. */
  reveal: () => void;
  /** Hide the replies again (e.g. after a click choice). */
  hide: () => void;
  /** Toggled with the D key. */
  debugVisible: boolean;
  setDebugVisible: (v: boolean) => void;
  /** Live scores, refreshed only while the debug panel is visible. */
  debug: BlinkTiltDebug | null;
  tuning: SelectionTuning;
}

export function useBlinkTilt(options: UseBlinkTiltOptions = {}): UseBlinkTiltResult {
  const { replies, onSelect, enabled = true, requireNod = false, tuning: tuningOverride } = options;
  const requireNodRef = useRef(requireNod);
  requireNodRef.current = requireNod;
  const revealedRef = useRef(false);
  const [revealed, setRevealedState] = useState(false);
  const setRevealed = (v: boolean) => {
    revealedRef.current = v;
    setRevealedState(v);
  };

  const repliesRef = useRef<string[]>([]);
  repliesRef.current = replies ?? [];
  const highlightedRef = useRef(0);
  const [highlighted, setHighlighted] = useState(0);
  // New set of replies → start from the first one again.
  const repliesKey = (replies ?? []).join('\u0000');
  useEffect(() => {
    highlightedRef.current = 0;
    setHighlighted(0);
  }, [repliesKey]);

  const [status, setStatus] = useState<BlinkTiltStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastEvent, setLastEvent] = useState<SelectionEventDetail | null>(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debug, setDebug] = useState<BlinkTiltDebug | null>(null);

  const tuning: SelectionTuning = { ...SELECTION_TUNING, ...tuningOverride };

  // Refs so the per-frame loop always sees current values without restarting the camera.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const debugVisibleRef = useRef(debugVisible);
  debugVisibleRef.current = debugVisible;
  const detectorRef = useRef(new GestureDetector(tuning));

  const emit = (detail: SelectionEventDetail) => {
    setLastEvent(detail);
    onSelectRef.current?.(detail);
    window.dispatchEvent(new CustomEvent<SelectionEventDetail>(SELECTION_EVENT_NAME, { detail }));
  };

  // D toggles the debug panel (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'd' && e.key !== 'D') return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      setDebugVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    let raf = 0;
    let landmarker: FaceLandmarker | null = null;
    let media: MediaStream | null = null;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const detector = detectorRef.current;
    detector.reset();

    let lastVideoTime = -1;
    let lastDebugPush = 0;
    let frameCount = 0;
    let fpsWindowStart = performance.now();
    let fps = 0;
    let peakL = 0;
    let peakR = 0;
    let lastFrameT = performance.now();
    const PEAK_DECAY_PER_SEC = 0.15;

    const fire = (type: SelectionEvent, at: number) => {
      const gated = requireNodRef.current;
      if (gated && type !== 'nod' && !revealedRef.current) return; // replies hidden: wait for a nod
      if (gated && type === 'nod') {
        highlightedRef.current = 0;
        setHighlighted(0);
        setRevealed(true);
      }
      const list = repliesRef.current;
      let index: number | undefined;
      if (list.length > 0) {
        const n = list.length;
        let i = Math.min(highlightedRef.current, n - 1);
        if (type === 'next') i = (i + 1) % n;
        else if (type === 'prev') i = (i - 1 + n) % n;
        highlightedRef.current = i;
        setHighlighted(i);
        index = i;
      }
      const detail: SelectionEventDetail = { type, index, text: index !== undefined ? list[index] : undefined, at };
      if (gated && type === 'choose' && index !== undefined) setRevealed(false);
      emit(detail);
    };

    const loop = () => {
      if (cancelled || !landmarker) return;
      raf = requestAnimationFrame(loop);
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const T = tuningRef.current;
      detector.setTuning(T);

      const shapes = result.faceBlendshapes?.[0]?.categories;
      const matrix = result.facialTransformationMatrixes?.[0];
      let blinkL: number | null = null;
      let blinkR: number | null = null;
      let roll: number | null = null;
      let pitch: number | null = null;
      if (shapes && matrix) {
        // Blendshape names are from the subject's point of view, same as we want.
        blinkL = shapes.find((c) => c.categoryName === 'eyeBlinkLeft')?.score ?? 0;
        blinkR = shapes.find((c) => c.categoryName === 'eyeBlinkRight')?.score ?? 0;
        roll = rollFromMatrix(matrix.data) * T.ROLL_SIGN;
        pitch = pitchFromMatrix(matrix.data);
      }

      const event = detector.update({ t: now, blinkLeft: blinkL, blinkRight: blinkR, rollDeg: roll, pitchDeg: pitch });
      if (event) fire(event, now);

      const decay = ((now - lastFrameT) / 1000) * PEAK_DECAY_PER_SEC;
      lastFrameT = now;
      peakL = Math.max(blinkL ?? 0, peakL - decay);
      peakR = Math.max(blinkR ?? 0, peakR - decay);

      frameCount++;
      if (now - fpsWindowStart >= 1000) {
        fps = (frameCount * 1000) / (now - fpsWindowStart);
        frameCount = 0;
        fpsWindowStart = now;
      }

      if (debugVisibleRef.current && (event || now - lastDebugPush >= T.DEBUG_REFRESH_MS)) {
        lastDebugPush = now;
        setDebug({
          ...detector.state,
          eyeBlinkLeft: blinkL ?? 0,
          eyeBlinkRight: blinkR ?? 0,
          eyeBlinkLeftPeak: peakL,
          eyeBlinkRightPeak: peakR,
          rollDeg: roll ?? 0,
          pitchDeg: pitch ?? 0,
          fps,
          topBlendshapes: shapes
            ? [...shapes]
                .filter((c) => c.categoryName !== '_neutral')
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
                .map((c) => ({ name: c.categoryName, score: c.score }))
            : [],
        });
      }
    };

    (async () => {
      try {
        setStatus('loading');
        setError(null);

        const [lm, cam] = await Promise.all([
          createLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          }),
        ]);
        landmarker = lm;
        media = cam;
        if (cancelled) return;

        video.srcObject = cam;
        await video.play();
        if (cancelled) return;

        setStream(cam);
        setStatus('running');
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera permission was denied.'
            : e instanceof Error
              ? e.message
              : String(e);
        setError(msg);
        setStatus('error');
      } finally {
        // If we were unmounted mid-load, release whatever did get created.
        if (cancelled) {
          media?.getTracks().forEach((t) => t.stop());
          landmarker?.close();
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      media?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      landmarker?.close();
      landmarker = null;
      setStream(null);
    };
  }, [enabled]);

  const reveal = () => {
    highlightedRef.current = 0;
    setHighlighted(0);
    setRevealed(true);
    const list = repliesRef.current;
    emit({ type: 'nod', index: list.length ? 0 : undefined, text: list[0], at: performance.now() });
  };
  const hide = () => setRevealed(false);

  return {
    status,
    error,
    stream,
    lastEvent,
    revealed: requireNod ? revealed : true,
    reveal,
    hide,
    highlighted: (replies?.length ?? 0) > 0 ? Math.min(highlighted, replies!.length - 1) : null,
    debugVisible,
    setDebugVisible,
    debug: debugVisible ? debug : null,
    tuning,
  };
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const make = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  try {
    return await make('GPU');
  } catch {
    return await make('CPU');
  }
}
