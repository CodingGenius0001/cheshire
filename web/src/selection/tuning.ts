/**
 * Tunable constants for hands-free selection.
 * Change these during testing; the debug panel (press D) shows live values
 * against these thresholds so you can see what each user actually produces.
 */
export const SELECTION_TUNING = {
  /** Both eyeBlinkLeft and eyeBlinkRight must be above this (0..1) to count as "eyes closed". */
  BLINK_THRESHOLD: 0.5,
  /** Eyes must stay closed this long to count as a deliberate blink. Normal blinks are ~100-150 ms. */
  BLINK_HOLD_MS: 400,

  /** Head roll (degrees) past which a tilt starts counting. */
  TILT_THRESHOLD_DEG: 15,
  /** Roll must stay past the threshold this long to fire prev/next. */
  TILT_HOLD_MS: 300,
  /** After a tilt fires, the head must come back inside this angle before another tilt can fire. */
  TILT_RELEASE_DEG: 10,
  /**
   * Flip to -1 if "prev"/"next" come out backwards on your setup.
   * With +1, tilting toward your LEFT shoulder = "prev", RIGHT shoulder = "next".
   * Check once with the debug panel: the roll readout should go negative when you tilt left.
   */
  ROLL_SIGN: 1 as 1 | -1,

  /** No events at all for this long after any event fires. */
  COOLDOWN_MS: 600,

  /** How often the debug panel re-renders (ms). Detection itself runs every video frame. */
  DEBUG_REFRESH_MS: 100,
};

export type SelectionTuning = typeof SELECTION_TUNING;

/** Pinned so the WASM files match the npm package version. Keep in sync with package.json. */
export const TASKS_VISION_VERSION = '1.2.3';
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
export const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
