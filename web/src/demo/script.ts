/**
 * Scripted partner conversation for demo mode (press P).
 *
 * Each partner line has to make sense whichever reply the user picked before it,
 * so keep them neutral. `replies` are only shown if /api/replies fails, so the
 * demo keeps going even with no network or API key.
 *
 * Keep each step's three replies genuinely different answers (yes / no / something
 * else), never three ways of saying the same thing.
 */
export interface DemoStep {
  partner: string;
  replies: [string, string, string];
}

export const DEMO_SCRIPT: DemoStep[] = [
  {
    partner: "Hi! It's so good to see you. How has your week been?",
    replies: [
      "It's been a good week, thanks. Really nice to see you too.",
      "Honestly, a bit tiring. I'm glad you came by.",
      "Not bad at all. How about yours?",
    ],
  },
  {
    partner: 'Thanks for telling me. Have you watched anything good lately?',
    replies: [
      "Yes, I started a new mystery series. I'll tell you about it.",
      "Not really. Do you have any recommendations?",
      "Mostly old movies. I could watch them forever.",
    ],
  },
  {
    partner: "I'm going to grab a coffee. Can I get you anything?",
    replies: [
      'Yes please, a tea with a little milk.',
      "I'm fine for now, thank you.",
      'Could you get me some water?',
    ],
  },
  {
    partner: "Got it. When I'm back, shall we make a plan for the weekend?",
    replies: [
      "I'd love that. Let's do something outside if it's sunny.",
      "Actually, I'd rather keep this weekend quiet and rest.",
      "Can we decide later? I'm not sure how I'll feel.",
    ],
  },
];
