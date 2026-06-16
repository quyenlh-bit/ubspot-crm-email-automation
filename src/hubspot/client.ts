import { Client } from "@hubspot/api-client";
import { env } from "../config/env.js";

/**
 * Shared HubSpot API client, authenticated with a Private App access token.
 * Import this everywhere instead of constructing new clients.
 */
export const hubspot = new Client({
  accessToken: env.HUBSPOT_ACCESS_TOKEN,
  numberOfApiCallRetries: 3,
});
