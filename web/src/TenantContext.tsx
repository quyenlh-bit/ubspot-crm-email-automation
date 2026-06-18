import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Tenant } from "./types";
import { listTenants } from "./api";

interface TenantContextValue {
  tenants: Tenant[];
  selected: Tenant | null;
  selectedId: string | null;
  select: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const STORAGE_KEY = "ubspot.tenantId";

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listTenants();
      setTenants(list);
      // Keep the current selection if still valid, else fall back to the first.
      setSelectedId((prev) =>
        prev && list.some((t) => t.id === prev) ? prev : (list[0]?.id ?? null),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [selectedId]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      selected: tenants.find((t) => t.id === selectedId) ?? null,
      selectedId,
      select: setSelectedId,
      refresh,
      loading,
      error,
    }),
    [tenants, selectedId, loading, error],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within <TenantProvider>");
  return ctx;
}
