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
- Each finalized phrase becomes a `Turn` with `speaker: "partner"`. `interim` holds the words recognized so far.
- `addUserTurn(text)`: record the reply the user picked.
- `addPartnerTurn(text)`: typed fallback when the room is too noisy for recognition.

### Speaking

```ts
import { speak } from "./lib/speak";
await speak("Thanks, I'd love to.");  // resolves when playback ends
```

## Voice

1. ElevenLabs dashboard -> Voices -> Add voice -> Instant Voice Clone. Upload the 1 to 2 minute recording (one speaker, little background noise).
2. Copy the voice ID into `ELEVENLABS_VOICE_ID` in `.env`.
3. If cloning isn't on our plan, use any stock voice's ID from the Voice Library instead.

## Noisy room

Use a headset mic. If recognition is still unreliable, type the partner's question with `addPartnerTurn` (see the text box on `/dev.html`).
