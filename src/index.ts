import express from "express";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { webhookRouter } from "./webhooks/router.js";
import { runOnboardingWorkflow } from "./services/automation.service.js";

const app = express();

// Webhooks need the RAW body for signature verification — mount BEFORE json().
app.use("/webhooks", express.raw({ type: "*/*" }), webhookRouter);

// All other routes use parsed JSON.
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "ubspot-crm-email-automation",
    status: "ok",
    env: env.NODE_ENV,
    endpoints: {
      health: "GET /health",
      triggerOnboarding: "POST /trigger/onboarding",
      webhooks: "POST /webhooks/:provider/:connectionId",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV });
});

// Demo endpoint to trigger the onboarding workflow manually (remove in prod).
app.post("/trigger/onboarding", async (req, res) => {
  const { tenantId, email, firstName } = req.body ?? {};
  if (!tenantId) return res.status(400).json({ error: "tenantId is required" });
  if (!email) return res.status(400).json({ error: "email is required" });
  try {
    await runOnboardingWorkflow(tenantId, { email, firstName, source: "manual" });
    res.json({ ok: true });
  } catch (err) {
    logger.error("Onboarding trigger failed", { err: String(err) });
    res.status(500).json({ error: "workflow failed" });
  }
});

app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`, {
    base: env.PUBLIC_BASE_URL,
  });
});
