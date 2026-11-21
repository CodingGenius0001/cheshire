/*
 * Reply-engine eval: 20 scripted conversations -> POST /api/replies, one at a time.
 * Prints the 3 replies + latency for each, checks the basic rules, then the median latency.
 *
 *   npx tsx scripts/eval.ts                      (hits the real server: npm run dev, port 3001)
 *   REPLIES_URL=http://localhost:8787/api/replies npx tsx scripts/eval.ts   (scripts/serve-replies.ts)
 *
 * Target: median < 2000 ms. If slower, rerun the server with REPLIES_MODEL=claude-haiku-5-5 and compare.
 */

type Speaker = 'partner' | 'user';
interface Turn {
  speaker: Speaker;
  text: string;
}
interface Case {
  name: string;
  profile: Record<string, unknown>;
  history: Turn[];
  partial?: string;
}

const URL_ = process.env.REPLIES_URL ?? 'http://localhost:3001/api/replies';

const maya = {
  name: 'Maya',
  age: 34,
  condition: 'ALS, speech getting harder',
  lives_with: 'husband Dan and their dog Biscuit',
  kids: 'daughter Lily, 7',
  job: 'high school chemistry teacher, on leave',
  likes: ['iced coffee', 'the Dodgers', 'gardening', 'mystery novels'],
  dislikes: ['being rushed', 'hospital food'],
};
const ray = {
  name: 'Ray',
  age: 68,
  condition: 'recovering from a stroke; aphasia',
  family: 'wife Carol; son Marcus lives in Phoenix',
  former_job: 'machinist for 40 years',
  likes: ['fishing', 'old westerns', 'black coffee'],
  diet: 'low sodium',
};

const P = (text: string): Turn => ({ speaker: 'partner', text });
const U = (text: string): Turn => ({ speaker: 'user', text });

const CASES: Case[] = [
  { name: 'coffee order', profile: maya, history: [P('Hey Maya! What can I get you today?')] },
  { name: 'doctor pain check', profile: maya, history: [P("Morning. How's the pain been since we changed the dose?")] },
  { name: 'daughter homework', profile: maya, history: [P('Mom, can you help me with my spelling words after dinner?')] },
  {
    name: 'husband dinner plans',
    profile: maya,
    history: [P('I was thinking pasta tonight.'), U('Sounds good.'), P('Want me to invite my sister too?')],
  },
  { name: 'old colleague', profile: maya, history: [P("Maya! The kids in third period miss you so much. When are you coming back?")] },
  { name: 'stranger small talk', profile: maya, history: [P("Is that a Dodgers hat? Did you catch last night's game?")] },
  {
    name: 'hospital lunch',
    profile: maya,
    history: [P("Lunch is here. It's the chicken and rice again."), U('Again?'), P('Sorry hon, want me to see if there is anything else?')],
  },
  { name: 'neighbor favor', profile: maya, history: [P("I'm heading to the store, need anything?")] },
  {
    name: 'rushed nurse',
    profile: maya,
    history: [P("Okay we need to get you up for your walk now, let's go, quick quick.")],
  },
  { name: 'emotional friend', profile: maya, history: [P("I just... I don't know what to say. How are you really doing?")] },
  { name: 'partial: coffee', profile: maya, history: [P('Want anything from the coffee place?')], partial: 'iced' },
  { name: 'partial: tired', profile: maya, history: [P('Do you want to go to the park this afternoon?')], partial: 'tired' },
  { name: 'Ray therapist', profile: ray, history: [P("Ray, let's try a few more word exercises today. Ready?")] },
  { name: 'Ray son call', profile: ray, history: [P("Hey Dad, it's Marcus. Carol says you're doing better?")] },
  {
    name: 'Ray fishing invite',
    profile: ray,
    history: [P('The lake opens next weekend.'), U('Oh nice.'), P('Want to come out on the boat with me and Jim?')],
  },
  { name: 'Ray salty food', profile: ray, history: [P('These fries are amazing, want some?')] },
  { name: 'Ray unknown fact', profile: ray, history: [P("What was your first car, Ray? I bet it was something cool.")] },
  {
    name: 'Ray long thread (12 turns)',
    profile: ray,
    history: [
      P('Morning Ray.'), U('Morning.'), P('Sleep okay?'), U('Not great.'), P('Back hurting again?'), U('A little.'),
      P('Carol called, she is running late.'), U('Okay.'), P("Want the TV on while you wait?"), U('Sure.'),
      P('Westerns channel?'), P('Or should I find the fishing show instead?'),
    ],
  },
  { name: 'partial: Carol', profile: ray, history: [P('Who should I call to pick you up?')], partial: 'Carol' },
  { name: 'no profile', profile: {}, history: [P('Excuse me, is this seat taken?')] },
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function main() {
  console.log(`eval -> ${URL_}\n`);
  const latencies: number[] = [];
  let failures = 0;
  let ruleBreaks = 0;

  for (const [i, c] of CASES.entries()) {
    const started = performance.now();
    let replies: string[] = [];
    let error = '';
    try {
      const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: c.history, profile: c.profile, partial: c.partial }),
      });
      const data = (await res.json()) as { replies?: string[]; error?: string };
      if (!res.ok || !Array.isArray(data.replies)) error = `HTTP ${res.status}: ${data.error ?? 'no replies'}`;
      else replies = data.replies;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const ms = Math.round(performance.now() - started);

    const lastPartner = [...c.history].reverse().find((t) => t.speaker === 'partner')?.text ?? '';
    console.log(`#${String(i + 1).padStart(2)} ${c.name}  (${ms} ms)`);
    console.log(`    partner: ${lastPartner}${c.partial ? `   [typing: "${c.partial}"]` : ''}`);
    if (error) {
      failures++;
      console.log(`    ERROR ${error}\n`);
      continue;
    }
    latencies.push(ms);

    const problems: string[] = [];
    if (replies.length !== 3) problems.push(`${replies.length} replies`);
    if (new Set(replies.map((r) => r.toLowerCase())).size !== replies.length) problems.push('duplicate replies');
    for (const r of replies) {
      if (words(r) >= 15) problems.push(`${words(r)} words: "${r}"`);
      if (c.partial && !r.toLowerCase().includes(c.partial.toLowerCase())) problems.push(`missing "${c.partial}": "${r}"`);
    }
    replies.forEach((r, j) => console.log(`    ${j + 1}. ${r}`));
    if (problems.length) {
      ruleBreaks++;
      console.log(`    RULES: ${problems.join('; ')}`);
    }
    console.log();
  }

  if (latencies.length === 0) {
    console.log(`All ${failures} requests failed.`);
    process.exit(1);
  }
  const med = median(latencies);
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log('─'.repeat(50));
  console.log(`ok: ${latencies.length}/${CASES.length}   errors: ${failures}   rule breaks: ${ruleBreaks}`);
  console.log(`latency  median ${med} ms   min ${sorted[0]} ms   max ${sorted[sorted.length - 1]} ms`);
  console.log(med < 2000 ? 'median under 2 s target' : 'median OVER 2 s target, try REPLIES_MODEL=claude-haiku-5-5');
}

main();
