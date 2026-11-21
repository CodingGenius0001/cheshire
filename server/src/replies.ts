import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Router } from "express";
import { z } from "zod";
import type { RepliesRequest, RepliesResponse } from "../../shared/types";

const MODEL = "claude-opus-5-5";
/** Only the most recent turns matter for a reply; keeps requests small and fast. */
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 1000;

const SYSTEM_PROMPT = `You write reply options for a person who cannot speak and communicates with an AAC device. \
Someone (the "partner") is talking to them face to face. They pick one of your replies with a blink, \
and it is spoken aloud in their own voice.

Write exactly 3 replies to the partner's latest message, as the user, in the first person.
- Each reply is a complete, natural spoken sentence or two, under 20 words. No emoji, no stage directions.
- Make the three meaningfully different (for example: yes / no / something else, or agree / ask a question / change the subject), so the user can always find one close to what they mean.
- Match the tone of the conversation. Sound like a real person, not an assistant.
- Do not invent specific facts about the user's life (names, places, dates). Keep such replies general.`;

const RepliesSchema = z.object({
  replies: z.array(z.string()),
});

// Created lazily so the server still boots (and /api/health still reports) without a key.
let client: Anthropic | null = null;

export const repliesRouter = Router();

repliesRouter.post("/", async (req, res) => {
  const { history } = (req.body ?? {}) as Partial<RepliesRequest>;
  if (!Array.isArray(history) || history.length === 0) {
    res.status(400).json({ error: "body must be { history: { speaker, text }[] } with at least one turn" });
    return;
  }

  const lines = history
    .filter((t) => t && (t.speaker === "partner" || t.speaker === "user") && typeof t.text === "string" && t.text.trim())
    .slice(-MAX_TURNS)
    .map((t) => `${t.speaker === "partner" ? "Partner" : "User"}: ${t.text.trim().slice(0, MAX_TURN_CHARS)}`);
  if (!lines.length) {
    res.status(400).json({ error: "history has no usable turns" });
    return;
  }

  // Stop paying for generation if the browser gives up (App aborts when a newer partner turn arrives).
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse(
      {
        model: MODEL,
        max_tokens: 2048,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Lowest effort: short replies don't need deep reasoning, and latency is what the user feels.
        output_config: { effort: "low", format: betaZodOutputFormat(RepliesSchema) },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `<conversation>\n${lines.join("\n")}\n</conversation>\n\nWrite the 3 reply options.`,
          },
        ],
      },
      { signal: abort.signal },
    );

    if (response.stop_reason === "refusal") {
      res.status(502).json({ error: "model declined to suggest replies" });
      return;
    }
    const parsed = response.parsed_output;
    if (!parsed) {
      res.status(502).json({ error: `no replies in model output (stop_reason: ${response.stop_reason})` });
      return;
    }
    const body: RepliesResponse = { replies: parsed.replies.map((r) => r.trim()).filter(Boolean).slice(0, 3) };
    res.json(body);
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error("replies failed:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(500).json({ error: "Anthropic credentials missing or invalid (set ANTHROPIC_API_KEY in .env)" });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "rate limited by Anthropic, try again" });
    } else if (err instanceof Anthropic.APIError) {
      res.status(502).json({ error: `Anthropic error ${err.status ?? ""}`.trim() });
    } else {
      // e.g. no credentials configured at all: the SDK throws before sending anything.
      res.status(500).json({ error: `failed to get replies: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
});
