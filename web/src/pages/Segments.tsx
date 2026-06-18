import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { createSegment, listSegments } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";
import type { SegmentType } from "../types";

const LIFECYCLE_STAGES = ["lead", "subscriber", "customer", "opportunity", "other"];

export default function Segments() {
  const { selectedId } = useTenant();
  const segments = useAsync(() => listSegments(selectedId!), [selectedId]);
  const [name, setName] = useState("");
  const [type, setType] = useState<SegmentType>("dynamic");
  const [stages, setStages] = useState<string[]>([]);
  const [emails, setEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  const toggleStage = (s: string) =>
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSegment(selectedId!, {
        name,
        type,
        lifecycleStages: type === "dynamic" ? stages : undefined,
        memberEmails:
          type === "static"
            ? emails.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)
            : undefined,
      });
      setName("");
      setStages([]);
      setEmails("");
      segments.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Segments</h1>
        <p className="muted">Phân khúc audience — static (danh sách email) hoặc dynamic (tự cập nhật theo lifecycle). Mọi campaign/journey nhắm vào segment.</p>
      </div>

      <Card title="Tạo segment">
        <form className="form-stack" onSubmit={submit}>
          <label>
            Tên *
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="vd: Leads Q2" />
          </label>
          <label>
            Loại
            <select value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
              <option value="dynamic">Dynamic (rule theo lifecycle)</option>
              <option value="static">Static (danh sách email)</option>
            </select>
          </label>
          {type === "dynamic" ? (
            <div>
              <div className="muted small" style={{ marginBottom: 6 }}>Lifecycle stages (bỏ trống = tất cả)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {LIFECYCLE_STAGES.map((s) => (
                  <label key={s} style={{ flexDirection: "row", alignItems: "center", gap: 6, fontWeight: 400 }}>
                    <input type="checkbox" checked={stages.includes(s)} onChange={() => toggleStage(s)} /> {s}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <label>
              Email (phân tách bằng dấu phẩy / xuống dòng)
              <textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)}
                style={{ padding: "9px 11px", border: "1px solid var(--line)", borderRadius: 11, fontFamily: "inherit", fontSize: 14, resize: "vertical" }} />
            </label>
          )}
          <button className="btn" disabled={submitting}>{submitting ? "Đang lưu…" : "Tạo segment"}</button>
        </form>
        {error && <ErrorBox message={error} />}
      </Card>

      <Card title={`Danh sách (${segments.data?.length ?? 0})`} action={<button className="btn ghost" onClick={segments.reload}>Tải lại</button>}>
        {segments.loading && <Loading />}
        {segments.error && <ErrorBox message={segments.error} />}
        {segments.data && segments.data.length === 0 && <EmptyState>Chưa có segment nào.</EmptyState>}
        {segments.data && segments.data.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Tên</th><th>Loại</th><th>Rule</th><th>Thành viên</th></tr>
            </thead>
            <tbody>
              {segments.data.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td><StatusBadge status={s.type} /></td>
                  <td className="muted small">
                    {s.type === "dynamic"
                      ? s.lifecycleStages.length ? s.lifecycleStages.join(", ") : "tất cả"
                      : `${s.memberEmails.length} email`}
                  </td>
                  <td><strong>{s.memberCount ?? "—"}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
