import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { triggerOnboarding } from "../api";
import { Card, EmptyState, ErrorBox } from "../components/ui";

export default function Automation() {
  const { selectedId } = useTenant();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      await triggerOnboarding(selectedId!, { email, firstName: firstName || undefined });
      setResult(`Đã chạy onboarding workflow cho ${email}.`);
      setEmail("");
      setFirstName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Automation</h1>
        <p className="muted">Chạy thủ công onboarding workflow: upsert lead vào core + sync + gửi email chào mừng.</p>
      </div>

      <Card title="Trigger onboarding workflow">
        <form className="form-stack" onSubmit={submit}>
          <label>
            Email *
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@example.com" />
          </label>
          <label>
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="An" />
          </label>
          <button className="btn" disabled={submitting}>{submitting ? "Đang chạy…" : "Chạy workflow"}</button>
        </form>
        {result && <div className="ok-box">✓ {result}</div>}
        {error && <ErrorBox message={error} />}
        <p className="muted small">
          Lưu ý: gửi email cần tenant có kết nối HubSpot kèm <code>transactionalEmailId</code>. Nếu chưa cấu hình,
          contact vẫn được tạo nhưng bước email sẽ báo lỗi.
        </p>
      </Card>
    </>
  );
}
