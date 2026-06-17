import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { getProviders, listConnections, upsertConnection } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";

export default function Connections() {
  const { selectedId } = useTenant();
  const connections = useAsync(() => listConnections(selectedId!), [selectedId]);
  const providers = useAsync(() => getProviders(), []);

  const [provider, setProvider] = useState("hubspot");
  const [hs, setHs] = useState({ accessToken: "", appSecret: "", transactionalEmailId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  const supported = providers.data?.find((p) => p.id === provider)?.supported ?? true;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const config =
        provider === "hubspot"
          ? Object.fromEntries(Object.entries(hs).filter(([, v]) => String(v).trim() !== ""))
          : {};
      await upsertConnection(selectedId!, provider, config);
      setHs({ accessToken: "", appSecret: "", transactionalEmailId: "" });
      connections.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Connections</h1>
        <p className="muted">Credential CRM được lưu per-tenant. Bí mật không bao giờ hiển thị lại đầy đủ.</p>
      </div>

      <Card title="Kết nối provider">
        <form className="form-stack" onSubmit={submit}>
          <label>
            Provider
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {(providers.data ?? [{ id: "hubspot", supported: true }]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}{p.supported ? "" : " (chưa hỗ trợ)"}
                </option>
              ))}
            </select>
          </label>

          {provider === "hubspot" ? (
            <>
              <label>
                Access token *
                <input type="password" autoComplete="off" value={hs.accessToken}
                  onChange={(e) => setHs((s) => ({ ...s, accessToken: e.target.value }))}
                  placeholder="pat-..." required />
              </label>
              <label>
                App secret (cho webhook)
                <input type="password" autoComplete="off" value={hs.appSecret}
                  onChange={(e) => setHs((s) => ({ ...s, appSecret: e.target.value }))} />
              </label>
              <label>
                Transactional email ID (cho email)
                <input value={hs.transactionalEmailId}
                  onChange={(e) => setHs((s) => ({ ...s, transactionalEmailId: e.target.value }))}
                  placeholder="vd: 123456" />
              </label>
            </>
          ) : (
            <p className="muted">Provider “{provider}” chưa có adapter — sẽ bị backend từ chối cho tới khi triển khai.</p>
          )}

          <button className="btn" disabled={submitting || !supported}>
            {submitting ? "Đang lưu…" : "Lưu kết nối"}
          </button>
        </form>
        {formError && <ErrorBox message={formError} />}
      </Card>

      <Card title={`Đã kết nối (${connections.data?.length ?? 0})`} action={<button className="btn ghost" onClick={connections.reload}>Tải lại</button>}>
        {connections.loading && <Loading />}
        {connections.error && <ErrorBox message={connections.error} />}
        {connections.data && connections.data.length === 0 && <EmptyState>Chưa kết nối provider nào.</EmptyState>}
        {connections.data && connections.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Trạng thái</th>
                <th>Config</th>
                <th>Tạo lúc</th>
              </tr>
            </thead>
            <tbody>
              {connections.data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.provider}</strong></td>
                  <td><StatusBadge status={c.enabled ? "ok" : "disabled"} /></td>
                  <td className="mono">
                    {Object.entries(c.config).map(([k, v]) => (
                      <div key={k}>{k}: {String(v)}</div>
                    ))}
                  </td>
                  <td>{new Date(c.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
