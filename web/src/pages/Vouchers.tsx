import { useState } from "react";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { listVouchers, redeemVoucher } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";

const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

export default function Vouchers() {
  const { selectedId } = useTenant();
  const vouchers = useAsync(() => listVouchers(selectedId!), [selectedId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;
  }

  async function redeem(id: string) {
    setBusy(id);
    setError(null);
    try {
      await redeemVoucher(selectedId!, id);
      vouchers.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const data = vouchers.data ?? [];
  const issued = data.filter((v) => v.status === "issued").length;
  const redeemed = data.filter((v) => v.status === "redeemed").length;

  return (
    <>
      <div className="page-head">
        <h1>Vouchers</h1>
        <p className="muted">Vòng đời voucher: phát khi gửi (send có voucher) → <b>redeem</b> ghi nhận conversion (vào attribution + goal journey) → hết hạn tự chuyển expired.</p>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-value">{data.length}</div><div className="kpi-label">Tổng voucher</div></div>
        <div className="kpi"><div className="kpi-value">{issued}</div><div className="kpi-label">Đang phát (issued)</div></div>
        <div className="kpi"><div className="kpi-value">{redeemed}</div><div className="kpi-label">Đã redeem</div></div>
        <div className="kpi"><div className="kpi-value">{data.filter((v) => v.status === "expired").length}</div><div className="kpi-label">Hết hạn</div></div>
      </div>

      <Card title={`Danh sách (${data.length})`} action={<button className="btn ghost" onClick={vouchers.reload}>Tải lại</button>}>
        {vouchers.loading && <Loading />}
        {!vouchers.loading && data.length === 0 && <EmptyState>Chưa có voucher. Gửi một campaign/workflow có voucher code để phát.</EmptyState>}
        {data.length > 0 && (
          <table className="table">
            <thead>
              <tr><th>Email</th><th>Code</th><th>Giá trị</th><th>Trạng thái</th><th>Phát lúc</th><th></th></tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id}>
                  <td>{v.email}</td>
                  <td className="mono">{v.code}</td>
                  <td>{fmtVnd(v.amount)}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td className="muted small">{new Date(v.issuedAt).toLocaleString()}</td>
                  <td>
                    {v.status === "issued"
                      ? <button className="btn" disabled={busy === v.id} onClick={() => redeem(v.id)}>{busy === v.id ? "…" : "Redeem"}</button>
                      : <span className="muted">—</span>}
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
