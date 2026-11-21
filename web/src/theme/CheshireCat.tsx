import catArt from './assets/tenniel-cheshire-cat.webp';

/** What the cat is doing mirrors what Cheshire is doing. Styles key off `.app[data-mood]`. */
export type Mood = 'idle' | 'listening' | 'thinking' | 'choosing' | 'speaking';

// Upper teeth hang from the top lip of the grin, Tenniel-style.
const TEETH = Array.from({ length: 9 }, (_, i) => {
  const t = 0.14 + i * 0.09;
  const x = 4 + 112 * t;
  const top = 8 + 30 * t * (1 - t);
  return { x, top, bottom: top + 18 * t * (1 - t) + 3 };
});

/** The grin without a cat: an engraved crescent smile. Inherits `color`. */
export function Grin({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 44" aria-hidden="true" focusable="false">
      <path d="M4 8 Q60 30 116 8 Q60 60 4 8Z" fill="currentColor" opacity="0.16" />
      <path d="M4 8 Q60 60 116 8" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M4 8 Q60 30 116 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {TEETH.map(({ x, top, bottom }) => (
        <path key={x} d={`M${x.toFixed(1)} ${top.toFixed(1)}V${bottom.toFixed(1)}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ))}
      <path d="M1 4 Q3 9 7 9 M119 4 Q117 9 113 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * John Tenniel's Cheshire Cat (1865, public domain), inverted to moonlight.
 * Purely decorative: the status pill already says what the app is doing.
 */
export function CheshireCat() {
  return (
    <div className="cheshire" aria-hidden="true">
      <span className="cheshire-moon" />
      <img className="cheshire-cat" src={catArt} alt="" width={420} height={300} />
      <Grin className="cheshire-grin" />
    </div>
  );
}
