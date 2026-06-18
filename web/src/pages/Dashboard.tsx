import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import { getAnalytics, listCampaigns, listContacts, listSyncLog } from "../api";
import { Card, EmptyState, ErrorBox, Loading, StatusBadge } from "../components/ui";
import { BarChart, Donut, Sparkline } from "../components/charts";
import {
  IconCampaigns,
  IconConnections,
  IconContacts,
  IconSyncLog,
} from "../components/icons";
import type { Campaign, Contact, Funnel } from "../types";

const formatVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

function FunnelView({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: "Sent", value: funnel.sent, color: "#6d5ef0" },
    { label: "Open", value: funnel.open, color: "#8b5cf6" },
    { label: "Click", value: funnel.click, color: "#0ea5e9" },
    { label: "Conversion", value: funnel.conversion, color: "#22c55e" },
  ];
  const max = Math.max(1, funnel.sent);
  return (
    <div className="funnel">
      {stages.map((s) => {
        const rate = funnel.sent ? Math.round((s.value / funnel.sent) * 100) : 0;
        return (
          <div className="funnel-row" key={s.label}>
            <span className="funnel-label">{s.label}</span>
            <div className="funnel-track">
              <div className="funnel-bar" style={{ width: `${(s.value / max) * 100}%`, background: s.color }} />
            </div>
            <span className="funnel-val">{s.value}<span className="muted small"> · {rate}%</span></span>
          </div>
        );
      })}
    </div>
  );
}

const LIFECYCLE_ORDER = ["lead", "subscriber", "customer", "opportunity", "other"];
const STATUS_COLORS: Record<string, string> = {
  draft: "#cbd5e1",
  scheduled: "#f59e0b",
  sending: "#6d5ef0",
  sent: "#22c55e",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function lifecycleBars(contacts: Contact[]) {
  const counts: Record<string, number> = {};
  for (const c of contacts) {
    const key = LIFECYCLE_ORDER.includes(c.lifecycleStage ?? "") ? (c.lifecycleStage as string) : "other";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return LIFECYCLE_ORDER.map((label) => ({ label, value: counts[label] ?? 0 }));
}

function campaignDonut(campaigns: Campaign[]) {
  return (["draft", "scheduled", "sending", "sent"] as const).map((status) => ({
    label: status,
    value: campaigns.filter((c) => c.status === status).length,
    color: STATUS_COLORS[status],
  }));
}

export default function Dashboard() {
  const { selectedId, selected } = useTenant();
  const contacts = useAsync(() => listContacts(selectedId!), [selectedId]);
  const campaigns = useAsync(() => listCampaigns(selectedId!), [selectedId]);
  const log = useAsync(() => listSyncLog(selectedId!), [selectedId]);
  const analytics = useAsync(() => getAnalytics(selectedId!), [selectedId]);

  if (!selectedId) {
    return <EmptyState>Chưa chọn tenant. Tạo hoặc chọn một tenant ở góc trên bên phải.</EmptyState>;
  }

  const contactList = contacts.data ?? [];
  const campaignList = campaigns.data ?? [];
  const logList = log.data ?? [];
  const syncErrors = logList.filter((r) => r.status === "error").length;

  const kpis = [
    { label: "Contacts", value: contactList.length, Icon: IconContacts, color: "#6d5ef0", trend: "up" as const, note: "tổng trong tenant" },
    { label: "Campaigns", value: campaignList.length, Icon: IconCampaigns, color: "#8b5cf6", trend: "up" as const, note: "đã tạo" },
    { label: "Kết nối CRM", value: 0, Icon: IconConnections, color: "#0ea5e9", trend: "flat" as const, note: "đang bật" },
    { label: "Lỗi sync", value: syncErrors, Icon: IconSyncLog, color: syncErrors ? "#e11d48" : "#22c55e", trend: syncErrors ? ("down" as const) : ("flat" as const), note: syncErrors ? "cần xử lý" : "ổn định" },
  ];

  return (
    <>
      <div className="page-head dash-head">
        <div>
          <h1>{greeting()}, {selected?.name ?? "bạn"} 👋</h1>
          <p className="muted">Tổng quan hoạt động CRM &amp; email automation</p>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="kpi-top">
              <span className="kpi-icon" style={{ color: k.color, background: `${k.color}1a` }}>
                <k.Icon size={18} />
              </span>
              <span className="kpi-label">{k.label}</span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-foot">
              <span className="muted small">{k.note}</span>
              <Sparkline color={k.color} trend={k.trend} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card title="Contacts theo lifecycle">
          {contacts.loading && <Loading />}
          {contacts.error && <ErrorBox message={contacts.error} />}
          {!contacts.loading && !contacts.error && <BarChart data={lifecycleBars(contactList)} />}
        </Card>

        <Card title="Campaigns theo trạng thái">
          {campaigns.loading && <Loading />}
          {campaigns.error && <ErrorBox message={campaigns.error} />}
          {!campaigns.loading && !campaigns.error && (
            <Donut data={campaignDonut(campaignList)} centerLabel="campaigns" />
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Email funnel">
          {analytics.loading && <Loading />}
          {analytics.error && <ErrorBox message={analytics.error} />}
          {analytics.data && <FunnelView funnel={analytics.data.funnel} />}
        </Card>
        <Card title="Attribution / ROI">
          {analytics.data && (
            <>
              <div className="attr-total">
                <div className="attr-value">{formatVnd(analytics.data.attribution.totalRevenue)}</div>
                <div className="muted small">doanh thu quy cho marketing · {analytics.data.attribution.totalConversions} chuyển đổi</div>
              </div>
              {analytics.data.attribution.campaigns.length === 0
                ? <EmptyState>Chưa có chuyển đổi. Gửi campaign rồi bấm "Mô phỏng tương tác" ở trang Campaigns.</EmptyState>
                : (
                  <table className="table">
                    <thead><tr><th>Campaign</th><th>Chuyển đổi</th><th>Doanh thu</th></tr></thead>
                    <tbody>
                      {analytics.data.attribution.campaigns.map((c) => (
                        <tr key={c.campaignId}>
                          <td>{c.name}</td>
                          <td>{c.conversions}</td>
                          <td><strong>{formatVnd(c.revenue)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </>
          )}
        </Card>
      </div>

      <Card title="Contacts gần đây" action={<button className="btn ghost" onClick={contacts.reload}>Tải lại</button>}>
        {contacts.loading && <Loading />}
        {contactList.length === 0 && !contacts.loading && <EmptyState>Chưa có contact nào.</EmptyState>}
        {contactList.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Email</th>
                <th>Lifecycle</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {contactList.slice(0, 6).map((c) => {
                const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="avatar-cell">
                        <span className="avatar">{(name[0] ?? "?").toUpperCase()}</span>
                        <strong>{name}</strong>
                      </span>
                    </td>
                    <td className="muted">{c.email}</td>
                    <td>{c.lifecycleStage ? <StatusBadge status={c.lifecycleStage} /> : "—"}</td>
                    <td className="muted small">{new Date(c.updatedAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
