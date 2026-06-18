import { Router, type Request, type Response } from "express";
import * as events from "../core/events/event.repository.js";
import { logger } from "../utils/logger.js";

/**
 * Public tracking endpoints embedded into delivered messages (no auth, no /api).
 *   open:  <img src="{base}/track/open.gif?t=&c=&e=">  → records message.open
 *   click: <a href="{base}/track/click?t=&c=&e=&u=">    → records message.click, 302
 * These produce REAL engagement events (vs the simulate-engagement dev helper).
 */
export const trackingRouter = Router();

// 1x1 transparent GIF.
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

trackingRouter.get("/open.gif", async (req: Request, res: Response) => {
  await recordSafely(req, "message.open");
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store");
  res.send(PIXEL);
});

trackingRouter.get("/click", async (req: Request, res: Response) => {
  await recordSafely(req, "message.click");
  const url = typeof req.query.u === "string" ? req.query.u : "";
  if (!/^https?:\/\//.test(url)) return res.status(400).send("invalid redirect target");
  res.redirect(302, url);
});

/** Build the URLs to embed in a message for a given recipient. */
export const openPixelUrl = (base: string, tenantId: string, campaignId: string, email: string) =>
  `${base}/track/open.gif?t=${tenantId}&c=${campaignId}&e=${encodeURIComponent(email)}`;
export const clickUrl = (base: string, tenantId: string, campaignId: string, email: string, target: string) =>
  `${base}/track/click?t=${tenantId}&c=${campaignId}&e=${encodeURIComponent(email)}&u=${encodeURIComponent(target)}`;

async function recordSafely(req: Request, type: "message.open" | "message.click") {
  const tenantId = String(req.query.t ?? "");
  const email = String(req.query.e ?? "");
  const campaignId = req.query.c ? String(req.query.c) : null;
  if (!tenantId || !email) return;
  try {
    await events.record(tenantId, { type, email, campaignId });
  } catch (err) {
    logger.error("Failed to record tracking event", { err: String(err) });
  }
}
