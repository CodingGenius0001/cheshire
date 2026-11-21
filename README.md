# Cheshire

Listens to your conversation partner, suggests 3 full replies, lets you pick one with a blink or head tilt, and speaks it in your own voice.

## Run it

Requires Node 20+ and Chrome (speech recognition uses Chrome's Web Speech API).

```sh
git clone <repo-url> cheshire
cd cheshire
npm install
cp .env.example .env    # then fill in the keys
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to Express on :3001, so everything runs on one laptop. API keys stay on the server.

- http://localhost:5173/dev.html: backbone test page (mic toggle, typed partner fallback, speak button)
- http://localhost:5173/api/health: shows which keys the server can see

## Layout

```
shared/types.ts            shared contract (Turn, SpeakRequest, ...)
server/src/index.ts        Express app; mount routes here
server/src/speak.ts        POST /api/speak {text} -> audio/mpeg (ElevenLabs streaming, flash model)
server/src/replies.ts      POST /api/replies {history} -> {replies: string[3]} (Claude Opus 5.5, low effort)
web/src/hooks/useListener.ts   partner speech -> Turn[]
web/src/lib/speak.ts       speak(text): calls /api/speak and plays the audio as it streams
web/src/App.tsx            main UI
web/src/selection/         blink / head-tilt selection
web/src/metrics/           metrics
```

### useListener

```ts
const { turns, listening, start, stop, addUserTurn, toggle, addPartnerTurn, interim, supported, error } = useListener();
```

- `start`/`stop`/`toggle`: push-to-listen. Chrome ends recognition after silence; the hook restarts it until `stop()` is called.
- Partner speech becomes a `Turn` with `speaker: "partner"` once they pause for 0.8s, so a sentence Chrome splits into pieces arrives as one turn. `interim` holds the words recognized so far.
- `addUserTurn(text)`: record the reply the user picked.
- `addPartnerTurn(text)`: typed fallback when the room is too noisy for recognition.

### Speaking

```ts
import { speak } from "./lib/speak";
await speak("Thanks, I'd love to.");  // resolves when playback ends
```

`prefetchSpeech(replies)` (same file) fetches audio for all reply options as soon as they're shown, so the picked one plays instantly. It spends ElevenLabs characters on all 3, so leave it out if credits run low.

## Voice

1. ElevenLabs dashboard -> Voices -> Add voice -> Instant Voice Clone. Upload the 1 to 2 minute recording (one speaker, little background noise).
2. Copy the voice ID into `ELEVENLABS_VOICE_ID` in `.env`.
3. If cloning isn't on our plan, use any stock voice's ID from the Voice Library instead.
4. To improve the clone, add more samples to the same voice in the dashboard (the ID doesn't change). Clean audio matters more than length: one speaker, quiet room, natural tone.
5. Fine-tune with the optional `ELEVENLABS_*` settings in `.env.example`, then restart the server.

## Demo mode

Press **P** on the main screen to play a scripted partner conversation (`web/src/demo/script.ts`) instead of using the mic. The first line arrives at once; each later line follows 1.5s after your reply finishes. Press P again to skip ahead, or after the end to replay. If `/api/replies` fails during the demo, each line's scripted replies are shown so the demo never stalls. P and D (camera debug) don't count toward keystroke savings.

## Noisy room

Use a headset mic. If recognition is still unreliable, type the partner's question with `addPartnerTurn` (see the text box on `/dev.html`).
