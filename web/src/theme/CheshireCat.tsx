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

/*
 * The limb the cat lies along, engraved in moonlight like Tenniel's line work:
 * an outlined, lightly filled limb that tapers to a twig on the left, with hatching
 * on its shadow side. Geometry is computed once from a centre line and a thickness.
 */
const LIMB = (() => {
  const centre = (x: number) => 24 + 5 * Math.sin(x / 130) + 5 * (x / 900);
  // Thickens toward the cat, then tapers to a tip under its tail instead of a square cut.
  const half = (x: number) => (0.8 + 6.4 * Math.pow(x / 900, 0.8)) * Math.min(1, Math.max(0.12, (918 - x) / 70));
  const xs = Array.from({ length: 48 }, (_, i) => 24 + i * 19);
  const pt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const top = xs.map((x) => pt(x, centre(x) - half(x)));
  const bottom = xs.slice().reverse().map((x) => pt(x, centre(x) + half(x)));
  const outline = `M${top.join(' L')} L${bottom.join(' L')} Z`;
  const hatches = Array.from({ length: 96 }, (_, i) => 60 + i * 8.8)
    .map((x) => `M${pt(x, centre(x) + half(x) * 0.15)} L${pt(x - 3.5, centre(x) + half(x) * 0.95)}`)
    .join(' ');
  return { outline, hatches };
})();

export function Branch() {
  return (
    <svg className="cheshire-branch" viewBox="0 0 924 48" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
      <path d={LIMB.outline} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={LIMB.hatches} fill="none" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7" />
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M612 29 q-22 -16 -46 -22" />
        <path d="M468 27 q-16 12 -40 16" />
        <path d="M330 22 q-14 -12 -38 -15" />
        <path d="M196 24 q-14 10 -30 14" />
        <path d="M770 30 q18 -14 40 -18" />
      </g>
      <g fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1">
        <path d="M566 7 q10 -9 20 1 q-10 8 -20 -1z" />
        <path d="M428 43 q8 -10 19 -3 q-8 9 -19 3z" />
        <path d="M292 7 q9 -8 19 0 q-10 8 -19 0z" />
        <path d="M166 38 q7 -9 17 -4 q-7 8 -17 4z" />
        <path d="M810 12 q10 -8 19 1 q-10 7 -19 -1z" />
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
