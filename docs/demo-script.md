# Cheshire demo script

Two uses: the **backup video** (60–90 s) and the **live demo** at the judging table.

**Who does what**

| Person | Video | Live at the table |
| --- | --- | --- |
| **Vivek** | **User**: in front of the webcam, never speaks. Answers only with a nod, a tilt and a blink. The gesture thresholds were tuned on his face. | **User** |
| **Jash** | **Partner**: beside the laptop, talks to the User like a friend. The app runs on his laptop, which has both keys. | **Ethics and voice**, plus backup Partner if the judge is shy |
| **Adithya** | **Narrator**: hook, "a nod and a blink", close. Films the take with a phone over Vivek's shoulder. | **Hook, keystroke savings, keyboard** (P / Reset if something breaks) |
| **Keshav** | **Narrator**: the replies line and the numbers | **The cat, reply speed** |

**The mic hears everyone.** Anything said near the laptop gets transcribed as the partner and triggers new replies.
- **Video:** record the narration afterwards as a voice-over. During the take, only Jash speaks.
- **Table:** give the hook before the judge starts, and don't talk over the turns. Talking afterwards (the cat, the numbers) just puts new replies on screen, which is harmless, so ignore them. A headset mic on the Partner helps.

## Before you hit record (5 min)

- [ ] Chrome, laptop on a table, face lit from the front (not a window behind you).
- [ ] Either run locally (`.env` keys filled in, then `npm run dev`, then http://localhost:5173) or open https://cheshire-wonderland.vercel.app and enter the team passcode.
- [ ] `npx tsx server/src/checkEnv.ts` (free) to confirm the keys and the ElevenLabs balance. Prefetch voices all 3 options per turn, so keep rehearsals short.
- [ ] **Click the page once.** Chrome blocks audio until it gets a click, and a blink doesn't count.
- [ ] Press **D** and check that a held blink, a tilt and a nod register (thresholds are in the debug panel). Press **D** again to hide it.
- [ ] Click **Reset** in Live metrics so the numbers start clean.
- [ ] **Filming:** the nod and blink happen on the user's face, which the screen doesn't show. Simplest is a phone over the shoulder that catches both the face and the screen, which also records the spoken reply. If you screen-record instead, check the recording captures the app's audio, because the spoken reply is the payoff.

## Video, 60–90 s

| Time | On screen / action | Said |
| --- | --- | --- |
| 0:00 | Title and the Cheshire Cat on its branch. Vivek looks at the camera. | **Adithya:** "When you lose your voice, typing one letter at a time means the conversation leaves without you. Cheshire lets you answer in whole sentences, hands-free." |
| 0:10 | Jash leans in. | **Jash:** "Hey! Do you want to come to the tea party on Saturday?" |
| 0:15 | Their words appear in Conversation. The cat fades until only its grin is left, and three cards are dealt face down. The status says **Nod to answer**. | *(silence: let the cat vanish)* |
| 0:20 | **Vivek nods.** The cards turn over: three different replies (yes / no / something else). | **Keshav:** "Claude writes three replies that actually disagree, so there's always a real choice." |
| 0:28 | **Vivek tilts** to move the highlight, then **holds a blink.** The grin turns rose and the reply is spoken. | *(silence: the spoken reply is the moment)* |
| 0:38 | Jash answers whatever was said. | **Jash:** for example, "Great! Should I bring anything?" or "Aw, maybe next time then." |
| 0:43 | **Vivek nods, then blinks** on a reply straight away. It's spoken. | **Adithya:** "A nod and a blink. That's a whole sentence." |
| 0:52 | Zoom or point at **Live metrics**: keystroke savings and reply delay. | **Keshav:** "Here that's **[read the % off the panel]** keystroke savings, with replies in about two seconds." |
| 1:02 | Back to the cat. | **Adithya:** "The camera feed never leaves the device, nothing is saved to disk, and you only ever say what you chose. Cheshire: reply with a blink." |

**If the replies don't fit:** pick whichever one works and carry on. The replies are live and differ every run, so don't script them. Any reply makes the point.

## Backup take: demo mode (mic off)

Use this if the room is noisy or recognition fails. Press **P**: the partner's lines come from the script and nobody needs to talk. Each line arrives 1.5 s after the reply finishes, and pressing P again skips ahead.

1. "Hi! It's so good to see you. How has your week been?"
2. "Thanks for telling me. Have you watched anything good lately?"
3. "I'm going to grab a coffee. Can I get you anything?"
4. "Got it. When I'm back, shall we make a plan for the weekend?"

Same flow for Vivek each time: nod, tilt (optional), hold a blink. Adithya presses P. Jash doesn't speak, and the narrator lines above still work as voice-over. If the reply server is down, the script's own replies are shown and the demo keeps going.

## Live at the table, about 2 min

1. **Adithya, hook (15 s), before the judge starts talking:** "People with ALS or after a stroke often type to speak, one letter at a time. Conversations don't wait that long. Cheshire listens, suggests three full replies, and you pick one with your face."
2. **Show it (60 s):** Jash invites the judge to be the Partner: "Ask Vivek anything." Vivek answers with a nod and a blink, and the voice speaks. Do 2–3 turns. If the judge is shy, Jash asks instead.
3. **Keshav, the cat (10 s):** "The Cheshire Cat shows what it's doing. It vanishes to a grin while it thinks, and the grin glows when it speaks."
4. **Numbers (15 s):** Adithya points at keystroke savings on the panel. Keshav: "Replies come back in about two seconds, a 1.94-second median on our 20-conversation eval." 
5. **Jash, ethics and voice (15 s):** "Only clone your own voice. Today's voice is a stock one, because cloning needs a paid plan. Camera frames never leave the laptop, and nothing is saved to disk."
6. **If anything breaks:** Adithya presses **P** for demo mode, or clicks a card. Both are built-in fallbacks.

Don't claim the demo voice is the user's own (it's a stock voice), and don't quote a keystroke-savings number that isn't on the panel.
