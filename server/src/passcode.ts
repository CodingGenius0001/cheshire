import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Guards the paid APIs on a public deployment. Mount as app.use("/api", requirePasscode).
 * With CHESHIRE_PASSCODE unset (local dev) it lets everything through.
 * /api/health stays open so deploy checks work without the passcode.
 */
export function requirePasscode(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CHESHIRE_PASSCODE;
  if (!expected || req.path === "/health") {
    next();
    return;
  }
  const given = Buffer.from(req.get("x-cheshire-passcode") ?? "");
  const want = Buffer.from(expected);
  if (given.length === want.length && timingSafeEqual(given, want)) {
    next();
    return;
  }
  res.status(401).json({ error: "passcode required" });
}
