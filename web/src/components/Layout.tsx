import { NavLink, Outlet } from "react-router-dom";
import { useTenant } from "../TenantContext";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/contacts", label: "Contacts" },
  { to: "/connections", label: "Connections" },
  { to: "/automation", label: "Automation" },
  { to: "/sync-log", label: "Sync log" },
  { to: "/tenants", label: "Tenants" },
];

export default function Layout() {
  const { tenants, selectedId, select, loading } = useTenant();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          uBspot <span>CRM Admin</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot muted">Multi-tenant CRM email automation</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <label className="tenant-picker">
            <span className="muted">Tenant</span>
            <select
              value={selectedId ?? ""}
              onChange={(e) => select(e.target.value)}
              disabled={loading || tenants.length === 0}
            >
              {tenants.length === 0 && <option value="">— chưa có tenant —</option>}
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
