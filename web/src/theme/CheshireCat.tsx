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

/** The limb the cat lies along, engraved in moonlight; it runs under the header like a garden wall. */
export function Branch() {
  return (
    <svg className="cheshire-branch" viewBox="0 0 900 48" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
      <path
        d="M900 25 C760 23 660 31 560 27 C460 23 360 15 250 19 C170 22 100 25 34 17 C100 29 172 28 252 25 C362 21 462 31 562 34 C662 37 762 32 900 38 Z"
        fill="currentColor"
      />
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M612 31 q-22 -16 -46 -22" />
        <path d="M468 26 q-16 12 -40 18" />
        <path d="M330 20 q-14 -12 -38 -15" />
        <path d="M196 24 q-14 10 -30 14" />
        <path d="M760 29 q18 -14 40 -18" />
        <path d="M700 31 q-10 6 -26 8 M520 30 q-8 5 -20 6 M380 19 q-8 -4 -18 -4" strokeWidth="1.2" />
      </g>
      <g fill="currentColor">
        <path d="M566 9 q10 -9 20 1 q-10 8 -20 -1z" />
        <path d="M428 44 q8 -10 19 -3 q-8 9 -19 3z" />
        <path d="M292 5 q9 -8 19 0 q-10 8 -19 0z" />
        <path d="M166 38 q7 -9 17 -4 q-7 8 -17 4z" />
        <path d="M800 11 q10 -8 19 1 q-10 7 -19 -1z" />
        <path d="M60 15 q6 -8 15 -3 q-6 7 -15 3z" />
      </g>
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
      <img className="cheshire-cat" src={catArt} alt="" width={780} height={450} />
      <Grin className="cheshire-grin" />
    </div>
  );
}
