import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import { speakRouter } from "./speak";

// .env lives at the repo root
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID),
  });
});

app.use("/api/speak", speakRouter);
// Mount other routes here, e.g. app.use("/api/replies", repliesRouter);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
