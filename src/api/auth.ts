import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { apiKeyRepository } from "../core/auth/apikey.repository.js";
import type { ApiRole } from "../core/domain.js";

export interface AuthContext {
  tenantId: string;
  role: ApiRole;
}

/**
 * RBAC middleware for /api. Opt-in via REQUIRE_AUTH=true:
 *  - requires an x-api-key header that resolves to a key
 *  - viewers may only read (GET); editors/admins may mutate
 *  - the key's tenant must match the :tenantId in the path
 * When REQUIRE_AUTH != "true" it is a no-op (open demo).
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (env.REQUIRE_AUTH !== "true") return next();

  const key = req.header("x-api-key");
  if (!key) {
    res.status(401).json({ error: "x-api-key required" });
    return;
  }
  const found = await apiKeyRepository.findByKey(key);
  if (!found) {
    res.status(401).json({ error: "invalid API key" });
    return;
  }
  if (req.method !== "GET" && found.role === "viewer") {
    res.status(403).json({ error: "viewer role is read-only" });
    return;
  }
  const pathTenant = req.path.match(/^\/tenants\/([^/]+)/)?.[1];
  if (pathTenant && pathTenant !== found.tenantId) {
    res.status(403).json({ error: "API key does not belong to this tenant" });
    return;
  }
  (req as Request & { auth?: AuthContext }).auth = { tenantId: found.tenantId, role: found.role };
  next();
}
