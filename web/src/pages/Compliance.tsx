import { useState, type FormEvent } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import {
  addSuppression,
  listConsents,
  listContacts,
  listSuppression,
  removeSuppression,
  setConsent,
} from "../api";
import { Card, EmptyState, ErrorBox, Loading } from "../components/ui";
import type { MessageChannel } from "../types";

const CHANNELS: MessageChannel[] = ["email", "sms", "zalo"];

export default function Compliance() {
  const { selectedId } = useTenant();
  const contacts = useAsync(() => listContacts(selectedId!), [selectedId]);
  const consents = useAsync(() => listConsents(selectedId!), [selectedId]);
  const suppression = useAsync(() => listSuppression(selectedId!), [selectedId]);
  const [supEmail, setSupEmail] = useState("");
  const [supReason, setSupReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  const consentByEmail = new Map((consents.data ?? []).map((c) => [c.email, c.channels]));

  async function toggle(email: string, channel: MessageChannel, value: boolean) {
    setError(null);
    try {
      await setConsent(selectedId!, email, channel, value);
      consents.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addSup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addSuppression(selectedId!, supEmail, supReason || undefined);
      setSupEmail("");
      setSupReason("");
      suppression.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeSup(email: string) {
    setError(null);
    try {
      await removeSuppression(selectedId!, email);
      suppression.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Compliance</h1>
        <p className="muted">Consent &amp; suppression — cổng pháp lý (Decree 13). Chỉ gửi tới contact đã opt-in và không bị suppress.</p>
      </div>

      {error && <ErrorBox message={error} />}

      <Card title="Consent / preference center">
        {(contacts.loading || consents.loading) && <Loading />}
        {contacts.data && contacts.data.length === 0 && <EmptyState>Chưa có contact nào.</EmptyState>}
        {contacts.data && contacts.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                {CHANNELS.map((ch) => <th key={ch} style={{ textAlign: "center" }}>{ch}</th>)}
              </tr>
            </thead>
            <tbody>
              {contacts.data.map((c) => {
                const ch = consentByEmail.get(c.email) ?? { email: false, sms: false, zalo: false };
                return (
                  <tr key={c.id}>
                    <td>{c.email}</td>
                    {CHANNELS.map((channel) => (
                      <td key={channel} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={ch[channel] ?? false}
                          onChange={(e) => toggle(c.email, channel, e.target.checked)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`Suppression list (${suppression.data?.length ?? 0})`}>
        <form className="form-grid" onSubmit={addSup}>
          <input placeholder="Email cần chặn *" type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} required />
          <input placeholder="Lý do (vd: unsubscribed)" value={supReason} onChange={(e) => setSupReason(e.target.value)} />
          <button className="btn">Thêm vào suppression</button>
        </form>
        {suppression.loading && <Loading />}
        {suppression.data && suppression.data.length === 0 && <EmptyState>Suppression list trống.</EmptyState>}
        {suppression.data && suppression.data.length > 0 && (
          <table className="table" style={{ marginTop: 14 }}>
            <thead>
              <tr><th>Email</th><th>Lý do</th><th>Thêm lúc</th><th></th></tr>
            </thead>
            <tbody>
              {suppression.data.map((s) => (
                <tr key={s.id}>
                  <td>{s.email}</td>
                  <td className="muted">{s.reason || "—"}</td>
                  <td className="muted small">{new Date(s.createdAt).toLocaleString()}</td>
                  <td><button className="btn ghost" onClick={() => removeSup(s.email)}>Gỡ</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
