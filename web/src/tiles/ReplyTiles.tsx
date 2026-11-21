import { BlinkTiltDebugPanel, SELECTION_EVENT_NAME, useBlinkTilt, type SelectionEventDetail } from '../selection';
import './replyTiles.css';

interface ReplyTilesProps {
  replies: string[];
  loading?: boolean;
}

const SKELETON_COUNT = 3;

/** Each reply is a card from the Queen of Hearts' deck. */
const SUITS = [
  { glyph: '♥', color: 'red' },
  { glyph: '♠', color: 'black' },
  { glyph: '♦', color: 'red' },
  { glyph: '♣', color: 'black' },
] as const;
const suitOf = (i: number) => SUITS[i % SUITS.length];

/** Card corner index ("1♥"). Decorative: the option number is read out by the sr-only label. */
function CardPip({ index, corner }: { index: number; corner: 'top' | 'bottom' }) {
  return (
    <span className={`card-pip card-pip-${corner}`} aria-hidden>
      <span className="card-pip-rank">{index + 1}</span>
      <span className="card-pip-suit">{suitOf(index).glyph}</span>
    </span>
  );
}

/**
 * The three reply options. They stay face down until the user nods to say they want to answer;
 * then tilt moves the highlight and a held blink speaks it, and the cards go face down again.
 * Speaking is handled by App.tsx, which listens for the "cheshire:select" choose event
 * that useBlinkTilt (or a click here) dispatches.
 */
export function ReplyTiles({ replies, loading = false }: ReplyTilesProps) {
  // Camera runs the whole time so it's warm when replies arrive; tilt/blink only act once the user nods.
  const blinkTilt = useBlinkTilt({ replies, requireNod: true });
  const { highlighted, status, error, revealed, reveal, hide } = blinkTilt;

  // Mouse / touch fallback for carers and for demos when lighting is bad.
  const chooseByClick = (index: number) => {
    const detail: SelectionEventDetail = { type: 'choose', index, text: replies[index], at: performance.now() };
    window.dispatchEvent(new CustomEvent<SelectionEventDetail>(SELECTION_EVENT_NAME, { detail }));
    hide();
  };

  return (
    <div className="reply-tiles">
      <header className="panel-header">
        <h2>Your replies</h2>
        <CameraChip status={status} error={error} />
      </header>

      {!revealed ? (
        <NodPrompt ready={!loading && replies.length > 0} loading={loading} onReveal={reveal} />
      ) : loading ? (
        <ol className="tile-list" aria-busy="true" aria-label="Loading replies">
          {/* Face-down cards while the deck is shuffled. */}
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <li key={i} className="tile tile-skeleton card-back">
              <span className="card-back-mark" aria-hidden>
                ♥ ♠ ♦ ♣
              </span>
            </li>
          ))}
        </ol>
      ) : replies.length === 0 ? (
        <p className="tiles-empty">
          <span className="tiles-empty-suits" aria-hidden>
            ♥ ♠ ♦ ♣
          </span>
          Replies will appear here when someone speaks to you.
        </p>
      ) : (
        <ol className="tile-list" aria-label="Reply options">
          {replies.map((reply, i) => {
            const active = i === highlighted;
            return (
              <li key={`${i}-${reply}`}>
                <button
                  type="button"
                  className={`tile card-${suitOf(i).color} ${active ? 'tile-active' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => chooseByClick(i)}
                >
                  <CardPip index={i} corner="top" />
                  <span className="sr-only">Option {i + 1}: </span>
                  <span className="tile-text">{reply}</span>
                  {active && <span className="tile-hint">Hold a blink to say this</span>}
                  <CardPip index={i} corner="bottom" />
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {revealed && replies.length > 0 && !loading && (
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

/** Face-down deck shown until the user nods. The button is the click fallback for the nod. */
function NodPrompt({ ready, loading, onReveal }: { ready: boolean; loading: boolean; onReveal: () => void }) {
  const status = ready ? 'Your replies are ready.' : loading ? 'Thinking of replies…' : 'Listening…';
  return (
    <div className="nod-prompt">
      <div className="nod-deck" aria-hidden>
        <span className="tile card-back nod-card nod-card-1" />
        <span className="tile card-back nod-card nod-card-2" />
        <span className="tile card-back nod-card nod-card-3">
          <span className="card-back-mark">♥ ♠ ♦ ♣</span>
        </span>
      </div>
      <p className="nod-title">Nod when you want to answer</p>
      <p className="nod-status" aria-live="polite">
        {status}
      </p>
      <button type="button" className="nod-button" onClick={onReveal}>
        Show replies
      </button>
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
