import type { ReactNode } from "react";

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ok"
      ? "badge badge-ok"
      : status === "error"
        ? "badge badge-error"
        : "badge";
  return <span className={cls}>{status}</span>;
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">⚠ {message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return <div className="muted" style={{ padding: "1rem" }}>Đang tải…</div>;
}
