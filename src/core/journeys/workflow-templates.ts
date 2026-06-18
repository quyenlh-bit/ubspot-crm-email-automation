import type { WorkflowEdge, WorkflowNode, WorkflowTrigger } from "../domain.js";

/** Pre-built workflow recipes an operator can clone into the canvas and tweak. */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "welcome-series",
    name: "Welcome series",
    description: "Chào mừng lead mới: email welcome → chờ 1 ngày → ưu đãi qua Zalo.",
    trigger: { type: "segment_entry" },
    nodes: [
      { id: "n1", type: "send", position: { x: 250, y: 40 }, channel: "email", templateId: "welcome" },
      { id: "n2", type: "wait", position: { x: 250, y: 170 }, waitHours: 24 },
      { id: "n3", type: "send", position: { x: 250, y: 300 }, channel: "zalo", templateId: "promo" },
      { id: "n4", type: "exit", position: { x: 250, y: 430 } },
    ],
    edges: [
      { id: "e0", source: "trigger", target: "n1" },
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
    ],
  },
  {
    id: "winback",
    name: "Win-back",
    description: "Gửi email → chờ 3 ngày → nếu đã mở thì kết thúc, chưa mở thì gửi nhắc lại.",
    trigger: { type: "segment_entry" },
    nodes: [
      { id: "n1", type: "send", position: { x: 250, y: 40 }, channel: "email", templateId: "newsletter" },
      { id: "n2", type: "wait", position: { x: 250, y: 170 }, waitHours: 72 },
      { id: "n3", type: "condition", position: { x: 250, y: 300 }, condition: { kind: "opened" } },
      { id: "n4", type: "exit", position: { x: 80, y: 430 } },
      { id: "n5", type: "send", position: { x: 430, y: 430 }, channel: "email", templateId: "promo" },
      { id: "n6", type: "exit", position: { x: 430, y: 560 } },
    ],
    edges: [
      { id: "e0", source: "trigger", target: "n1" },
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4", branch: "yes" },
      { id: "e4", source: "n3", target: "n5", branch: "no" },
      { id: "e5", source: "n5", target: "n6" },
    ],
  },
];
