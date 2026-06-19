import { Navigate, Route, Routes } from "react-router-dom";
import { TenantProvider } from "./TenantContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Segments from "./pages/Segments";
import Connections from "./pages/Connections";
import Campaigns from "./pages/Campaigns";
import Workflows from "./pages/Workflows";
import Vouchers from "./pages/Vouchers";
import Automation from "./pages/Automation";
import Compliance from "./pages/Compliance";
import SyncLog from "./pages/SyncLog";
import Tenants from "./pages/Tenants";

export default function App() {
  return (
    <TenantProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/segments" element={<Segments />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/vouchers" element={<Vouchers />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/sync-log" element={<SyncLog />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </TenantProvider>
  );
}
