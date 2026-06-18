import type { ReactElement } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTenant } from "../TenantContext";
import {
  IconAutomation,
  IconBell,
  IconCampaigns,
  IconConnections,
  IconContacts,
  IconDashboard,
  IconSearch,
  IconShield,
  IconSyncLog,
  IconTenants,
} from "./icons";

type NavItem = {
  to: string;
  label: string;
  icon: (props: { size?: number }) => ReactElement;
  end?: boolean;
  badge?: string;
};

const MENU: NavItem[] = [
  { to: "/", label: "Dashboard", icon: IconDashboard, end: true },
  { to: "/contacts", label: "Contacts", icon: IconContacts },
  { to: "/connections", label: "Connections", icon: IconConnections },
  { to: "/campaigns", label: "Campaigns", icon: IconCampaigns, badge: "NEW" },
  { to: "/automation", label: "Automation", icon: IconAutomation },
];

const SETTINGS: NavItem[] = [
  { to: "/compliance", label: "Compliance", icon: IconShield },
  { to: "/sync-log", label: "Sync log", icon: IconSyncLog },
  { to: "/tenants", label: "Tenants", icon: IconTenants },
];

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="nav-group">
      <div className="nav-group-title">{title}</div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            <span className="nav-icon"><Icon /></span>
            <span className="nav-text">{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function Layout() {
  const { tenants, selectedId, select, loading } = useTenant();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo" aria-hidden />
          <span className="brand-text">
            uBspot<small>CRM Email Automation</small>
          </span>
        </div>

        <nav className="nav">
          <NavGroup title="MENU" items={MENU} />
          <NavGroup title="SETTINGS" items={SETTINGS} />
        </nav>

        <div className="onboard-card">
          <div className="onboard-head">
            <span>Onboarding hub</span>
          </div>
          <div className="onboard-bars" aria-hidden>
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className={i < 7 ? "on" : ""} />
            ))}
          </div>
          <div className="onboard-foot muted">Khám phá các tính năng</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="search">
            <IconSearch size={17} />
            <input placeholder="Tìm kiếm…" aria-label="Tìm kiếm" />
          </div>
          <div className="topbar-right">
            <label className="tenant-picker">
              <span className="muted">Tenant</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => select(e.target.value)}
                disabled={loading || tenants.length === 0}
              >
                {tenants.length === 0 && <option value="">— chưa có tenant —</option>}
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <button className="icon-btn" aria-label="Thông báo"><IconBell size={18} /></button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
