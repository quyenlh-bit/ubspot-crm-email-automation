import { logger } from "../utils/logger.js";
import { getChannelForTenant } from "../channels/registry.js";
import { HubSpotChannel } from "../channels/hubspot/hubspot.channel.js";
import { sendTransactionalEmail } from "../services/email.service.js";
import type { MessageChannelType } from "../core/domain.js";

/**
 * Message delivery channel — distinct from the CRM `CrmChannel`. Each transport
 * attempts a REAL send when the tenant/env is configured, and falls back to a
 * simulated (logged) send otherwise, so the platform runs end-to-end without
 * live credentials.
 */
export interface OutboundMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface MessageChannel {
  readonly type: MessageChannelType;
  send(tenantId: string, msg: OutboundMessage): Promise<void>;
}

/** Email: real via the tenant's HubSpot transactional send when connected. */
class EmailChannel implements MessageChannel {
  readonly type = "email" as const;
  async send(tenantId: string, msg: OutboundMessage): Promise<void> {
    try {
      const ch = await getChannelForTenant(tenantId, "hubspot");
      if (ch instanceof HubSpotChannel && ch.transactionalEmailId) {
        await sendTransactionalEmail(tenantId, { to: msg.to });
        return;
      }
    } catch (err) {
      logger.warn("Email real send failed — simulating", { to: msg.to, err: String(err) });
    }
    logger.info("Simulated email dispatch", { to: msg.to });
  }
}

/** SMS/Zalo: POST to a configured provider webhook if set, else simulate. */
class WebhookChannel implements MessageChannel {
  constructor(readonly type: MessageChannelType, private readonly envVar: string) {}
  async send(tenantId: string, msg: OutboundMessage): Promise<void> {
    const url = process.env[this.envVar];
    if (url) {
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, channel: this.type, to: msg.to, body: msg.body }),
        });
        return;
      } catch (err) {
        logger.warn(`${this.type} real send failed — simulating`, { to: msg.to, err: String(err) });
      }
    }
    logger.info("Simulated message dispatch", { channel: this.type, to: msg.to });
  }
}

const channels: Record<MessageChannelType, MessageChannel> = {
  email: new EmailChannel(),
  sms: new WebhookChannel("sms", "SMS_WEBHOOK_URL"),
  zalo: new WebhookChannel("zalo", "ZALO_ZNS_WEBHOOK_URL"),
};

export const getMessageChannel = (type: MessageChannelType): MessageChannel => channels[type];
