import { useEffect, useRef, type CSSProperties } from 'react';
import type { UseBlinkTiltResult } from './useBlinkTilt';

/**
 * Small fixed overlay with live blendshape scores. Renders nothing unless
 * debug is toggled on (D key). Drop it anywhere: <BlinkTiltDebugPanel {...blinkTilt} />
 */
export function BlinkTiltDebugPanel(props: UseBlinkTiltResult) {
  const { debugVisible, debug, status, error, stream, lastEvent, tuning: T } = props;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, debugVisible]);

  if (!debugVisible) return null;

  const rollPct = debug ? Math.max(-1, Math.min(1, debug.rollDeg / 45)) : 0;
  const tiltPct = Math.min(1, T.TILT_THRESHOLD_DEG / 45);

  return (
    <div style={S.panel} role="status" aria-label="Blink and tilt debug">
      <div style={S.header}>
        <strong>Selection debug</strong>
        <span style={S.muted}>D to hide</span>
      </div>

      <div style={S.row}>
        <video ref={videoRef} autoPlay muted playsInline style={S.video} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div>
            status: <b>{status}</b>
            {debug && ` · ${debug.fps.toFixed(0)} fps`}
          </div>
          {error && <div style={{ color: '#ff8a80' }}>{error}</div>}
          <div>face: {debug?.faceVisible ? 'yes' : 'no'}</div>
          <div>
            last: <b>{lastEvent ? lastEvent.type : '-'}</b>
            {lastEvent?.index !== undefined && ` #${lastEvent.index + 1}`}
          </div>
          <div>cooldown: {debug ? Math.round(debug.cooldownRemaining) : 0} ms</div>
        </div>
      </div>

      <Bar label="eyeBlinkLeft" value={debug?.eyeBlinkLeft ?? 0} threshold={T.BLINK_THRESHOLD} />
      <Bar label="eyeBlinkRight" value={debug?.eyeBlinkRight ?? 0} threshold={T.BLINK_THRESHOLD} />
      <Bar label={`blink hold (${T.BLINK_HOLD_MS}ms)`} value={debug?.blinkProgress ?? 0} accent="#7ee787" />

      <div style={S.label}>
        <span>roll</span>
        <span>
          {debug ? debug.rollDeg.toFixed(1) : '0.0'}° {debug?.tiltDirection ? `→ ${debug.tiltDirection}` : ''}
        </span>
      </div>
      <div style={S.track}>
        <div style={{ ...S.tick, left: `${50 - tiltPct * 50}%` }} />
        <div style={{ ...S.tick, left: `${50 + tiltPct * 50}%` }} />
        <div style={{ ...S.tick, left: '50%', opacity: 0.3 }} />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${50 + Math.min(0, rollPct) * 50}%`,
            width: `${Math.abs(rollPct) * 50}%`,
            background: '#79c0ff',
          }}
        />
      </div>
      <div style={{ ...S.label, ...S.muted }}>
        <span>prev (left)</span>
        <span>next (right)</span>
      </div>
      <Bar label={`tilt hold (${T.TILT_HOLD_MS}ms)`} value={debug?.tiltProgress ?? 0} accent="#7ee787" />

      {debug && debug.topBlendshapes.length > 0 && (
        <details style={{ marginTop: 6 }}>
          <summary style={S.muted}>top blendshapes</summary>
          {debug.topBlendshapes.map((b) => (
            <Bar key={b.name} label={b.name} value={b.score} />
          ))}
        </details>
      )}
    </div>
  );
}

function Bar({
  label,
  value,
  threshold,
  accent,
}: {
  label: string;
  value: number;
  threshold?: number;
  accent?: string;
}) {
  const over = threshold !== undefined && value > threshold;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={S.label}>
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div style={S.track}>
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            background: accent ?? (over ? '#ffa657' : '#8b949e'),
          }}
        />
        {threshold !== undefined && <div style={{ ...S.tick, left: `${threshold * 100}%` }} />}
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  panel: {
    position: 'fixed',
    right: 12,
    bottom: 12,
    width: 280,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100vh - 24px)',
    overflowY: 'auto',
    padding: 10,
    background: 'rgba(13,17,23,0.92)',
    color: '#e6edf3',
    font: '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    zIndex: 9999,
  },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  row: { display: 'flex', gap: 8, marginBottom: 6 },
  video: { width: 96, height: 72, objectFit: 'cover', transform: 'scaleX(-1)', borderRadius: 4, background: '#000' },
  label: { display: 'flex', justifyContent: 'space-between' },
  track: { position: 'relative', height: 6, background: '#30363d', borderRadius: 3, overflow: 'hidden' },
  tick: { position: 'absolute', top: -2, bottom: -2, width: 2, marginLeft: -1, background: '#f85149' },
  muted: { opacity: 0.6 },
};
