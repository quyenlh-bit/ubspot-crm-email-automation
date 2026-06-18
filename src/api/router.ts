import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { tenantRepository } from "../core/tenants/tenant.repository.js";
import { connectionRepository } from "../core/channels/connection.repository.js";
import { contactRepository } from "../core/contacts/contact.repository.js";
import * as syncLog from "../core/sync/sync-log.repository.js";
import { upsertAndSyncContact } from "../services/contact.service.js";
import { runOnboardingWorkflow } from "../services/automation.service.js";
import { createCampaign, listCampaigns, sendCampaign } from "../services/campaign.service.js";
import { EMAIL_TEMPLATES } from "../core/campaigns/templates.js";
import { CHANNEL_PROVIDERS } from "../core/domain.js";
import { isProviderSupported } from "../channels/registry.js";
import type { ChannelConnection, ChannelProvider } from "../core/domain.js";

/**
 * Admin REST API consumed by the web UI (web/). Everything below /api/tenants
 * is tenant-scoped — the tenant is the unit of isolation for this SaaS.
 *
 * Secrets in connection.config (accessToken, appSecret, …) are NEVER returned
 * in full — see maskConfig.
 */
export const apiRouter = Router();

/** Wrap an async handler so rejections become a 500 instead of a hung request. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const SECRET_KEYS = new Set(["accessToken", "appSecret", "apiKey", "clientSecret", "refreshToken"]);

/** Mask secret-ish config values so the UI can show "is set" without leaking them. */
function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = SECRET_KEYS.has(k) && v ? `••••${String(v).slice(-4)}` : v;
  }
  return out;
}

const publicConnection = (c: ChannelConnection) => ({ ...c, config: maskConfig(c.config) });

// ── Meta ──────────────────────────────────────────────────────────────────────

apiRouter.get(
  "/providers",
  wrap(async (_req, res) => {
    res.json(
      CHANNEL_PROVIDERS.map((id) => ({ id, supported: isProviderSupported(id) })),
    );
  }),
);

apiRouter.get(
  "/templates",
  wrap(async (_req, res) => res.json(EMAIL_TEMPLATES)),
);

apiRouter.get(
  "/tenants/:tenantId/stats",
  wrap(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    // Derived from the repositories so it works on both the Postgres and the
    // in-memory backend without provider-specific SQL.
    const [tenants, contacts, connections, log] = await Promise.all([
      tenantRepository.list(),
      contactRepository.list(tenantId, 500),
      connectionRepository.listEnabled(tenantId),
      syncLog.list(tenantId, 500),
    ]);
    res.json({
      tenants: tenants.length,
      contacts: contacts.length,
      connections: connections.length,
      syncErrors: log.filter((r) => r.status === "error").length,
    });
  }),
);

// ── Tenants ─────────────────────────────────────────────────────────────────

apiRouter.get(
  "/tenants",
  wrap(async (_req, res) => res.json(await tenantRepository.list())),
);

const CreateTenant = z.object({ name: z.string().min(1, "name is required") });
apiRouter.post(
  "/tenants",
  wrap(async (req, res) => {
    const parsed = CreateTenant.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    res.status(201).json(await tenantRepository.create(parsed.data.name));
  }),
);

// ── Connections ───────────────────────────────────────────────────────────────

apiRouter.get(
  "/tenants/:tenantId/connections",
  wrap(async (req, res) => {
    const list = await connectionRepository.list(String(req.params.tenantId));
    res.json(list.map(publicConnection));
  }),
);

const UpsertConnection = z.object({
  provider: z.enum(CHANNEL_PROVIDERS as [ChannelProvider, ...ChannelProvider[]]),
  config: z.record(z.unknown()).default({}),
});
apiRouter.post(
  "/tenants/:tenantId/connections",
  wrap(async (req, res) => {
    const parsed = UpsertConnection.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    if (!isProviderSupported(parsed.data.provider)) {
      return res.status(400).json({ error: `Provider "${parsed.data.provider}" is not implemented yet.` });
    }
    const conn = await connectionRepository.upsert(
      String(req.params.tenantId),
      parsed.data.provider,
      parsed.data.config,
    );
    res.status(201).json(publicConnection(conn));
  }),
);

// ── Contacts ──────────────────────────────────────────────────────────────────

apiRouter.get(
  "/tenants/:tenantId/contacts",
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await contactRepository.list(String(req.params.tenantId), limit));
  }),
);

const CreateContact = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  lifecycleStage: z.string().optional(),
});
apiRouter.post(
  "/tenants/:tenantId/contacts",
  wrap(async (req, res) => {
    const parsed = CreateContact.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const contact = await upsertAndSyncContact(String(req.params.tenantId), parsed.data);
    res.status(201).json(contact);
  }),
);

// ── Sync log ──────────────────────────────────────────────────────────────────

apiRouter.get(
  "/tenants/:tenantId/sync-log",
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json(await syncLog.list(String(req.params.tenantId), limit));
  }),
);

// ── Workflows ─────────────────────────────────────────────────────────────────

const OnboardingBody = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
});
apiRouter.post(
  "/tenants/:tenantId/workflows/onboarding",
  wrap(async (req, res) => {
    const parsed = OnboardingBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    await runOnboardingWorkflow(String(req.params.tenantId), { ...parsed.data, source: "ui" });
    res.json({ ok: true });
  }),
);

// ── Campaigns ─────────────────────────────────────────────────────────────────

apiRouter.get(
  "/tenants/:tenantId/campaigns",
  wrap(async (req, res) => {
    res.json(await listCampaigns(String(req.params.tenantId)));
  }),
);

const CreateCampaign = z.object({
  name: z.string().min(1),
  templateId: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  audienceLifecycleStage: z.string().optional(),
  // Accepts the UI's datetime-local value ("YYYY-MM-DDTHH:mm") or any ISO string.
  scheduledAt: z.string().min(1).optional(),
});
apiRouter.post(
  "/tenants/:tenantId/campaigns",
  wrap(async (req, res) => {
    const parsed = CreateCampaign.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { scheduledAt, ...rest } = parsed.data;
    let scheduled: Date | null = null;
    if (scheduledAt) {
      scheduled = new Date(scheduledAt);
      if (Number.isNaN(scheduled.getTime())) {
        return res.status(400).json({ error: "scheduledAt is not a valid date" });
      }
    }
    const campaign = await createCampaign(String(req.params.tenantId), { ...rest, scheduledAt: scheduled });
    res.status(201).json(campaign);
  }),
);

apiRouter.post(
  "/tenants/:tenantId/campaigns/:campaignId/send",
  wrap(async (req, res) => {
    const campaign = await sendCampaign(
      String(req.params.tenantId),
      String(req.params.campaignId),
    );
    res.json(campaign);
  }),
);
