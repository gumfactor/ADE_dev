import type { AgentRole, OptimizationMode } from "./agent.js";

export type StagePrimitive =
  | "planner"
  | "implementer"
  | "reviewer"
  | "tester"
  | "validator"
  | "security_scanner"
  | "deployer";

export interface RetryPolicy {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
}

export interface TimeoutPolicy {
  planningTimeoutMs: number;
  executionTimeoutMs: number;
  approvalTimeoutMs: number;
}

export interface EscalationPolicy {
  escalateAfterMs: number;
  escalateToRole: AgentRole;
}

export interface WorkflowStage {
  id: string;
  primitive: StagePrimitive;
  displayName: string;
  requiredRole: AgentRole;
  dependsOnStageIds: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  stages: WorkflowStage[];
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  escalationPolicy: EscalationPolicy;
  optimizationDefault: OptimizationMode;
}

export type WorkflowExecutionStatus = "running" | "paused" | "completed" | "failed";

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  currentStageId?: string;
  stageAgentAssignments: Record<string, string>;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
