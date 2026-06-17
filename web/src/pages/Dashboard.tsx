import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { getStats, listSyncLog } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";

export default function Dashboard() {
  const { selectedId, selected } = useTenant();
  const stats = useAsync(() => getStats(selectedId!), [selectedId]);
  const recent = useAsync(() => listSyncLog(selectedId!), [selectedId]);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Tạo hoặc chọn một tenant ở góc trên bên phải.</EmptyState>;
  }

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p className="muted">Tenant: {selected?.name}</p>
      </div>

      {stats.error && <ErrorBox message={stats.error} />}
      <div className="stat-grid">
        <Stat label="Contacts" value={stats.data?.contacts} />
        <Stat label="Kết nối CRM" value={stats.data?.connections} />
        <Stat label="Lỗi sync" value={stats.data?.syncErrors} tone={stats.data?.syncErrors ? "error" : undefined} />
        <Stat label="Tổng tenants" value={stats.data?.tenants} />
      </div>

      <Card title="Hoạt động sync gần đây">
        {recent.loading && <Loading />}
        {recent.error && <ErrorBox message={recent.error} />}
        {recent.data && recent.data.length === 0 && <EmptyState>Chưa có hoạt động sync nào.</EmptyState>}
        {recent.data && recent.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hướng</th>
                <th>Provider</th>
                <th>Entity</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recent.data.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.direction}</td>
                  <td>{r.provider}</td>
                  <td>{r.entity}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "error" }) {
  return (
    <div className={tone === "error" ? "stat stat-error" : "stat"}>
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
