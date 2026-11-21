/*
 * Reply engine: POST /api/replies
 *   body { history: { speaker, text }[], profile?, partial? } -> { replies: [string, string, string] }
 *
 * Mount in index.ts:  app.use("/api/replies", repliesRouter);
 *
 * Env (read per request, so dotenv loading order doesn't matter):
 *   ANTHROPIC_API_KEY
 *   REPLIES_MODEL      default claude-opus-5-5 (switch: claude-haiku-5-5)
 *   REPLIES_MAX_TURNS  default 10 (2 PM fallback: 4)
 */
import Anthropic from "@anthropic-ai/sdk";
import { Router, type Request, type Response } from "express";
import type { RepliesRequest as SharedRepliesRequest, RepliesResponse } from "../../shared/types";

/** Shared request plus two optional fields the reply engine understands. */
export interface RepliesRequest extends SharedRepliesRequest {
  /** Facts about the user (name, family, likes, ...). Any JSON shape; shown to the model as-is. */
  profile?: unknown;
  /** The word the user is typing right now, if any. */
  partial?: string;
}

type HistoryTurn = RepliesRequest["history"][number];

const config = () => ({
  model: process.env.REPLIES_MODEL || "claude-opus-5-5",
  maxTurns: Number(process.env.REPLIES_MAX_TURNS) || 10,
});

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

const SYSTEM_PROMPT = `You are the voice of a person who is losing their ability to speak. They are in a live, spoken conversation. You hear what the other person (the partner) says, and you write three replies the user could say next. The user picks one with a blink or a head tilt, and it is spoken aloud in their own voice, so each reply is something they say, not something said about them.

Write every reply in the first person, as the user, in a natural spoken register: the way a person actually talks, contractions included. No stage directions, emoji, quotation marks, or narration.

Keep each reply under 15 words. Short is kind here: the user is choosing quickly and the partner is waiting.

The three replies must be different answers, not three wordings of one answer, so the user can say what they actually mean, including no. Check: if the user could say two of the replies one after the other without contradicting themselves, those two are too similar; replace one.
- When the partner asks a yes/no question, offers something, or proposes a plan: one reply accepts, one declines or disagrees, and one does something else (not now, a condition, a different suggestion, or a question back).
- When the partner asks an open question: three answers that pick different options or point in different directions, at least one of them less positive than the others.
Don't let every reply be upbeat. The user often needs to say "no" or "not today", and they need to be able to.

Only use facts about the user that appear in their profile below or that the user said earlier in the conversation. Never invent names, plans, preferences, feelings, or history for them. When a good reply would need a fact you don't have, write one that doesn't need it, or ask the partner instead.`;

function buildSystem(profile: unknown): string {
  const empty =
    profile === undefined || profile === null || (typeof profile === "object" && Object.keys(profile).length === 0);
  const profileText = empty
    ? "No profile was given. Do not assume anything about the user beyond the conversation."
    : JSON.stringify(profile, null, 2);
  return `${SYSTEM_PROMPT}\n\n<profile>\n${profileText}\n</profile>`;
}

function buildUserMessage(history: HistoryTurn[], partial: string | undefined): string {
  const lines = history.map((t) => `${t.speaker === "user" ? "User" : "Partner"}: ${t.text}`);
  let msg = `<conversation>\n${lines.join("\n")}\n</conversation>\n\nWrite the user's three possible next replies.`;
  if (partial) {
    msg += ` The user has started typing the word "${partial}". Every reply must start with that word or contain it.`;
  }
  return msg;
}

const REPLIES_SCHEMA = {
  type: "object",
  properties: {
    replies: {
      type: "array",
      items: { type: "string" },
      description: "Exactly three replies that give different answers (for example yes / no / something else).",
    },
  },
  required: ["replies"],
  additionalProperties: false,
};

export class RepliesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function parseRequest(body: unknown): RepliesRequest {
  const b = body as Partial<RepliesRequest> | undefined;
  if (!b || !Array.isArray(b.history)) throw new RepliesError("body.history must be an array", 400);
  const history: HistoryTurn[] = [];
  for (const t of b.history) {
    if (!t || typeof t.text !== "string" || (t.speaker !== "user" && t.speaker !== "partner")) {
      throw new RepliesError('each history turn needs speaker "user" | "partner" and text', 400);
    }
    if (t.text.trim()) history.push({ speaker: t.speaker, text: t.text.trim() });
  }
  if (history.length === 0) throw new RepliesError("history has no non-empty turns", 400);
  const partial = typeof b.partial === "string" && b.partial.trim() ? b.partial.trim() : undefined;
  return { history, profile: b.profile, partial };
}

/** Core call, separate from Express so scripts can use it directly. `signal` cancels the API call. */
export async function generateReplies(body: unknown, signal?: AbortSignal): Promise<RepliesResponse> {
  const { history, profile, partial } = parseRequest(body);
  const { model, maxTurns } = config();
  const recent = history.slice(-maxTurns);

  // Opus 5.5: thinking stays on (disabling it is a 400); effort "low" keeps it short.
  // Server-side fallback re-runs on another model if a safety classifier misfires
  // (medical conversation is where false positives happen). Haiku doesn't take it.
  const useFallbacks = model === "claude-opus-5-5";
  const response = await getClient().beta.messages.create({
    model,
    max_tokens: 2048,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: REPLIES_SCHEMA },
    },
    ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: buildSystem(profile),
    messages: [{ role: "user", content: buildUserMessage(recent, partial) }],
  }, { signal });

  if (response.stop_reason === "refusal") {
    throw new RepliesError(`model declined (${response.stop_details?.category ?? "unknown"})`, 502);
  }
  if (response.stop_reason === "max_tokens") {
    throw new RepliesError("model ran out of tokens before finishing", 502);
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new RepliesError("model returned no text", 502);

  let parsed: RepliesResponse;
  try {
    parsed = JSON.parse(text.text) as RepliesResponse;
  } catch {
    throw new RepliesError("model returned invalid JSON", 502);
  }
  const replies = (parsed.replies ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 3);
  if (replies.length < 3) throw new RepliesError(`model returned ${replies.length} replies`, 502);
  return { replies };
}

export async function repliesHandler(req: Request, res: Response): Promise<void> {
  const started = Date.now();
  // Stop paying for generation if the browser gives up (App aborts when a newer partner turn arrives).
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  try {
    const result = await generateReplies(req.body, abort.signal);
    console.log(`[replies] ${Date.now() - started} ms (${config().model})`);
    res.json(result);
  } catch (err) {
    if (abort.signal.aborted) return;
    const status = err instanceof RepliesError ? err.status : err instanceof Anthropic.APIError ? 502 : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[replies] failed after ${Date.now() - started} ms: ${message}`);
    res.status(status).json({ error: message });
  }
}

export const repliesRouter = Router();
repliesRouter.post("/", repliesHandler);
