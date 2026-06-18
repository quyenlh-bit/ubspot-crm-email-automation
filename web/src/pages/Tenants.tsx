import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { createTenant } from "../api";
import { Card, EmptyState, ErrorBox, Loading } from "../components/ui";

export default function Tenants() {
  const { tenants, selectedId, select, refresh, loading, error } = useTenant();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const t = await createTenant(name.trim());
      setName("");
      await refresh();
      select(t.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Tenants</h1>
        <p className="muted">Mỗi tenant là một đơn vị cô lập dữ liệu của nền tảng.</p>
      </div>

      <Card title="Tạo tenant">
        <form className="form-grid" onSubmit={submit}>
          <input placeholder="Tên tenant *" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn" disabled={submitting || !name.trim()}>
            {submitting ? "Đang tạo…" : "Tạo"}
          </button>
        </form>
        {formError && <ErrorBox message={formError} />}
      </Card>

      <Card title={`Danh sách (${tenants.length})`} action={<button className="btn ghost" onClick={() => void refresh()}>Tải lại</button>}>
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {!loading && tenants.length === 0 && <EmptyState>Chưa có tenant. Tạo một tenant để bắt đầu.</EmptyState>}
        {tenants.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>ID</th>
                <th>Tạo lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className={t.id === selectedId ? "row-active" : ""}>
                  <td><strong>{t.name}</strong></td>
                  <td className="mono small">{t.id}</td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>
                    {t.id === selectedId
                      ? <span className="muted">đang chọn</span>
                      : <button className="btn ghost" onClick={() => select(t.id)}>Chọn</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
