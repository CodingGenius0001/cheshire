# Cheshire demo script

Two uses: the **backup video** (60–90 s) and the **live demo** at the judging table.

**Roles**
- **User:** sits in front of the webcam and never speaks. They answer only with a nod, a tilt and a blink.
- **Partner:** stands beside the laptop and talks to the user like a friend.
- **Narrator:** voice-over for the video. At the table, the Partner narrates.

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
| 0:00 | Title and the Cheshire Cat on its branch. The User looks at the camera. | **Narrator:** "When you lose your voice, typing one letter at a time means the conversation leaves without you. Cheshire lets you answer in whole sentences, hands-free." |
| 0:10 | The Partner leans in. | **Partner:** "Hey! Do you want to come to the tea party on Saturday?" |
| 0:15 | Their words appear in Conversation. The cat fades until only its grin is left, and three cards are dealt face down. The status says **Nod to answer**. | *(silence: let the cat vanish)* |
| 0:20 | **User nods.** The cards turn over: three different replies (yes / no / something else). | **Narrator:** "Claude writes three replies that actually disagree, so there's always a real choice." |
| 0:28 | **User tilts** to move the highlight, then **holds a blink.** The grin turns rose and the reply is spoken. | *(silence: the spoken reply is the moment)* |
| 0:38 | **Partner** answers whatever was said, for example: "Great! Should I bring anything?" | |
| 0:43 | **User nods, then blinks** on a reply straight away. It's spoken. | **Narrator:** "A nod and a blink. That's a whole sentence." |
| 0:52 | Zoom or point at **Live metrics**: keystroke savings and reply delay. | **Narrator:** "Here that's **[read the % off the panel]** keystroke savings, with replies in about two seconds." |
| 1:02 | Back to the cat. | **Narrator:** "The camera feed never leaves the device, nothing is saved to disk, and you only ever say what you chose. Cheshire: reply with a blink." |

**If the replies don't fit:** pick whichever one works and carry on. The replies are live and differ every run, so don't script them. Any reply makes the point.

## Backup take: demo mode (mic off)

Use this if the room is noisy or recognition fails. Press **P**: the partner's lines come from the script and nobody needs to talk. Each line arrives 1.5 s after the reply finishes, and pressing P again skips ahead.

1. "Hi! It's so good to see you. How has your week been?"
2. "Thanks for telling me. Have you watched anything good lately?"
3. "I'm going to grab a coffee. Can I get you anything?"
4. "Got it. When I'm back, shall we make a plan for the weekend?"

Same flow for the User each time: nod, tilt (optional), hold a blink. The Narrator lines above still work. If the reply server is down, the script's own replies are shown and the demo keeps going.

## Live at the table, about 2 min

1. **Hook (15 s):** "People with ALS or after a stroke often type to speak, one letter at a time. Conversations don't wait that long. Cheshire listens, suggests three full replies, and you pick one with your face."
2. **Show it (60 s):** have the judge be the Partner: "Ask them anything." The User answers with a nod and a blink, and the voice speaks. Do 2–3 turns.
3. **Point at the cat (10 s):** "The Cheshire Cat shows what it's doing. It vanishes to a grin while it thinks, and the grin glows when it speaks."
4. **Numbers (15 s):** keystroke savings on the panel, and replies in about 2 s (median 1.94 s on our 20-conversation eval).
5. **Ethics (15 s):** "Only clone your own voice. Today's voice is a stock one, because cloning needs a paid plan. Camera frames never leave the laptop, and nothing is saved to disk."
6. **If anything breaks:** press **P** for demo mode, or click a card. Both are built-in fallbacks.

Don't claim the demo voice is the user's own (it's a stock voice), and don't quote a keystroke-savings number that isn't on the panel.
