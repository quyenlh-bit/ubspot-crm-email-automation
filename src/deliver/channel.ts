import { logger } from "../utils/logger.js";
import type { MessageChannelType } from "../core/domain.js";

/**
 * Message delivery channel — distinct from the CRM `CrmChannel`. Each transport
 * (email, SMS, Zalo ZNS) implements this. v1 implementations are SIMULATED: they
 * log instead of calling a real provider. Real adapters (HubSpot transactional,
 * an SMS gateway, Zalo ZNS/OA API) slot in behind this interface unchanged.
 */
export interface OutboundMessage {
  to: string;
  subject?: string;
  body: string;
}

export interface MessageChannel {
  readonly type: MessageChannelType;
  send(msg: OutboundMessage): Promise<void>;
}

class SimulatedChannel implements MessageChannel {
  constructor(readonly type: MessageChannelType) {}
  async send(msg: OutboundMessage): Promise<void> {
    logger.info("Simulated message dispatch", { channel: this.type, to: msg.to });
  }
}

const channels: Record<MessageChannelType, MessageChannel> = {
  email: new SimulatedChannel("email"),
  sms: new SimulatedChannel("sms"),
  zalo: new SimulatedChannel("zalo"),
};

export const getMessageChannel = (type: MessageChannelType): MessageChannel => channels[type];
