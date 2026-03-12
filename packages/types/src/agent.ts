export type AgentRole =
  | "manager"
  | "worker"
  | "reviewer"
  | "validator"
  | "security_scanner"
  | "deployer"
  | "human";

export type AgentState =
  | "queued"
  | "planning"
  | "executing"
  | "waiting_approval"
  | "waiting_input"
  | "blocked"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export type OptimizationMode = "balanced" | "fastest" | "safest" | "cheapest";

export type RelationshipType =
  | "manager_worker"
  | "peer_specialist"
  | "reviewer_supervised"
  | "delegated_authority";

export interface AgentBudget {
  tokenBudget: number;
  costBudgetUsd: number;
  wallClockBudgetMs: number;
}

export interface AgentContext {
  workspaceId: string;
  branch: string;
  objective: string;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  state: AgentState;
  parentAgentId?: string;
  peers: string[];
  context: AgentContext;
  budget: AgentBudget;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  activeStep?: string;
  statusNote?: string;
}

export interface AgentRelationship {
  sourceAgentId: string;
  targetAgentId: string;
  type: RelationshipType;
  createdAt: string;
  revokedAt?: string;
}

export interface AgentStateTransition {
  from: AgentState;
  to: AgentState;
  reason: string;
  occurredAt: string;
}
