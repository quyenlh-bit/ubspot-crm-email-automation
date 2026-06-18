/** Lightweight, dependency-free SVG/CSS charts for the dashboard. */

/** Decorative trend sparkline (no numeric claims — purely visual). */
export function Sparkline({
  color = "#6d5ef0",
  trend = "up",
}: {
  color?: string;
  trend?: "up" | "down" | "flat";
}) {
  const series =
    trend === "down"
      ? [4, 5, 5, 7, 6, 8, 9, 10]
      : trend === "flat"
        ? [6, 5, 6, 6, 5, 6, 6, 5]
        : [10, 8, 9, 6, 7, 4, 5, 2];
  const pts = series
    .map((y, i) => `${(i / (series.length - 1)) * 60},${y * 1.6 + 2}`)
    .join(" ");
  return (
    <svg width="66" height="24" viewBox="0 0 60 20" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface BarDatum {
  label: string;
  value: number;
}

/** Vertical bar chart (CSS) with purple gradient + hatch, like the reference funnel. */
export function BarChart({ data }: { data: BarDatum[] }) {
  const top = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-col" key={d.label}>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${(d.value / top) * 100}%` }}>
              <span className="bar-val">{d.value}</span>
            </div>
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

/** Donut chart with a centered total + legend. */
export function Donut({ data, centerLabel }: { data: DonutDatum[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width="150" height="150">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#eef0f5" strokeWidth="18" />
          {total > 0 &&
            data
              .filter((d) => d.value > 0)
              .map((d) => {
                const len = (d.value / total) * c;
                const seg = (
                  <circle
                    key={d.label}
                    cx="70"
                    cy="70"
                    r={r}
                    fill="none"
                    stroke={d.color}
                    strokeWidth="18"
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += len;
                return seg;
              })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-sub">{centerLabel ?? "tổng"}</text>
      </svg>
      <ul className="legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="legend-dot" style={{ background: d.color }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-val">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
