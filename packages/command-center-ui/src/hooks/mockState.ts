import type { Agent, AgentRelationship, ApprovalRequest, MessageEnvelope } from "@ade/types";

export const mockAgents: Agent[] = [
  {
    id: "agent-manager-01",
    name: "Mission Manager",
    role: "manager",
    state: "executing",
    peers: ["agent-reviewer-01"],
    context: {
      workspaceId: "ade-dev",
      branch: "main",
      objective: "Coordinate feature workflow"
    },
    budget: { tokenBudget: 180000, costBudgetUsd: 32, wallClockBudgetMs: 3_600_000 },
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    activeStep: "Routing implementation tasks to workers",
    statusNote: "Balanced mode"
  },
  {
    id: "agent-worker-impl-01",
    name: "Implementer Alpha",
    role: "worker",
    state: "waiting_approval",
    parentAgentId: "agent-manager-01",
    peers: ["agent-worker-test-01"],
    context: {
      workspaceId: "ade-dev",
      branch: "feature/agent-graph",
      objective: "Build DAG route resolver"
    },
    budget: { tokenBudget: 80000, costBudgetUsd: 14, wallClockBudgetMs: 2_700_000 },
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    activeStep: "Requesting approval for repository-wide write",
    statusNote: "Needs manager sign-off"
  }
];

export const mockRelationships: AgentRelationship[] = [
  {
    sourceAgentId: "agent-manager-01",
    targetAgentId: "agent-worker-impl-01",
    type: "manager_worker",
    createdAt: new Date().toISOString()
  }
];

export const mockApprovals: ApprovalRequest[] = [
  {
    id: "approval-001",
    agentId: "agent-worker-impl-01",
    action: {
      toolName: "filesystem.write",
      parameters: { scope: "repo", files: 12 }
    },
    riskLevel: "high",
    policyMatch: {
      ruleId: "default.permissive.additive",
      decision: "requires_approval",
      riskScore: 27
    },
    status: "pending",
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    requiredSigners: ["manager"]
  }
];

export const mockChats: Record<string, MessageEnvelope[]> = {
  "agent-manager-01": [
    {
      id: "msg-001",
      from: "human",
      to: ["agent-manager-01"],
      intent: "request",
      scope: "private",
      payload: { text: "Keep velocity high, block only high-risk actions" },
      sentAt: new Date().toISOString()
    }
  ]
};
