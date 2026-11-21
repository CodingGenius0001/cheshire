import { BlinkTiltDebugPanel, SELECTION_EVENT_NAME, useBlinkTilt, type SelectionEventDetail } from '../selection';
import './replyTiles.css';

interface ReplyTilesProps {
  replies: string[];
  loading?: boolean;
}

const SKELETON_COUNT = 3;

/**
 * The three reply options. Tilt your head to move the highlight, hold a blink to speak it.
 * Speaking is handled by App.tsx, which listens for the "cheshire:select" choose event
 * that useBlinkTilt (or a click here) dispatches.
 */
export function ReplyTiles({ replies, loading = false }: ReplyTilesProps) {
  // Camera runs the whole time so it's warm when replies arrive; events with no replies on screen are ignored by App.
  const blinkTilt = useBlinkTilt({ replies });
  const { highlighted, status, error } = blinkTilt;

  // Mouse / touch fallback for carers and for demos when lighting is bad.
  const chooseByClick = (index: number) => {
    const detail: SelectionEventDetail = { type: 'choose', index, text: replies[index], at: performance.now() };
    window.dispatchEvent(new CustomEvent<SelectionEventDetail>(SELECTION_EVENT_NAME, { detail }));
  };

  return (
    <div className="reply-tiles">
      <header className="panel-header">
        <h2>Your replies</h2>
        <CameraChip status={status} error={error} />
      </header>

      {loading ? (
        <ol className="tile-list" aria-busy="true" aria-label="Loading replies">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <li key={i} className="tile tile-skeleton">
              <span className="tile-number">{i + 1}</span>
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-line-short" />
            </li>
          ))}
        </ol>
      ) : replies.length === 0 ? (
        <p className="tiles-empty">Replies will appear here when someone speaks to you.</p>
      ) : (
        <ol className="tile-list" aria-label="Reply options">
          {replies.map((reply, i) => {
            const active = i === highlighted;
            return (
              <li key={`${i}-${reply}`}>
                <button
                  type="button"
                  className={`tile ${active ? 'tile-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => chooseByClick(i)}
                >
                  <span className="tile-number">{i + 1}</span>
                  <span className="tile-text">{reply}</span>
                  {active && <span className="tile-hint">Hold a blink to say this</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {replies.length > 0 && !loading && (
        <p className="tiles-help" aria-live="polite">
          <span className="sr-only">
            Option {highlighted !== null ? highlighted + 1 : 1} of {replies.length}:{' '}
            {highlighted !== null ? replies[highlighted] : ''}.
          </span>
          <span aria-hidden>Tilt head ← → to move · hold a blink to speak · press D for camera debug</span>
        </p>
      )}

      <BlinkTiltDebugPanel {...blinkTilt} />
    </div>
  );
}

function CameraChip({ status, error }: { status: string; error: string | null }) {
  const label =
    status === 'running'
      ? 'Camera on'
      : status === 'loading'
        ? 'Starting camera…'
        : status === 'error'
          ? 'Camera off'
          : 'Camera idle';
  return (
    <span className={`camera-chip camera-${status}`} title={error ?? undefined}>
      <span className="camera-dot" aria-hidden />
      {label}
    </span>
  );
}
