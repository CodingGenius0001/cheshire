import type { MetricEvent, MetricsSummary } from './useMetrics';

const fmtSec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);

const clip = (text: string, max = 28) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function describe(e: MetricEvent): string {
  switch (e.type) {
    case 'partner_turn':
      return `Partner: “${clip(e.text)}”`;
    case 'replies_requested':
      return 'Requested replies';
    case 'replies_shown':
      return `${e.count} replies shown`;
    case 'replies_failed':
      return `Replies failed: ${clip(e.message)}`;
    case 'selection':
      if (e.gesture === 'nod') return 'Nod: show replies';
      return `${e.gesture === 'choose' ? 'Blink choose' : `Tilt ${e.gesture}`} → #${e.index + 1}`;
    case 'key':
      return `Key ${e.key === ' ' ? 'Space' : e.key}`;
    case 'spoken':
      return `Said “${clip(e.text)}” (${e.text.length} chars)`;
    case 'voice_started':
      return e.fallback ? 'Voice started (browser fallback)' : 'Voice started';
  }
}

interface Props {
  summary: MetricsSummary;
  onReset?: () => void;
}

export function MetricsPanel({ summary, onReset }: Props) {
  const {
    ksr,
    inputs,
    charsSpoken,
    repliesPerMinute,
    repliesSpoken,
    medianReplyMs,
    medianSelectMs,
    medianVoiceMs,
    medianTotalMs,
    events,
    sessionStart,
  } = summary;

  const stages = [
    { label: 'Replies ready', ms: medianReplyMs, cls: 'stage-replies' },
    { label: 'User chooses (incl. nod)', ms: medianSelectMs, cls: 'stage-select' },
    { label: 'Voice starts', ms: medianVoiceMs, cls: 'stage-voice' },
  ];
  const hasStages = stages.some((s) => s.ms);

  return (
    <aside className="panel metrics" aria-label="Live metrics">
      <header className="panel-header">
        <h2>Live metrics</h2>
        {onReset && events.length > 0 && (
          <button type="button" className="link-button" onClick={onReset}>
            Reset
          </button>
        )}
      </header>

      <section className="metric-hero">
        <div className="metric-value">
          {ksr === null ? '—' : Math.round(ksr * 100)}
          <span className="metric-unit">%</span>
        </div>
        <div className="metric-label">keystroke savings</div>
        <div className="metric-compare">
          {inputs} input{inputs === 1 ? '' : 's'} → {charsSpoken} characters spoken
        </div>
      </section>

      <div className="metric-tiles">
        <section className="metric-tile">
          <div className="metric-tile-value">{repliesPerMinute === null ? '—' : repliesPerMinute.toFixed(1)}</div>
          <div className="metric-tile-label">replies / min</div>
        </section>
        <section className="metric-tile">
          <div className="metric-tile-value">{fmtSec(medianReplyMs)}</div>
          <div className="metric-tile-label">median reply delay</div>
        </section>
      </div>

      <section className="metric-card">
        <div className="metric-row">
          <span>Partner stops → user speaks</span>
          <strong>{fmtSec(medianTotalMs)}</strong>
        </div>
        {hasStages && (
          <div className="stage-bar" role="img" aria-label="Median time per stage">
            {stages.map((s) =>
              s.ms ? <div key={s.label} className={`stage ${s.cls}`} style={{ flexGrow: s.ms }} /> : null,
            )}
          </div>
        )}
        {stages.map((s) => (
          <div key={s.label} className="metric-row metric-row-sub">
            <span>
              <i className={`dot ${s.cls}`} /> {s.label}
            </span>
            <span>{fmtSec(s.ms)}</span>
          </div>
        ))}
        <p className="metric-footnote">
          Medians · {repliesSpoken} repl{repliesSpoken === 1 ? 'y' : 'ies'} spoken
        </p>
      </section>

      <section className="metric-card">
        <h3>Event log</h3>
        {events.length === 0 ? (
          <p className="metric-footnote">No events yet</p>
        ) : (
          <ol className="event-log">
            {events
              .slice(-12)
              .reverse()
              .map((e, i) => (
                <li key={events.length - i}>
                  <span className="event-time">+{Math.floor((e.at - (sessionStart ?? e.at)) / 1000)}s</span>
                  <span>{describe(e)}</span>
                </li>
              ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
