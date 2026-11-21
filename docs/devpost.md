<!--
BEFORE SUBMITTING (delete this block):
- [ ] Replace the KSR placeholder with the number from a live session (metrics panel, right column).
- [ ] Add the demo video link.
- [ ] Optional: add a sourced stat on AAC speaking rates to "The problem" (don't publish one without a source).
- [ ] If App.tsx starts sending a user profile to /api/replies, the "Suggest" step can say so outright.
- [ ] If App.tsx starts calling prefetchSpeech(), add to "Speak": audio for all three options is loaded in advance, so the pick plays with no network wait.
-->

# Cheshire

**Reply in your own voice with a blink.**

Cheshire listens to the person you're talking to, suggests three full replies, and lets you pick one with a head tilt and a blink. It then speaks your choice out loud in a clone of your own voice.

🎥 Demo video: _[link]_

## The problem

People who lose the ability to speak, from ALS, a stroke or other conditions, often communicate by typing on an AAC (augmentative and alternative communication) device. Typing one letter at a time is slow, and with limited hand movement it's slower still. Spoken conversation doesn't wait. By the time a reply is typed, the topic has moved on, the other person has filled the silence, and the user has been talked over or left out. When the reply does come, it's in a generic synthetic voice that doesn't sound like them.

We wanted conversation to feel like conversation again: fast enough to keep up, with no hands needed, and in the user's own voice.

## How it works

1. **Listen.** Chrome's Web Speech API transcribes the conversation partner continuously. Chrome sometimes splits one sentence into pieces, so Cheshire waits for a 0.8 s pause before treating what the partner said as one complete turn.
2. **Suggest.** When the partner finishes a phrase, the last 10 turns go to Claude Opus 5.5, which returns three replies written as the user, in the first person:
   - Each reply is under 15 words, so it's quick to read and quick to say.
   - The three replies have to contradict each other, not just be worded differently. A yes/no question or an offer gets accept, decline and something else. An open question gets answers that go in different directions, at least one of them less positive. The user always has a real choice.
   - The engine is instructed never to invent facts about the user, only to use what was said in the conversation or what's in the user's profile.
   - We run Claude at low effort with a strict JSON schema to keep replies fast. On our eval of 20 scripted conversations, all 20 returned valid reply sets, with a median latency of 1.94 s.
3. **Choose.** MediaPipe's face landmarker runs in the browser on the webcam feed:
   - Tilting your head left or right (past 15° for 300 ms) moves the highlight between the three replies.
   - Holding a blink for 400 ms speaks the highlighted reply. A normal blink is too short to trigger it, so the user can blink naturally while reading.
   - Carers can also click a tile with a mouse or touch.
4. **Speak.** The chosen reply is spoken through ElevenLabs' low-latency Flash model in a clone of the user's voice. Audio plays as it streams in, so speech starts before synthesis finishes. If the voice service is unreachable, Cheshire falls back to the browser's built-in voice, so the user is never left silent. The mic pauses while Cheshire speaks so it doesn't transcribe itself.

A live metrics panel shows keystroke savings, replies per minute, and how long each stage takes: partner stops → replies ready → user chooses → voice starts.

The interface is built for low vision:
- Reply text is about 31 px.
- All text has at least 7:1 contrast (WCAG AAA).
- The font is Atkinson Hyperlegible.
- It respects the system "increase contrast" and "reduce motion" settings.

## The result: keystroke savings

We measure **keystroke savings rate (KSR) = 1 − inputs ÷ characters spoken**, where every head tilt, blink or key press counts as one input. Typing letter by letter is roughly one input per character, a KSR near 0%. On Cheshire, one blink speaks a whole sentence.

> **Live session KSR: _[XX]%_** across _[N]_ replies. _(placeholder: fill in from the metrics panel)_

For reference, our demo conversation's replies are 28 to 60 characters long, averaging 44.7. That works out to:

| Inputs per reply | KSR (average reply) |
| --- | --- |
| 1 (blink on the first suggestion) | 97.8% |
| 2 (one tilt + blink) | 95.5% |
| 3 (two tilts + blink) | 93.3% |

So even in the worst case, picking the third suggestion takes 3 inputs instead of about 45.

## Ethics

**Only clone your own voice.** Cheshire speaks in a single voice, which the owner configures on the server. The setup asks the user to record 1 to 2 minutes of their own speech, ideally while they still can (voice banking), and create a clone from that recording. There is no feature for cloning anyone else's voice, and the user should never clone a voice that isn't theirs. Without a clone, a stock voice works.

**Nothing is stored, and the camera stays on your device.**
- *Stays on the device:* the webcam feed. Face tracking runs entirely in the browser, and the only thing the app uses is the resulting tilt or blink event. No video is sent anywhere.
- *Never stored:* the transcript exists only in the browser's memory for the current session and is gone on reload. There's no database, and our server logs only timings and errors, never what was said. The one thing the server holds is the audio of the last 200 spoken replies, in memory only (never on disk), so a repeated line plays instantly. It's cleared whenever the server restarts.
- *Sent out to work, and we're upfront about it:* Chrome's speech recognition sends microphone audio to Google to transcribe it, the last 10 turns go to Anthropic's API to generate replies, and the chosen reply's text goes to ElevenLabs to synthesize speech. API keys stay on our server, never in the browser.

**The user stays in control.** Nothing is spoken until the user deliberately chooses it, with a held blink, not a passing one. The suggestions are options, not words put in someone's mouth, and the engine is instructed never to invent facts, feelings or plans for the user.

**The other person should know.** Cheshire transcribes the conversation partner, so the user or a carer should tell people the mic is listening.

## Built with

TypeScript · React 19 · Vite · Express · Web Speech API · MediaPipe Tasks Vision (Face Landmarker) · Claude Opus 5.5 (Anthropic API, structured outputs) · ElevenLabs (Flash v2.5 streaming TTS, voice cloning) · Media Source Extensions
