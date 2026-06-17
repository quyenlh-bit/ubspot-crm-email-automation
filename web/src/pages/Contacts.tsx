import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { createContact, listContacts } from "../api";
import { Card, EmptyState, ErrorBox, Loading, Pill } from "../components/ui";

const EMPTY = { email: "", firstName: "", lastName: "", phone: "", lifecycleStage: "" };

export default function Contacts() {
  const { selectedId } = useTenant();
  const contacts = useAsync(() => listContacts(selectedId!), [selectedId]);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => String(v).trim() !== ""),
      );
      await createContact(selectedId!, payload);
      setForm({ ...EMPTY });
      contacts.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="page-head">
        <h1>Contacts</h1>
        <p className="muted">Source of truth — upsert sẽ đẩy sang mọi kênh CRM đang bật.</p>
      </div>

      <Card title="Thêm / cập nhật contact">
        <form className="form-grid" onSubmit={submit}>
          <input placeholder="Email *" value={form.email} onChange={set("email")} required type="email" />
          <input placeholder="First name" value={form.firstName} onChange={set("firstName")} />
          <input placeholder="Last name" value={form.lastName} onChange={set("lastName")} />
          <input placeholder="Phone" value={form.phone} onChange={set("phone")} />
          <input placeholder="Lifecycle stage (vd: lead)" value={form.lifecycleStage} onChange={set("lifecycleStage")} />
          <button className="btn" disabled={submitting}>{submitting ? "Đang lưu…" : "Lưu & sync"}</button>
        </form>
        {formError && <ErrorBox message={formError} />}
      </Card>

      <Card title={`Danh sách (${contacts.data?.length ?? 0})`} action={<button className="btn ghost" onClick={contacts.reload}>Tải lại</button>}>
        {contacts.loading && <Loading />}
        {contacts.error && <ErrorBox message={contacts.error} />}
        {contacts.data && contacts.data.length === 0 && <EmptyState>Chưa có contact nào.</EmptyState>}
        {contacts.data && contacts.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tên</th>
                <th>Phone</th>
                <th>Lifecycle</th>
                <th>External IDs</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {contacts.data.map((c) => (
                <tr key={c.id}>
                  <td>{c.email}</td>
                  <td>{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.lifecycleStage || "—"}</td>
                  <td>
                    {Object.entries(c.externalIds).length === 0
                      ? <span className="muted">chưa sync</span>
                      : Object.entries(c.externalIds).map(([p, id]) => <Pill key={p}>{p}:{id}</Pill>)}
                  </td>
                  <td>{new Date(c.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
