# Cheshire demo script

Two uses:
1. **Demo video:** edited in **Remotion** from short clips of the site plus a recorded voiceover. Target 75 s at 30 fps.
2. **Live demo** at the judging table, about 2 min (unchanged, at the bottom).

**Who does what**

| Person | Video | Live at the table |
| --- | --- | --- |
| **Vivek** | Face-cam clips: nod, tilt, held blink (the thresholds were tuned on his face) | **User** in front of the webcam, silent |
| **Jash** | Runs the app on his laptop (both keys) and captures the screen clips. Says the partner lines in clips B and G. | **Ethics and voice**, plus backup Partner if the judge is shy |
| **Adithya** | Voiceover for scenes 1, 6 and 9 | **Hook, keystroke savings, keyboard** (P / Reset if something breaks) |
| **Keshav** | Voiceover for scenes 4 and 8 | **The cat, reply speed** |
| **Editor** | _TBD: whoever builds the Remotion project_ | |

## 1. Capture the clips (about 20 min)

**Setup**
- [ ] Jash's laptop, Chrome, running locally (`npm run dev` → http://localhost:5173). The hosted site's voice is still on the browser fallback, and the spoken reply is the payoff.
- [ ] `npx tsx server/src/checkEnv.ts` (free) to check the keys and the ElevenLabs balance. Each turn voices all 3 options, so capture each clip in one or two tries.
- [ ] Window at **1920×1080**, browser zoom 100%, bookmarks bar hidden. Face lit from the front.
- [ ] **Click the page once** before the first blink, so Chrome allows audio. Press **D** to check that the nod, tilt and blink register, then press **D** again to hide the panel. Click **Reset** in Live metrics.
- [ ] Screen recorder that **captures system audio**: you need the spoken reply (clip F). OBS works. If your recorder can't, record the audio separately or film that moment with a phone.

**Clip list.** Capture each clip on its own, a few seconds longer than needed so Remotion can trim. The voiceover is recorded separately, so nobody narrates during capture: the app's mic would transcribe it as the partner.

| Clip | Source | What to capture | Length |
| --- | --- | --- | --- |
| **A** | Screen | Idle page: the cat on its branch, stars, empty conversation | 6 s |
| **B** | Screen + room audio | Jash says: *"Hey! Do you want to come to the tea party on Saturday?"* His words appear, the cat fades to its grin, the cards land face down, and the status reads **Nod to answer** | 8 s |
| **C** | Face cam (phone) | Vivek **nods** once, clearly | 3 s |
| **D** | Screen | The cards turn face up after the nod; status **Blink or tilt to choose** | 4 s |
| **E** | Face cam (phone) | Vivek **tilts** his head, then **holds a blink** | 4 s |
| **F** | Screen + **system audio** | The highlight moves, the grin turns rose, the reply is **spoken**, and it appears as a "You" bubble | 7 s |
| **G** | Screen + room audio | A second quick turn. Jash replies to whatever was said (*"Great! Should I bring anything?"* or *"Aw, maybe next time."*), then nod → blink → spoken | 10 s |
| **H** | Screen | Live metrics panel after G: keystroke savings %, reply delay, stage bar. Hold still for a zoom. | 5 s |
| **S** | Stills | `docs/theme-preview/1-idle.png` … `4-speaking.png`: fallback frames if a clip didn't come out | none |

**If the mic struggles:** capture B and G in demo mode instead. Press **P**, and the partner lines come from the script with no one speaking. Then the voiceover carries the partner's question.

## 2. Edit in Remotion: scene plan (75 s @ 30 fps)

| # | Frames | Visual | Voiceover | On-screen text |
| --- | --- | --- | --- | --- |
| 1 | 0–240 (8 s) | Clip **A**, slow push-in on the cat | **Adithya:** "When you lose your voice, typing one letter at a time means the conversation leaves without you." | **Cheshire**: *reply with a blink* |
| 2 | 240–480 (8 s) | Clip **B** | *(partner audio from the clip, no VO)* | "Someone asks you a question…" |
| 3 | 480–570 (3 s) | Clip **C** (face) | *(none)* | "Nod to answer" |
| 4 | 570–810 (8 s) | Clip **D**, cards turn face up | **Keshav:** "Claude writes three replies that actually disagree, so there's always a real choice." | "Yes · No · Something else" |
| 5 | 810–930 (4 s) | Clip **E** (face), split screen with the start of **F** | *(none)* | "Tilt to choose · hold a blink to speak" |
| 6 | 930–1200 (9 s) | Clip **F**, spoken reply | *(the app's voice, no VO)*. After it ends, **Adithya:** "A nod and a blink. That's a whole sentence." | none |
| 7 | 1200–1500 (10 s) | Clip **G**, sped up 1.5–2× except the spoken reply | *(none)* | "Again, in seconds" |
| 8 | 1500–1800 (10 s) | Clip **H**, zoom on keystroke savings | **Keshav:** "That's **[% from the panel in clip H]** keystroke savings, with replies in about two seconds." | the % from the panel, large |
| 9 | 1800–2250 (15 s) | Clip **A** again (cat), ending on the title card | **Adithya:** "The camera feed never leaves the device, nothing is saved to disk, and you only ever say what you chose. Cheshire. Reply with a blink." | **Cheshire** · cheshire-wonderland.vercel.app · *Built with Claude, ElevenLabs, MediaPipe* |

**Voiceover:** record each line as its own file (`vo-1.wav`, `vo-4.wav`, …) in a quiet room, at about 2.5 words a second. Each line above fits its scene at that pace. Place each with `<Sequence from={…}>` + `<Audio>`. Scenes 2 and 6 keep the clip's own audio at full volume, with no voiceover on top.

**Captions:** burn in subtitles for every voiceover line and for the spoken replies, in large, high-contrast text. The audience includes people with low vision and hearing loss, and many judges watch muted.

**Remotion notes:** 1920×1080 at 30 fps. Use `<OffthreadVideo>` for clips (trim with `trimBefore`/`trimAfter`, or `startFrom`/`endAt` on older Remotion versions) and `<Img>` for the stills. Use `spring`/`interpolate` for the push-ins and zooms. Keep cuts on the beats above. The theme colours are in `web/src/theme/cheshire.css` if you want matching title cards: `--moon: #f3e9c6`, `--grin: #f07fb4`, background `#08141c`.

**Stay accurate:**
- Don't call the demo voice the user's own (it's a stock voice).
- Only use the keystroke-savings % that clip H actually shows.
- Don't speed up or cut inside the spoken reply.

## Live at the table, about 2 min

**The mic hears everyone.** Anything said near the laptop gets transcribed as the partner. Give the hook before the judge starts, and don't talk over the turns. Talking afterwards just puts new replies on screen, which is harmless. A headset mic on the Partner helps.

1. **Adithya, hook (15 s), before the judge starts talking:** "People with ALS or after a stroke often type to speak, one letter at a time. Conversations don't wait that long. Cheshire listens, suggests three full replies, and you pick one with your face."
2. **Show it (60 s):** Jash invites the judge to be the Partner: "Ask Vivek anything." Vivek answers with a nod and a blink, and the voice speaks. Do 2–3 turns. If the judge is shy, Jash asks instead.
3. **Keshav, the cat (10 s):** "The Cheshire Cat shows what it's doing. It vanishes to a grin while it thinks, and the grin glows when it speaks."
4. **Numbers (15 s):** Adithya points at keystroke savings on the panel. Keshav: "Replies come back in about two seconds, a 1.94-second median on our 20-conversation eval."
5. **Jash, ethics and voice (15 s):** "Only clone your own voice. Today's voice is a stock one, because cloning needs a paid plan. Camera frames never leave the laptop, and nothing is saved to disk."
6. **If anything breaks:** Adithya presses **P** for demo mode, or clicks a card. Both are built-in fallbacks.
