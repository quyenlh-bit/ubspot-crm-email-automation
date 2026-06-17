import type { ChannelConnection, ChannelProvider } from "../core/domain.js";
import type { ChannelFactory, CrmChannel } from "./channel.js";
import { connectionRepository } from "../core/channels/connection.repository.js";
import { HubSpotChannel } from "./hubspot/hubspot.channel.js";

/**
 * Channel registry — maps a provider id to its factory. Register new CRM
 * providers here; nothing else in the platform needs to change.
 *
 * Salesforce/Zoho are declared as known providers in the domain but not yet
 * implemented — connecting them will throw a clear error until an adapter
 * lands here.
 */
const factories: Partial<Record<ChannelProvider, ChannelFactory>> = {
  hubspot: (c) => new HubSpotChannel(c),
};

export function isProviderSupported(provider: ChannelProvider): boolean {
  return provider in factories;
}

/** Build a live channel from a stored tenant connection. */
export function createChannel(connection: ChannelConnection): CrmChannel {
  const factory = factories[connection.provider];
  if (!factory) {
    throw new Error(
      `CRM provider "${connection.provider}" is not implemented yet. ` +
        `Add a factory in src/channels/registry.ts.`,
    );
  }
  return factory(connection);
}

/**
 * Resolve a tenant's enabled connection for one provider and build its channel,
 * or return null if the tenant has not connected that provider. Use this when a
 * feature is provider-specific (e.g. HubSpot transactional email) rather than
 * fanning out across all channels.
 */
export async function getChannelForTenant(
  tenantId: string,
  provider: ChannelProvider,
): Promise<CrmChannel | null> {
  const connections = await connectionRepository.listEnabled(tenantId);
  const connection = connections.find((c) => c.provider === provider);
  return connection ? createChannel(connection) : null;
}
