import { AAC_BASELINE_WPM, type MetricsSummary } from './useMetrics';

const fmtSec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);

interface Props {
  summary: MetricsSummary;
  onReset?: () => void;
}

export function MetricsPanel({ summary, onReset }: Props) {
  const { effectiveWpm, medianReplyMs, medianSelectMs, medianVoiceMs, medianTotalMs, exchanges } = summary;
  const speedup = effectiveWpm !== null ? effectiveWpm / AAC_BASELINE_WPM : null;

  const stages = [
    { label: 'Replies ready', ms: medianReplyMs, cls: 'stage-replies' },
    { label: 'User chooses', ms: medianSelectMs, cls: 'stage-select' },
    { label: 'Voice starts', ms: medianVoiceMs, cls: 'stage-voice' },
  ];
  const stageTotal = stages.reduce((sum, s) => sum + (s.ms ?? 0), 0);

  return (
    <aside className="panel metrics" aria-label="Live metrics">
      <header className="panel-header">
        <h2>Live metrics</h2>
        {onReset && exchanges.length > 0 && (
          <button type="button" className="link-button" onClick={onReset}>
            Reset
          </button>
        )}
      </header>

      <section className="metric-hero">
        <div className="metric-value">
          {effectiveWpm === null ? '—' : Math.round(effectiveWpm)}
          <span className="metric-unit">WPM</span>
        </div>
        <div className="metric-label">communication rate</div>
        <div className="metric-compare">
          vs ~{AAC_BASELINE_WPM} WPM typical eye-gaze AAC
          {speedup !== null && speedup >= 1 && (
            <strong className="metric-speedup"> · {speedup.toFixed(1)}× faster</strong>
          )}
        </div>
      </section>

      <section className="metric-card">
        <div className="metric-row">
          <span>Partner stops → user speaks</span>
          <strong>{fmtSec(medianTotalMs)}</strong>
        </div>
        {stageTotal > 0 && (
          <div className="stage-bar" role="img" aria-label="Median time per stage">
            {stages.map((s) =>
              s.ms ? (
                <div key={s.label} className={`stage ${s.cls}`} style={{ flexGrow: s.ms }} />
              ) : null,
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
        <p className="metric-footnote">Medians across {exchanges.length} exchange{exchanges.length === 1 ? '' : 's'}</p>
      </section>

      {exchanges.length > 0 && (
        <section className="metric-card">
          <h3>Recent exchanges</h3>
          <ol className="exchange-list">
            {exchanges
              .slice(-5)
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <span>#{e.id}</span>
                  <span>{e.words} words</span>
                  <span>{fmtSec(e.totalMs ?? e.voiceMs)}</span>
                  {e.usedFallbackVoice && <span className="tag">browser voice</span>}
                </li>
              ))}
          </ol>
        </section>
      )}
    </aside>
  );
}
