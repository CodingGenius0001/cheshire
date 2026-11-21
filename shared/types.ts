// Shared contract between web/ and server/.
// PROVISIONAL: replace this file with the team's agreed contract. Keep the names
// useListener and /api/speak depend on: Turn, Speaker, SpeakRequest.

export type Speaker = "partner" | "user";

export interface Turn {
  id: string;
  speaker: Speaker;
  text: string;
  /** ms since epoch, when the turn was finalized */
  timestamp: number;
  /** "speech" = Web Speech API, "typed" = fallback text box, "reply" = picked reply */
  source?: "speech" | "typed" | "reply";
}

/** POST /api/speak body. Response: audio/mpeg stream. */
export interface SpeakRequest {
  text: string;
}
