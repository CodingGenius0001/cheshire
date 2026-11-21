/**
 * Demo persona sent as `profile` with every POST /api/replies (CodingGenius0001's reply engine).
 * The engine may use these facts in replies and is told never to invent others.
 *
 * Alice is FICTIONAL, made up for the demo. Before real use, replace this with facts the actual
 * user chose to share. Same shape as the personas in scripts/eval.ts: any JSON object works.
 */
export const DEMO_PROFILE = {
  note: 'Fictional demo persona',
  name: 'Alice',
  age: 41,
  condition: 'ALS; speaking has become hard, so she uses Cheshire to talk',
  lives_with: 'partner Sam and their cat Dinah',
  family: 'younger brother Theo lives nearby and visits on weekends',
  former_job: 'children’s librarian',
  likes: ['tea with a little milk', 'mystery shows', 'gardening', 'sunny afternoons outside', 'board games with friends'],
  dislikes: ['being rushed', 'people talking over her'],
};
