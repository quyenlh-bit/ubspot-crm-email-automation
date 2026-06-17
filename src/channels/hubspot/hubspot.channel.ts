import crypto from "node:crypto";
import { Client } from "@hubspot/api-client";
import { z } from "zod";
import type {
  ChannelCapability,
  ChannelEvent,
  CrmChannel,
  WebhookRequest,
} from "../channel.js";
import type { ChannelConnection, Contact } from "../../core/domain.js";
import { logger } from "../../utils/logger.js";

/**
 * HubSpot CRM channel — ONE provider implementation of CrmChannel.
 *
 * Credentials come from the tenant's stored connection config (not global env),
 * so different tenants connect different HubSpot portals:
 *   { accessToken: "pat-...", appSecret: "...", transactionalEmailId: "123" }
 */
const ConfigSchema = z.object({
  accessToken: z.string().min(1, "HubSpot connection requires an accessToken"),
  appSecret: z.string().min(1).optional(),
  transactionalEmailId: z.string().optional(),
});

export type HubSpotConfig = z.infer<typeof ConfigSchema>;

export class HubSpotChannel implements CrmChannel {
  readonly provider = "hubspot" as const;
  readonly capabilities: ChannelCapability[] = ["contact.push", "webhook"];

  private readonly client: Client;
  private readonly config: HubSpotConfig;

  constructor(connection: ChannelConnection) {
    this.config = ConfigSchema.parse(connection.config);
    this.client = new Client({
      accessToken: this.config.accessToken,
      numberOfApiCallRetries: 3,
    });
  }

  /** Upsert the contact into HubSpot CRM and return its HubSpot id. */
  async pushContact(contact: Contact): Promise<{ externalId: string }> {
    const properties: Record<string, string> = { email: contact.email };
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.lifecycleStage) properties.lifecyclestage = contact.lifecycleStage;

    try {
      const created = await this.client.crm.contacts.basicApi.create({
        properties,
        associations: [],
      });
      return { externalId: created.id };
    } catch (err: unknown) {
      // 409 = already exists → update by email.
      if ((err as { code?: number })?.code === 409) {
        const updated = await this.client.crm.contacts.basicApi.update(
          contact.email,
          { properties },
          "email",
        );
        return { externalId: updated.id };
      }
      logger.error("HubSpot pushContact failed", { err: String(err) });
      throw err;
    }
  }

  /**
   * Verify HubSpot webhook signatures (v3):
   *   signature = base64( HMAC-SHA256( appSecret, method + url + body + ts ) )
   * Header: X-HubSpot-Signature-V3, timestamp: X-HubSpot-Request-Timestamp.
   * Rejects requests older than 5 minutes (replay protection).
   */
  verifyWebhook(req: WebhookRequest): boolean {
    if (!this.config.appSecret) return false;
    const signature = req.headers["x-hubspot-signature-v3"];
    const timestamp = req.headers["x-hubspot-request-timestamp"];
    if (!signature || !timestamp) return false;

    const age = Date.now() - Number(timestamp);
    if (Number.isNaN(age) || age > 5 * 60 * 1000) return false;

    const base = req.method + req.url + req.rawBody + timestamp;
    const expected = crypto
      .createHmac("sha256", this.config.appSecret)
      .update(base, "utf8")
      .digest("base64");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: string): ChannelEvent[] {
    let events: Array<Record<string, unknown>> = [];
    try {
      events = JSON.parse(rawBody || "[]");
    } catch {
      return [];
    }
    return events.map((e): ChannelEvent => {
      const type = String(e.subscriptionType ?? "");
      if (type === "contact.creation" || type === "contact.propertyChange") {
        return {
          type: "contact.changed",
          externalId: e.objectId != null ? String(e.objectId) : undefined,
          contact:
            e.propertyName === "email" && e.propertyValue
              ? { email: String(e.propertyValue) }
              : undefined,
          raw: e,
        };
      }
      return { type: "unknown", raw: e };
    });
  }

  /** Expose the email asset id configured for this connection (used by email module). */
  get transactionalEmailId(): string | undefined {
    return this.config.transactionalEmailId;
  }

  /** Raw SDK client, for modules that need HubSpot-specific APIs (e.g. email). */
  get sdk(): Client {
    return this.client;
  }
}
