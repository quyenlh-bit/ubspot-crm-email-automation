import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { createJourney, getTemplates, listJourneys, listSegments, runJourney } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";
import type { JourneyStep, MessageChannel } from "../types";

const CHANNELS: MessageChannel[] = ["email", "sms", "zalo"];

export default function Journeys() {
  const { selectedId } = useTenant();
  const journeys = useAsync(() => listJourneys(selectedId!), [selectedId]);
  const segments = useAsync(() => listSegments(selectedId!), [selectedId]);
  const templates = useAsync(() => getTemplates(), []);
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [steps, setSteps] = useState<JourneyStep[]>([{ type: "send", templateId: "welcome", channel: "email" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  const addStep = (type: JourneyStep["type"]) =>
    setSteps((s) => [...s, type === "send" ? { type, templateId: "", channel: "email" } : type === "wait" ? { type, waitHours: 24 } : { type }]);
  const updateStep = (i: number, patch: Partial<JourneyStep>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createJourney(selectedId!, { name, segmentId: segmentId || null, steps });
      setName("");
      setSegmentId("");
      setSteps([{ type: "send", templateId: "welcome", channel: "email" }]);
      journeys.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function run(id: string) {
    setRunningId(id);
    setError(null);
    try {
      await runJourney(selectedId!, id);
      journeys.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Journeys</h1>
        <p className="muted">Điều phối đa bước: enrol segment → send / wait / exit. Chạy mô phỏng để xem số người qua từng bước (đã qua cổng consent).</p>
      </div>

      {error && <ErrorBox message={error} />}

      <Card title="Tạo journey">
        <form className="form-stack" onSubmit={submit}>
          <label>
            Tên *
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="vd: Lead nurture" />
          </label>
          <label>
            Trigger — segment enrol
            <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">— Chọn segment —</option>
              {(segments.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.memberCount ?? "?"})</option>)}
            </select>
          </label>

          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>Các bước</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-idx">{i + 1}</span>
                  <StatusBadge status={st.type} />
                  {st.type === "send" && (
                    <>
                      <select value={st.templateId ?? ""} onChange={(e) => updateStep(i, { templateId: e.target.value })}>
                        <option value="">(template)</option>
                        {(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <select value={st.channel ?? "email"} onChange={(e) => updateStep(i, { channel: e.target.value as MessageChannel })}>
                        {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </>
                  )}
                  {st.type === "wait" && (
                    <input type="number" min={1} value={st.waitHours ?? 24} style={{ width: 90 }}
                      onChange={(e) => updateStep(i, { waitHours: Number(e.target.value) })} />
                  )}
                  {st.type === "wait" && <span className="muted small">giờ</span>}
                  <button type="button" className="btn ghost" onClick={() => removeStep(i)} style={{ marginLeft: "auto" }}>Xoá</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn ghost" onClick={() => addStep("send")}>+ Gửi</button>
              <button type="button" className="btn ghost" onClick={() => addStep("wait")}>+ Chờ</button>
              <button type="button" className="btn ghost" onClick={() => addStep("exit")}>+ Exit</button>
            </div>
          </div>

          <button className="btn" disabled={submitting}>{submitting ? "Đang lưu…" : "Tạo journey"}</button>
        </form>
      </Card>

      <Card title={`Danh sách (${journeys.data?.length ?? 0})`} action={<button className="btn ghost" onClick={journeys.reload}>Tải lại</button>}>
        {journeys.loading && <Loading />}
        {journeys.data && journeys.data.length === 0 && <EmptyState>Chưa có journey nào.</EmptyState>}
        {journeys.data && journeys.data.map((j) => (
          <div key={j.id} className="journey-item">
            <div className="journey-top">
              <strong>{j.name}</strong>
              <StatusBadge status={j.status} />
              <span className="muted small">{j.steps.length} bước</span>
              <button className="btn" disabled={runningId === j.id} onClick={() => run(j.id)} style={{ marginLeft: "auto" }}>
                {runningId === j.id ? "Đang chạy…" : "Chạy (mô phỏng)"}
              </button>
            </div>
            <div className="journey-steps">
              {j.steps.map((s, i) => (
                <span key={i} className="pill">{i + 1}. {s.type}{s.type === "send" ? `:${s.templateId || "?"}/${s.channel}` : s.type === "wait" ? `:${s.waitHours}h` : ""}</span>
              ))}
            </div>
            {j.lastRunSummary && (
              <table className="table" style={{ marginTop: 10 }}>
                <thead><tr><th>Bước</th><th>Chi tiết</th><th>Số người</th></tr></thead>
                <tbody>
                  <tr><td className="muted">enrol</td><td className="muted">Thành viên segment</td><td><strong>{j.lastRunSummary.enrolled}</strong></td></tr>
                  {j.lastRunSummary.steps.map((s) => (
                    <tr key={s.index}><td>{s.index + 1}. {s.type}</td><td className="muted">{s.detail}</td><td><strong>{s.count}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
