import type { Agent, AgentRelationship, MessageEnvelope, WorkflowDefinition } from "@ade/types";

export const seedAgents: Agent[] = [
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
  },
  {
    id: "agent-worker-test-01",
    name: "Validator Sigma",
    role: "validator",
    parentAgentId: "agent-manager-01",
    state: "executing",
    peers: ["agent-worker-impl-01"],
    context: {
      workspaceId: "ade-dev",
      branch: "feature/agent-graph",
      objective: "Run regression validations"
    },
    budget: { tokenBudget: 50000, costBudgetUsd: 8, wallClockBudgetMs: 1_800_000 },
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    activeStep: "Evaluating policy edge cases",
    statusNote: "2 warnings"
  },
  {
    id: "agent-reviewer-01",
    name: "Review Sentinel",
    role: "reviewer",
    state: "queued",
    parentAgentId: "agent-manager-01",
    peers: [],
    context: {
      workspaceId: "ade-dev",
      branch: "feature/agent-graph",
      objective: "Review output quality"
    },
    budget: { tokenBudget: 35000, costBudgetUsd: 4, wallClockBudgetMs: 900000 },
    createdAt: new Date().toISOString(),
    activeStep: "Waiting for test completion",
    statusNote: "Queued by dependency"
  }
];

export const seedRelationships: AgentRelationship[] = [
  {
    sourceAgentId: "agent-manager-01",
    targetAgentId: "agent-worker-impl-01",
    type: "manager_worker",
    createdAt: new Date().toISOString()
  },
  {
    sourceAgentId: "agent-manager-01",
    targetAgentId: "agent-worker-test-01",
    type: "manager_worker",
    createdAt: new Date().toISOString()
  },
  {
    sourceAgentId: "agent-worker-impl-01",
    targetAgentId: "agent-worker-test-01",
    type: "peer_specialist",
    createdAt: new Date().toISOString()
  },
  {
    sourceAgentId: "agent-manager-01",
    targetAgentId: "agent-reviewer-01",
    type: "manager_worker",
    createdAt: new Date().toISOString()
  }
];

export const seedMessages: MessageEnvelope[] = [
  {
    id: "msg-001",
    from: "human",
    to: ["agent-manager-01"],
    intent: "request",
    scope: "private",
    payload: { text: "Keep velocity high, block only high-risk actions" },
    sentAt: new Date().toISOString()
  },
  {
    id: "msg-002",
    from: "agent-manager-01",
    to: ["agent-worker-impl-01"],
    intent: "delegate",
    scope: "private",
    payload: { text: "Implement dependency routing with audit events" },
    sentAt: new Date().toISOString()
  }
];

export const seedWorkflow: WorkflowDefinition = {
  id: "wf-standard-feature",
  name: "Standard Feature Loop",
  version: "0.1.0",
  stages: [
    {
      id: "plan",
      primitive: "planner",
      displayName: "Planning",
      requiredRole: "manager",
      dependsOnStageIds: []
    },
    {
      id: "implement",
      primitive: "implementer",
      displayName: "Implementation",
      requiredRole: "worker",
      dependsOnStageIds: ["plan"]
    },
    {
      id: "test",
      primitive: "tester",
      displayName: "Validation",
      requiredRole: "validator",
      dependsOnStageIds: ["implement"]
    }
  ],
  retryPolicy: { maxRetries: 2, initialBackoffMs: 500, maxBackoffMs: 5000 },
  timeoutPolicy: { planningTimeoutMs: 60_000, executionTimeoutMs: 600_000, approvalTimeoutMs: 300_000 },
  escalationPolicy: { escalateAfterMs: 120_000, escalateToRole: "manager" },
  optimizationDefault: "balanced"
};
