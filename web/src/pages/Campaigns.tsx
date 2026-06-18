import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { createCampaign, getTemplates, listCampaigns, listSegments, sendCampaign } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";

const LIFECYCLE_STAGES = ["lead", "subscriber", "customer", "opportunity", "other"];
const CHANNELS = ["email", "sms", "zalo"] as const;
const EMPTY = { name: "", templateId: "", subject: "", body: "", segmentId: "", audienceLifecycleStage: "", channel: "email", voucherCode: "", scheduledAt: "" };

export default function Campaigns() {
  const { selectedId } = useTenant();
  const campaigns = useAsync(() => listCampaigns(selectedId!), [selectedId]);
  const templates = useAsync(() => getTemplates(), []);
  const segments = useAsync(() => listSegments(selectedId!), [selectedId]);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function onPickTemplate(id: string) {
    const t = templates.data?.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      templateId: id,
      // Prefill subject/body from the template (only when empty or switching).
      subject: t ? t.subject : f.subject,
      body: t ? t.body : f.body,
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createCampaign(selectedId!, {
        name: form.name,
        templateId: form.templateId || undefined,
        subject: form.subject,
        body: form.body,
        segmentId: form.segmentId || undefined,
        audienceLifecycleStage: form.segmentId ? undefined : form.audienceLifecycleStage || undefined,
        channel: form.channel as (typeof CHANNELS)[number],
        voucherCode: form.voucherCode || undefined,
        scheduledAt: form.scheduledAt || undefined,
      });
      setForm({ ...EMPTY });
      campaigns.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function send(id: string) {
    setSendingId(id);
    try {
      await sendCampaign(selectedId!, id);
      campaigns.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Campaigns</h1>
        <p className="muted">Soạn email campaign, chọn audience + template + lịch gửi. Gửi được mô phỏng (chưa gọi email thật).</p>
      </div>

      <Card title="Tạo campaign">
        <form className="form-stack" onSubmit={submit}>
          <label>
            Tên campaign *
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="vd: Welcome new leads" />
          </label>
          <label>
            Template email
            <select value={form.templateId} onChange={(e) => onPickTemplate(e.target.value)}>
              <option value="">— Không dùng template —</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Subject *
            <input value={form.subject} onChange={(e) => set("subject", e.target.value)} required placeholder="Tiêu đề email" />
          </label>
          <label>
            Nội dung * <span className="muted small">(dùng {"{{firstName}}"} để cá nhân hoá)</span>
            <textarea rows={6} value={form.body} onChange={(e) => set("body", e.target.value)} required
              style={{ padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 14, resize: "vertical" }} />
          </label>
          <label>
            Segment (ưu tiên nếu chọn)
            <select value={form.segmentId} onChange={(e) => set("segmentId", e.target.value)}>
              <option value="">— Không dùng segment —</option>
              {(segments.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.memberCount ?? "?"})</option>
              ))}
            </select>
          </label>
          <label>
            Audience (lifecycle stage) <span className="muted small">— dùng khi không chọn segment</span>
            <select value={form.audienceLifecycleStage} onChange={(e) => set("audienceLifecycleStage", e.target.value)} disabled={!!form.segmentId}>
              <option value="">Tất cả contact</option>
              {LIFECYCLE_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Kênh gửi
            <select value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Voucher / offer code (tuỳ chọn) <span className="muted small">— chèn vào nội dung</span>
            <input value={form.voucherCode} onChange={(e) => set("voucherCode", e.target.value)} placeholder="vd: URBOX50" />
          </label>
          <label>
            Lịch gửi (tuỳ chọn)
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
          </label>
          <button className="btn" disabled={submitting}>{submitting ? "Đang lưu…" : "Tạo campaign"}</button>
        </form>
        {formError && <ErrorBox message={formError} />}
      </Card>

      <Card title={`Danh sách (${campaigns.data?.length ?? 0})`} action={<button className="btn ghost" onClick={campaigns.reload}>Tải lại</button>}>
        {campaigns.loading && <Loading />}
        {campaigns.error && <ErrorBox message={campaigns.error} />}
        {campaigns.data && campaigns.data.length === 0 && <EmptyState>Chưa có campaign nào.</EmptyState>}
        {campaigns.data && campaigns.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Subject</th>
                <th>Audience</th>
                <th>Lịch / Đã gửi</th>
                <th>Người nhận</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.data.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.subject}</td>
                  <td>{c.audienceLifecycleStage || <span className="muted">tất cả</span>}</td>
                  <td className="small">
                    {c.sentAt
                      ? `Đã gửi: ${new Date(c.sentAt).toLocaleString()}`
                      : c.scheduledAt
                        ? `Lịch: ${new Date(c.scheduledAt).toLocaleString()}`
                        : "—"}
                  </td>
                  <td>{c.recipientCount ?? "—"}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    {c.status === "sent"
                      ? <span className="muted">✓</span>
                      : <button className="btn" disabled={sendingId === c.id} onClick={() => send(c.id)}>
                          {sendingId === c.id ? "Đang gửi…" : "Gửi ngay"}
                        </button>}
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
