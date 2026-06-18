import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { webhookRouter } from "./webhooks/router.js";
import { apiRouter } from "./api/router.js";
import { trackingRouter } from "./tracking/router.js";

const app = express();

// Webhooks need the RAW body for signature verification — mount BEFORE json().
app.use("/webhooks", express.raw({ type: "*/*" }), webhookRouter);

// All other routes use parsed JSON.
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

// Public message tracking endpoints (open pixel / click redirect).
app.use("/track", trackingRouter);

// Admin REST API consumed by the web UI.
app.use("/api", apiRouter);

// ── Static web UI ─────────────────────────────────────────────────────────────
// Serve the built SPA (web/dist) when present. In development the UI runs on the
// Vite dev server (npm --prefix web run dev), which proxies /api here, so the
// built bundle won't exist — fall back to a JSON hint pointing there.
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../web/dist");

if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback: any non-API GET that wants HTML gets index.html (client routing).
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/webhooks")) {
      return next();
    }
    res.sendFile(path.join(webDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({
      name: "ubspot-crm-email-automation",
      status: "ok",
      env: env.NODE_ENV,
      ui: "Web UI not built. Run `npm --prefix web run dev` (dev) or `npm --prefix web run build` (prod).",
      api: "/api",
    });
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled request error", { err: String(err) });
  res.status(500).json({ error: "internal error" });
});

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`, { base: env.PUBLIC_BASE_URL });
});
