import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { listSyncLog } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";

export default function SyncLog() {
  const { selectedId } = useTenant();
  const log = useAsync(() => listSyncLog(selectedId!), [selectedId]);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  return (
    <>
      <div className="page-head">
        <h1>Sync log</h1>
        <p className="muted">Nhật ký kiểm toán mọi lần đồng bộ core ⇄ channel.</p>
      </div>

      <Card title={`Bản ghi (${log.data?.length ?? 0})`} action={<button className="btn ghost" onClick={log.reload}>Tải lại</button>}>
        {log.loading && <Loading />}
        {log.error && <ErrorBox message={log.error} />}
        {log.data && log.data.length === 0 && <EmptyState>Chưa có bản ghi sync nào.</EmptyState>}
        {log.data && log.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hướng</th>
                <th>Provider</th>
                <th>Entity</th>
                <th>External ID</th>
                <th>Trạng thái</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {log.data.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.direction}</td>
                  <td>{r.provider}</td>
                  <td>{r.entity}</td>
                  <td className="mono">{r.externalId || "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="muted small">{r.detail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
