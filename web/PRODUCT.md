# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Adults losing their ability to speak (ALS, stroke, other conditions) who now communicate through AAC. They sit in front of a laptop with a webcam during a face-to-face conversation and pick what to say with a head tilt and a held blink, often with limited hand movement and sometimes low vision. A conversation partner (family, carer, clinician, stranger) stands or sits nearby. Carers may click a tile instead.

## Product Purpose
Cheshire listens to the conversation partner, suggests three full first-person replies, lets the user choose one hands-free, and speaks it aloud in a natural voice (a clone of the user's own voice when one is set up). Success: the user keeps pace with spoken conversation with one input per sentence instead of one per letter, measured live as keystroke savings (KSR).

## Positioning
Whole-sentence replies generated from the live conversation and the user's profile, chosen with a blink, spoken in their voice. Not a letter-by-letter typing board.

## Operating Context
- Built at CutieHacks (12-hour hackathon, theme: "Dream x Alice in Wonderland"). Judged mainly at the table on a laptop at arm's length, with the webcam and mic live; demo mode (press P) plays a scripted conversation.
- Desktop Chrome (Web Speech API + MediaPipe face landmarker). One screen: transcript, three reply tiles, live metrics.
- Fictional demo persona "Alice" (web/src/demo/profile.ts).

## Capabilities and Constraints
- Three reply tiles; highlight moves on head tilt, held blink (400 ms) chooses; click/touch fallback.
- States: listening, thinking of replies, replies shown, speaking, mic/camera/voice errors, demo running/finished.
- Live metrics panel stays on screen (KSR, replies/min, stage timings, event log).
- Layout: three columns (transcript, replies, metrics) is kept.
- Code ownership: App.tsx, styles/app.css, metrics/, demo/ belong to Adithya; tiles/ and selection/ belong to Vivek; changes are proposed on a branch and merged only with their OK.

## Brand Commitments
- Name: Cheshire. Theme commitment for this event: "Dream x Alice in Wonderland".
- Must not read as generic AI UI (violet glow, glassy cards, gradient text, uppercase mono labels) or as creepy/horror.

## Evidence on Hand
- Eval: 20/20 valid reply sets, median 1.94 s (scripts/eval.ts). Live KSR not measured yet; do not invent one.
- No real users, testimonials, or clinical claims exist; do not fabricate them.

## Product Principles
1. The three replies are the screen; everything else defers to them.
2. Choosing must never be disturbed: no motion or ornament competes with a reply while the user is selecting.
3. Honest about state: always show whether it is listening, thinking, or speaking.
4. Dignity: built for adults; whimsy serves the theme, never mocks the user's situation.

## Accessibility & Inclusion
Low-vision first. The Devpost publicly claims: reply text about 31 px, at least 7:1 text contrast (WCAG AAA), Atkinson Hyperlegible, and support for system "increase contrast" and "reduce motion". The redesign must keep all of these true.
