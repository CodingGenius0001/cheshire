import { SELECTION_TUNING, type SelectionTuning } from './tuning';

export type SelectionEvent = 'choose' | 'prev' | 'next' | 'nod';

export interface GestureFrame {
  /** Timestamp in ms (performance.now()). */
  t: number;
  /** null when no face is detected this frame. */
  blinkLeft: number | null;
  blinkRight: number | null;
  /** Head roll in degrees, already multiplied by ROLL_SIGN. Negative = user's left. */
  rollDeg: number | null;
  /** Head pitch in degrees (any sign convention). Omit to disable nod detection. */
  pitchDeg?: number | null;
}

export interface GestureState {
  faceVisible: boolean;
  eyesClosed: boolean;
  /** 0..1 progress toward a "choose". */
  blinkProgress: number;
  tiltDirection: 'prev' | 'next' | null;
  /** 0..1 progress toward a prev/next. */
  tiltProgress: number;
  /** ms of cooldown left. */
  cooldownRemaining: number;
  /** Pitch relative to the resting angle, in degrees. */
  pitchOffset: number;
  /** True while the head is out on a possible nod. */
  nodding: boolean;
}

/**
 * Pure state machine: feed it one frame at a time, it returns an event or null.
 * No DOM or MediaPipe here, so it can be unit-tested with fake frames.
 *
 * - Blink: both eyes over threshold for BLINK_HOLD_MS → "choose", once per closure
 *   (eyes must open again before another choose).
 * - Tilt: |roll| over threshold for TILT_HOLD_MS → "prev"/"next", once per tilt
 *   (head must return within TILT_RELEASE_DEG before another).
 * - Nod: pitch leaves its resting angle by NOD_PITCH_DEG and comes back within NOD_MAX_MS → "nod".
 *   Slower moves (looking down at something) just move the resting angle.
 * - COOLDOWN_MS after any event, nothing fires.
 */
export class GestureDetector {
  private blinkStart: number | null = null;
  private blinkLatched = false;

  private tiltDir: 'prev' | 'next' | null = null;
  private tiltStart: number | null = null;
  private tiltLatched = false;

  private pitchBase: number | null = null;
  private nodStart: number | null = null;

  private cooldownUntil = 0;
  private last: GestureState = {
    faceVisible: false,
    eyesClosed: false,
    blinkProgress: 0,
    tiltDirection: null,
    tiltProgress: 0,
    cooldownRemaining: 0,
    pitchOffset: 0,
    nodding: false,
  };

  constructor(private tuning: SelectionTuning = SELECTION_TUNING) {}

  setTuning(tuning: SelectionTuning) {
    this.tuning = tuning;
  }

  get state(): GestureState {
    return this.last;
  }

  reset() {
    this.blinkStart = null;
    this.blinkLatched = false;
    this.tiltDir = null;
    this.tiltStart = null;
    this.tiltLatched = false;
    this.pitchBase = null;
    this.nodStart = null;
  }

  update(f: GestureFrame): SelectionEvent | null {
    const T = this.tuning;
    const inCooldown = f.t < this.cooldownUntil;

    if (f.blinkLeft === null || f.blinkRight === null || f.rollDeg === null) {
      // Face lost: drop any partial hold so it can't fire on re-acquire.
      this.reset();
      this.last = { ...this.emptyState(f.t), faceVisible: false };
      return null;
    }

    // ---- Blink ----
    const eyesClosed = f.blinkLeft > T.BLINK_THRESHOLD && f.blinkRight > T.BLINK_THRESHOLD;
    let blinkProgress = 0;
    let blinkReady = false;
    if (eyesClosed) {
      if (this.blinkStart === null) this.blinkStart = f.t;
      const held = f.t - this.blinkStart;
      blinkProgress = this.blinkLatched ? 0 : clamp01(held / T.BLINK_HOLD_MS);
      blinkReady = !this.blinkLatched && held >= T.BLINK_HOLD_MS;
    } else {
      this.blinkStart = null;
      this.blinkLatched = false;
    }

    // ---- Tilt ----
    const abs = Math.abs(f.rollDeg);
    const dir: 'prev' | 'next' = f.rollDeg < 0 ? 'prev' : 'next';
    let tiltProgress = 0;
    let tiltReady = false;
    if (abs < T.TILT_RELEASE_DEG) {
      this.tiltLatched = false;
    }
    if (abs >= T.TILT_THRESHOLD_DEG) {
      if (this.tiltDir !== dir || this.tiltStart === null) {
        this.tiltDir = dir;
        this.tiltStart = f.t;
      }
      const held = f.t - this.tiltStart;
      tiltProgress = this.tiltLatched ? 0 : clamp01(held / T.TILT_HOLD_MS);
      tiltReady = !this.tiltLatched && held >= T.TILT_HOLD_MS;
    } else {
      // Dipped under the threshold: the hold has to restart.
      this.tiltStart = null;
      if (!this.tiltLatched) this.tiltDir = null;
    }

    // ---- Nod ----
    let nodReady = false;
    let pitchOffset = 0;
    const pitch = f.pitchDeg ?? null;
    if (pitch !== null) {
      if (this.pitchBase === null) this.pitchBase = pitch;
      pitchOffset = pitch - this.pitchBase;
      const out = Math.abs(pitchOffset);
      if (this.nodStart === null) {
        if (out >= T.NOD_PITCH_DEG && abs < T.TILT_RELEASE_DEG) this.nodStart = f.t;
        else this.pitchBase += T.NOD_BASELINE_ALPHA * (pitch - this.pitchBase);
      } else if (f.t - this.nodStart > T.NOD_MAX_MS) {
        // Too slow for a nod: the user moved and stayed. Treat the new angle as rest.
        this.pitchBase = pitch;
        this.nodStart = null;
      } else if (out <= T.NOD_RETURN_DEG) {
        nodReady = f.t - this.nodStart >= T.NOD_MIN_MS;
        this.nodStart = null;
      }
    }

    // ---- Fire (blink, then nod, then tilt, if several are ready on the same frame) ----
    let event: SelectionEvent | null = null;
    if (!inCooldown) {
      if (blinkReady) {
        event = 'choose';
        this.blinkLatched = true;
      } else if (nodReady) {
        event = 'nod';
      } else if (tiltReady) {
        event = this.tiltDir;
        this.tiltLatched = true;
      }
    }
    if (event) {
      this.cooldownUntil = f.t + T.COOLDOWN_MS;
      // Anything that was mid-hold restarts after the cooldown instead of firing right at its end.
      if (event === 'choose') this.tiltStart = this.tiltStart === null ? null : f.t + T.COOLDOWN_MS;
      else this.blinkStart = this.blinkStart === null ? null : f.t + T.COOLDOWN_MS;
    }

    this.last = {
      faceVisible: true,
      eyesClosed,
      blinkProgress: event === 'choose' ? 1 : blinkProgress,
      tiltDirection: abs >= T.TILT_THRESHOLD_DEG ? dir : null,
      tiltProgress: event === 'prev' || event === 'next' ? 1 : tiltProgress,
      cooldownRemaining: Math.max(0, this.cooldownUntil - f.t),
      pitchOffset,
      nodding: this.nodStart !== null,
    };
    return event;
  }

  private emptyState(t: number): GestureState {
    return {
      faceVisible: false,
      eyesClosed: false,
      blinkProgress: 0,
      tiltDirection: null,
      tiltProgress: 0,
      cooldownRemaining: Math.max(0, this.cooldownUntil - t),
      pitchOffset: 0,
      nodding: false,
    };
  }
}

/**
 * Roll (rotation about the camera's Z axis) in degrees from MediaPipe's
 * 4x4 facial transformation matrix. MediaPipe packs it column-major, so
 * data[0] = R00 (cos) and data[1] = R10 (sin) for a pure roll.
 */
export function rollFromMatrix(data: ArrayLike<number>): number {
  return (Math.atan2(data[1], data[0]) * 180) / Math.PI;
}

/**
 * Pitch (rotation about the camera's X axis, nodding) in degrees from the same matrix:
 * R21 = data[6], R22 = data[10] column-major. Nod detection ignores the sign.
 */
export function pitchFromMatrix(data: ArrayLike<number>): number {
  return (Math.atan2(data[6], data[10]) * 180) / Math.PI;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
