interface IconProps {
  size?: number;
}

/** Minimal stroke icon set (currentColor) used by the sidebar/topbar. */
const wrap = (size: number, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const IconDashboard = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ));

export const IconContacts = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 7.5a3 3 0 0 1 0 5.8" />
      <path d="M18.5 19c0-2-.8-3.6-2.2-4.6" />
    </>
  ));

export const IconConnections = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M9 15l6-6" />
      <path d="M13.5 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1" />
      <path d="M10.5 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
    </>
  ));

export const IconCampaigns = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M3 11l16-6v14L3 13z" />
      <path d="M3 11v2" />
      <path d="M8 13v4l3 1" />
    </>
  ));

export const IconAutomation = ({ size = 18 }: IconProps) =>
  wrap(size, <path d="M13 3L4 14h6l-1 7 9-11h-6z" />);

export const IconSyncLog = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </>
  ));

export const IconTenants = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <rect x="4" y="3" width="10" height="18" rx="1.5" />
      <path d="M14 8h6v13h-6" />
      <path d="M7 7h2M7 11h2M7 15h2" />
    </>
  ));

export const IconSearch = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </>
  ));

export const IconBell = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ));

export const IconJourneys = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M8.3 6.6c4 .4 6 1.8 7.2 4.2M8.3 17.4c4-.4 6-1.8 7.2-4.2" />
    </>
  ));

export const IconSegments = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </>
  ));

export const IconShield = ({ size = 18 }: IconProps) =>
  wrap(size, (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ));
