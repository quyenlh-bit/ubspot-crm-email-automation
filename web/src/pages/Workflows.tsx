import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { useTenant } from "../TenantContext";
import { useAsync } from "../useAsync";
import {
  createJourney,
  getTemplates,
  getJourneyRuns,
  getWorkflowTemplates,
  listJourneys,
  listSegments,
  runJourney,
  setJourneyStatus,
  updateJourney,
} from "../api";
import { EmptyState, ErrorBox, StatusBadge } from "../components/ui";
import type { Journey, MessageChannel, WorkflowNode, WorkflowNodeType } from "../types";

const NODE_META: Record<WorkflowNodeType | "trigger", { label: string; emoji: string }> = {
  trigger: { label: "Trigger", emoji: "⚡" },
  send: { label: "Send", emoji: "✉️" },
  wait: { label: "Wait", emoji: "⏱️" },
  condition: { label: "Condition", emoji: "◇" },
  ab_split: { label: "A/B split", emoji: "⤨" },
  update_contact: { label: "Update", emoji: "✎" },
  webhook: { label: "Webhook", emoji: "🔗" },
  exit: { label: "Exit", emoji: "⏹" },
};

function nodeSummary(d: WorkflowNode): string {
  switch (d.type) {
    case "send": return `${d.templateId || "?"} · ${d.channel || "email"}`;
    case "wait": return `${d.waitHours ?? 0}h`;
    case "condition": return `${d.condition?.kind ?? "?"}${d.condition?.value ? `=${d.condition.value}` : ""}`;
    case "ab_split": return `${d.splitPercent ?? 50}% A / ${100 - (d.splitPercent ?? 50)}% B`;
    case "update_contact": return `lifecycle → ${d.setLifecycleStage ?? "?"}`;
    case "webhook": return d.webhookUrl || "—";
    default: return "";
  }
}

function CanvasNode({ data, selected }: NodeProps<WorkflowNode & { count?: number }>) {
  const meta = NODE_META[data.type];
  return (
    <div className={`wf-node wf-${data.type}${selected ? " sel" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="wf-node-title">{meta.emoji} {meta.label}</div>
      <div className="wf-node-sub">{nodeSummary(data)}</div>
      {typeof data.count === "number" && <span className="wf-count">{data.count}</span>}
      {data.type === "condition" ? (
        <>
          <Handle id="yes" type="source" position={Position.Bottom} style={{ left: "28%" }} />
          <Handle id="no" type="source" position={Position.Bottom} style={{ left: "72%" }} />
        </>
      ) : data.type === "ab_split" ? (
        <>
          <Handle id="a" type="source" position={Position.Bottom} style={{ left: "28%" }} />
          <Handle id="b" type="source" position={Position.Bottom} style={{ left: "72%" }} />
        </>
      ) : data.type !== "exit" ? (
        <Handle type="source" position={Position.Bottom} />
      ) : null}
    </div>
  );
}

function TriggerNode({ data }: NodeProps<{ label?: string }>) {
  return (
    <div className="wf-node wf-trigger">
      <div className="wf-node-title">⚡ Trigger</div>
      <div className="wf-node-sub">{data.label || "segment entry"}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const TRIGGER_POS = { x: 240, y: -90 };
const newId = () => `n_${crypto.randomUUID().slice(0, 8)}`;

export default function Workflows() {
  const { selectedId } = useTenant();
  const journeys = useAsync(() => listJourneys(selectedId!), [selectedId]);
  const segments = useAsync(() => listSegments(selectedId!), [selectedId]);
  const templates = useAsync(() => getTemplates(), []);
  const wfTemplates = useAsync(() => getWorkflowTemplates(), []);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [status, setStatus] = useState<Journey["status"]>("draft");
  const [goalType, setGoalType] = useState<"" | "conversion" | "voucher_redeemed">("");
  const [selNode, setSelNode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<{ active: number; waiting: number; completed: number; converted: number } | null>(null);

  const refreshRuns = useCallback(async (id: string | null) => {
    if (!id) { setRuns(null); return; }
    try { setRuns(await getJourneyRuns(selectedId!, id)); } catch { setRuns(null); }
  }, [selectedId]);

  const nodeTypes = useMemo(() => ({ wf: CanvasNode, trigger: TriggerNode }), []);

  const loadGraph = useCallback(
    (nodes: WorkflowNode[], edges: Journey["edges"], opts: { name: string; segmentId: string; status: Journey["status"]; goal?: "" | "conversion" | "voucher_redeemed" }) => {
      setRfNodes([
        { id: "trigger", type: "trigger", position: TRIGGER_POS, data: { label: opts.segmentId ? "segment entry" : "segment entry" } },
        ...nodes.map((n) => ({ id: n.id, type: "wf", position: n.position, data: { ...n } as WorkflowNode })),
      ]);
      setRfEdges(
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.branch ?? undefined,
          label: e.branch ?? undefined,
          animated: true,
        })),
      );
      setName(opts.name);
      setSegmentId(opts.segmentId);
      setStatus(opts.status);
      setGoalType(opts.goal ?? "");
      setSelNode(null);
    },
    [setRfNodes, setRfEdges],
  );

  const newWorkflow = useCallback(() => {
    setCurrentId(null);
    loadGraph([], [], { name: "Workflow mới", segmentId: "", status: "draft" });
  }, [loadGraph]);

  useEffect(() => { newWorkflow(); }, [newWorkflow, selectedId]);

  function openJourney(j: Journey) {
    setCurrentId(j.id);
    loadGraph(j.nodes, j.edges, { name: j.name, segmentId: j.trigger?.segmentId ?? j.segmentId ?? "", status: j.status, goal: (j.goal?.type === "conversion" || j.goal?.type === "voucher_redeemed") ? j.goal.type : "" });
    void refreshRuns(j.id);
  }

  function loadTemplate(id: string) {
    const t = wfTemplates.data?.find((x) => x.id === id);
    if (!t) return;
    setCurrentId(null);
    loadGraph(t.nodes, t.edges, { name: t.name, segmentId: "", status: "draft" });
  }

  const onConnect = useCallback((c: Connection) => setRfEdges((eds) => addEdge({ ...c, animated: true, label: c.sourceHandle ?? undefined }, eds)), [setRfEdges]);

  function addNode(type: WorkflowNodeType) {
    const id = newId();
    const base: WorkflowNode = { id, type, position: { x: 250, y: 120 + rfNodes.length * 30 } };
    if (type === "send") { base.channel = "email"; base.templateId = "welcome"; }
    if (type === "wait") base.waitHours = 24;
    if (type === "condition") base.condition = { kind: "opened" };
    if (type === "ab_split") base.splitPercent = 50;
    if (type === "update_contact") base.setLifecycleStage = "customer";
    setRfNodes((nds) => [...nds, { id, type: "wf", position: base.position, data: base }]);
  }

  const patchNode = (patch: Partial<WorkflowNode>) =>
    setRfNodes((nds) => nds.map((n) => (n.id === selNode ? { ...n, data: { ...n.data, ...patch } } : n)));

  function serialize(): { nodes: WorkflowNode[]; edges: Journey["edges"] } {
    const nodes = rfNodes
      .filter((n) => n.id !== "trigger")
      .map((n) => ({ ...(n.data as WorkflowNode), id: n.id, position: n.position }));
    const edges = rfEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      branch: (e.sourceHandle as "yes" | "no" | undefined) ?? null,
    }));
    return { nodes, edges };
  }

  async function save() {
    setError(null); setMsg(null);
    try {
      const { nodes, edges } = serialize();
      const input = { name, segmentId: segmentId || null, trigger: { type: "segment_entry" as const, segmentId: segmentId || null }, nodes, edges, goal: goalType ? { type: goalType } : null };
      const saved = currentId ? await updateJourney(selectedId!, currentId, input) : await createJourney(selectedId!, input);
      setCurrentId(saved.id);
      setMsg("Đã lưu workflow.");
      journeys.reload();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function run() {
    if (!currentId) { setError("Lưu workflow trước khi chạy."); return; }
    setError(null); setMsg(null);
    try {
      const j = await runJourney(selectedId!, currentId);
      const counts = new Map((j.lastRunSummary?.steps ?? []).map((s) => [s.nodeId, s.count]));
      setRfNodes((nds) => nds.map((n) => (n.id === "trigger" ? n : { ...n, data: { ...n.data, count: counts.get(n.id) ?? 0 } })));
      setMsg(`Đã chạy (mô phỏng): ${j.lastRunSummary?.enrolled ?? 0} người vào workflow.`);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function toggleStatus() {
    if (!currentId) { setError("Lưu workflow trước."); return; }
    const next = status === "active" ? "paused" : "active";
    try {
      const j = await setJourneyStatus(selectedId!, currentId, next);
      setStatus(j.status);
      setMsg(next === "active" ? "Đã Activate — worker sẽ tự enrol member mới & chạy thật theo thời gian." : "Đã Pause.");
      journeys.reload();
      void refreshRuns(currentId);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
  }

  if (!selectedId) return <EmptyState>Chưa chọn tenant. Chọn tenant ở góc trên bên phải.</EmptyState>;

  const selected = rfNodes.find((n) => n.id === selNode);
  const selData = selected?.data as WorkflowNode | undefined;

  return (
    <>
      <div className="page-head">
        <h1>Workflows</h1>
        <p className="muted">Builder kéo-thả: trigger → node (send/wait/condition/A-B/update/webhook/exit) → nhánh. <b>Xem trước</b> = mô phỏng (không gửi). <b>Activate</b> = chạy thật: worker tự enrol member mới, <code>wait</code> dừng đúng thời gian rồi tiếp tục.</p>
      </div>

      <div className="wf-toolbar">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên workflow" style={{ minWidth: 180 }} />
        <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} title="Trigger: segment enrol">
          <option value="">Trigger: tất cả contact</option>
          {(segments.data ?? []).map((s) => <option key={s.id} value={s.id}>Vào segment: {s.name} ({s.memberCount ?? "?"})</option>)}
        </select>
        <select value={goalType} onChange={(e) => setGoalType(e.target.value as typeof goalType)} title="Goal: member đạt sẽ exit 'converted'">
          <option value="">Goal: không</option>
          <option value="conversion">Goal: có conversion</option>
          <option value="voucher_redeemed">Goal: redeem voucher</option>
        </select>
        <StatusBadge status={status} />
        {runs && (
          <span className="muted small" title="runs: active / waiting / completed / converted">
            ▶ {runs.active} · ⏸ {runs.waiting} · ✓ {runs.completed} · ★ {runs.converted}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <select value="" onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); }} title="Nạp template">
          <option value="">+ Từ template…</option>
          {(wfTemplates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn ghost" onClick={newWorkflow}>Mới</button>
        <button className="btn ghost" onClick={save}>Lưu</button>
        <button className="btn ghost" onClick={run} title="Mô phỏng — đếm số người qua từng node, KHÔNG gửi thật">Xem trước</button>
        <button className="btn" onClick={toggleStatus} title="Activate = worker tự enrol & chạy thật theo thời gian">{status === "active" ? "Pause" : "Activate"}</button>
      </div>

      {error && <ErrorBox message={error} />}
      {msg && <div className="ok-box">✓ {msg}</div>}

      <div className="wf-layout">
        <aside className="wf-side">
          <div className="wf-side-title">Thêm node</div>
          {(["send", "wait", "condition", "ab_split", "update_contact", "webhook", "exit"] as WorkflowNodeType[]).map((t) => (
            <button key={t} className="btn ghost wf-add" onClick={() => addNode(t)}>{NODE_META[t].emoji} {NODE_META[t].label}</button>
          ))}
          <div className="wf-side-title" style={{ marginTop: 16 }}>Workflows</div>
          {(journeys.data ?? []).map((j) => (
            <button key={j.id} className={`btn ghost wf-add${currentId === j.id ? " sel" : ""}`} onClick={() => openJourney(j)}>{j.name}</button>
          ))}

          {selData && (
            <div className="wf-config">
              <div className="wf-side-title">Cấu hình: {NODE_META[selData.type].label}</div>
              {selData.type === "send" && (
                <>
                  <label className="wf-field">Kênh
                    <select value={selData.channel ?? "email"} onChange={(e) => patchNode({ channel: e.target.value as MessageChannel })}>
                      {["email", "sms", "zalo"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="wf-field">Template
                    <select value={selData.templateId ?? ""} onChange={(e) => patchNode({ templateId: e.target.value })}>
                      <option value="">(none)</option>
                      {(templates.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="wf-field">Voucher<input value={selData.voucherCode ?? ""} onChange={(e) => patchNode({ voucherCode: e.target.value })} /></label>
                </>
              )}
              {selData.type === "wait" && (
                <label className="wf-field">Số giờ<input type="number" min={1} value={selData.waitHours ?? 24} onChange={(e) => patchNode({ waitHours: Number(e.target.value) })} /></label>
              )}
              {selData.type === "condition" && (
                <>
                  <label className="wf-field">Điều kiện
                    <select value={selData.condition?.kind ?? "opened"} onChange={(e) => patchNode({ condition: { kind: e.target.value as "lifecycle_is" | "opened" | "clicked" | "voucher_redeemed", value: selData.condition?.value } })}>
                      <option value="opened">đã mở email</option>
                      <option value="clicked">đã click</option>
                      <option value="voucher_redeemed">đã redeem voucher</option>
                      <option value="lifecycle_is">lifecycle =</option>
                    </select>
                  </label>
                  {selData.condition?.kind === "lifecycle_is" && (
                    <label className="wf-field">Giá trị<input value={selData.condition?.value ?? ""} onChange={(e) => patchNode({ condition: { kind: "lifecycle_is", value: e.target.value } })} placeholder="customer" /></label>
                  )}
                  <p className="muted small">Nhánh: chấm trái = Yes, chấm phải = No.</p>
                </>
              )}
              {selData.type === "ab_split" && (
                <>
                  <label className="wf-field">% vào nhánh A
                    <input type="number" min={0} max={100} value={selData.splitPercent ?? 50} onChange={(e) => patchNode({ splitPercent: Number(e.target.value) })} />
                  </label>
                  <p className="muted small">Nhánh: chấm trái = A, chấm phải = B (chia theo email, ổn định).</p>
                </>
              )}
              {selData.type === "update_contact" && (
                <label className="wf-field">Lifecycle mới<input value={selData.setLifecycleStage ?? ""} onChange={(e) => patchNode({ setLifecycleStage: e.target.value })} placeholder="customer" /></label>
              )}
              {selData.type === "webhook" && (
                <label className="wf-field">Webhook URL<input value={selData.webhookUrl ?? ""} onChange={(e) => patchNode({ webhookUrl: e.target.value })} placeholder="https://…" /></label>
              )}
            </div>
          )}
        </aside>

        <div className="wf-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelNode(n.id === "trigger" ? null : n.id)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </>
  );
}
