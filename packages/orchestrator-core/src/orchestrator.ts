import {
  type Agent,
  type AgentState,
  type ApprovalRequest,
  type DomainEvent,
  type MessageEnvelope,
  type StageFailureMode,
  type WorkflowDefinition,
  type WorkflowExecution
} from "@ade/types";
import { ApprovalEngine } from "./approval-engine.js";
import { MessageBus } from "./messaging.js";
import { DependencyGraphScheduler } from "./scheduler.js";
import { executeStage } from "./stage-executors.js";
import { AgentStateMachine } from "./state-machine.js";

interface EventSink {
  append(event: DomainEvent): void;
}

export class OrchestratorService {
  private readonly agents = new Map<string, Agent>();
  private readonly workflows = new Map<string, WorkflowExecution>();
  private readonly workflowDefinitions = new Map<string, WorkflowDefinition>();
  private readonly approvalRequests = new Map<string, ApprovalRequest>();
  private readonly stateMachine = new AgentStateMachine();
  private readonly scheduler = new DependencyGraphScheduler();
  private readonly approvals = new ApprovalEngine();
  readonly messageBus = new MessageBus();

  constructor(private readonly eventSink: EventSink) {}

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.emit("agent.created", agent.id, "agent", { agent });
  }

  transitionAgent(agentId: string, nextState: AgentState, reason: string): void {
    const agent = this.requireAgent(agentId);
    this.stateMachine.assertTransition(agent.state, nextState);
    const previousState = agent.state;
    agent.state = nextState;

    this.emit("agent.state_changed", agent.id, "agent", {
      previousState,
      nextState,
      reason
    });
  }

  sendMessage(message: MessageEnvelope): void {
    const receipts = this.messageBus.publish(message);
    this.emit("agent.message_sent", message.from, "message", { message, receipts });
  }

  evaluateApproval(toolName: string, scope: "single_file" | "workspace" | "repo" | "system"): ApprovalRequest | null {
    const score = this.approvals.evaluateRiskScore(toolName, scope);
    const decision = this.approvals.decide(score);

    if (decision.decision === "auto_approve") {
      return null;
    }

    const request: ApprovalRequest = {
      id: `approval-${crypto.randomUUID()}`,
      agentId: "system",
      action: { toolName, parameters: { scope } },
      riskLevel: decision.riskLevel,
      policyMatch: {
        ruleId: "default.permissive.additive",
        decision: decision.decision === "block" ? "block" : "requires_approval",
        riskScore: decision.riskScore
      },
      status: decision.decision === "block" ? "rejected" : "pending",
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      requiredSigners: decision.decision === "requires_multi_approval" ? ["manager", "security"] : ["manager"]
    };

    this.approvalRequests.set(request.id, request);

    this.emit("approval.requested", request.id, "approval", { request });
    return request;
  }

  resolveApproval(approvalId: string, resolution: "approved" | "rejected", signerId: string): ApprovalRequest {
    const request = this.approvalRequests.get(approvalId);
    if (!request) {
      throw new Error(`Approval request not found: ${approvalId}`);
    }
    if (this.approvals.isResolved(request)) {
      return request;
    }

    request.status = resolution;
    request.resolvedAt = new Date().toISOString();

    this.emit("approval.resolved", request.id, "approval", {
      approvalId,
      status: request.status,
      signerId,
      resolvedAt: request.resolvedAt
    });

    return request;
  }

  listAgents(): Agent[] {
    return [...this.agents.values()];
  }

  listWorkflows(): WorkflowExecution[] {
    return [...this.workflows.values()];
  }

  listApprovals(): ApprovalRequest[] {
    return [...this.approvalRequests.values()];
  }

  listWorkflowDefinitions(): WorkflowDefinition[] {
    return [...this.workflowDefinitions.values()];
  }

  startWorkflow(definition: WorkflowDefinition): WorkflowExecution {
    const execution: WorkflowExecution = {
      id: `exec-${crypto.randomUUID()}`,
      workflowId: definition.id,
      status: "running",
      stageAgentAssignments: this.assignAgentsToStages(definition),
      completedStageIds: [],
      retryCountByStage: {},
      retryReadyAtByStage: {},
      stageFailureModes: {},
      currentStageId: undefined,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      lastTransitionAt: new Date().toISOString()
    };

    this.workflowDefinitions.set(definition.id, definition);
    this.workflows.set(execution.id, execution);

    const readyStages = this.scheduler.getReadyStageIds(definition.stages, new Set<string>());
    execution.currentStageId = readyStages[0];

    this.emit("workflow.stage_advanced", execution.id, "workflow", {
      workflowId: definition.id,
      currentStageId: execution.currentStageId
    });

    return execution;
  }

  tickWorkflow(executionId: string, forceFailCurrentStage = false): WorkflowExecution {
    const execution = this.requireWorkflow(executionId);
    const definition = this.requireWorkflowDefinition(execution.workflowId);
    if (execution.status !== "running") {
      return execution;
    }

    const completedSet = new Set<string>(execution.completedStageIds);
    if (!execution.currentStageId) {
      const readyStages = this.scheduler.getReadyStageIds(definition.stages, completedSet);
      const nextStage = readyStages[0];

      if (!nextStage) {
        execution.status = "completed";
        execution.completedAt = new Date().toISOString();
        execution.lastTransitionAt = execution.completedAt;
        this.emit("workflow.stage_advanced", execution.id, "workflow", {
          workflowId: definition.id,
          result: "completed"
        });
        return execution;
      }

      execution.currentStageId = nextStage;
      execution.lastTransitionAt = new Date().toISOString();
      this.emit("workflow.stage_advanced", execution.id, "workflow", {
        workflowId: definition.id,
        currentStageId: nextStage,
        result: "advanced"
      });
      return execution;
    }

    const stageId = execution.currentStageId;
    const stage = definition.stages.find((candidate) => candidate.id === stageId);
    if (!stage) {
      execution.status = "failed";
      execution.lastTransitionAt = new Date().toISOString();
      this.emit("workflow.stage_advanced", execution.id, "workflow", {
        workflowId: definition.id,
        stageId,
        result: "failed",
        reason: "stage_missing_from_definition"
      });
      return execution;
    }

    const assignedAgentId = execution.stageAgentAssignments[stage.id];
    const assignedAgent = assignedAgentId ? this.agents.get(assignedAgentId) : undefined;

    const retryReadyAt = execution.retryReadyAtByStage[stageId];
    if (retryReadyAt && Date.now() < new Date(retryReadyAt).getTime()) {
      return execution;
    }

    const simulatedFailure = forceFailCurrentStage || this.shouldFailStage(execution, stageId);

    if (simulatedFailure) {
      const attempt = (execution.retryCountByStage[stageId] ?? 0) + 1;
      execution.retryCountByStage[stageId] = attempt;
      execution.lastTransitionAt = new Date().toISOString();

      if (attempt <= definition.retryPolicy.maxRetries) {
        const backoffMs = this.computeBackoffMs(definition, attempt);
        execution.retryReadyAtByStage[stageId] = new Date(Date.now() + backoffMs).toISOString();
        this.emit("workflow.stage_advanced", execution.id, "workflow", {
          workflowId: definition.id,
          stageId,
          result: "retrying",
          attempt,
          nextRetryAt: execution.retryReadyAtByStage[stageId],
          backoffMs
        });
        return execution;
      }

      execution.status = "paused";
      execution.escalationStageId = stageId;
      this.emit("workflow.stage_advanced", execution.id, "workflow", {
        workflowId: definition.id,
        stageId,
        result: "escalated",
        escalateToRole: definition.escalationPolicy.escalateToRole
      });
      return execution;
    }

    const stageResult = executeStage({ stage, execution, assignedAgent });
    const timeoutMs = stage.primitive === "planner" ? definition.timeoutPolicy.planningTimeoutMs : definition.timeoutPolicy.executionTimeoutMs;
    const timedOut = stageResult.wallClockMs > timeoutMs;
    this.emit("tool.executed", execution.id, "workflow", {
      workflowId: definition.id,
      stageId: stage.id,
      stagePrimitive: stage.primitive,
      summary: stageResult.summary,
      assignedAgentId,
      toolName: stageResult.toolName,
      success: stageResult.success && !timedOut,
      tokenCost: stageResult.tokenCost,
      costUsd: stageResult.costUsd,
      wallClockMs: stageResult.wallClockMs
    });

    if (!stageResult.success || timedOut) {
      const attempt = (execution.retryCountByStage[stageId] ?? 0) + 1;
      execution.retryCountByStage[stageId] = attempt;
      execution.lastTransitionAt = new Date().toISOString();

      if (attempt <= definition.retryPolicy.maxRetries) {
        const backoffMs = this.computeBackoffMs(definition, attempt);
        execution.retryReadyAtByStage[stageId] = new Date(Date.now() + backoffMs).toISOString();
        this.emit("workflow.stage_advanced", execution.id, "workflow", {
          workflowId: definition.id,
          stageId,
          result: "retrying",
          attempt,
          reason: timedOut ? "stage_timeout" : stageResult.summary,
          nextRetryAt: execution.retryReadyAtByStage[stageId],
          backoffMs
        });
        return execution;
      }

      execution.status = "paused";
      execution.escalationStageId = stageId;
      this.emit("workflow.stage_advanced", execution.id, "workflow", {
        workflowId: definition.id,
        stageId,
        result: "escalated",
        escalateToRole: definition.escalationPolicy.escalateToRole,
        reason: timedOut ? "stage_timeout" : stageResult.summary
      });
      return execution;
    }

    completedSet.add(stageId);
    execution.completedStageIds = [...completedSet];
    execution.retryCountByStage[stageId] = 0;
    delete execution.retryReadyAtByStage[stageId];

    const readyStages = this.scheduler.getReadyStageIds(definition.stages, completedSet);
    const nextStage = readyStages[0];

    if (!nextStage) {
      execution.status = "completed";
      execution.currentStageId = undefined;
      execution.completedAt = new Date().toISOString();
      execution.lastTransitionAt = execution.completedAt;
      this.emit("workflow.stage_advanced", execution.id, "workflow", {
        workflowId: definition.id,
        completedStageId: stageId,
        result: "completed"
      });
      return execution;
    }

    execution.currentStageId = nextStage;
    execution.lastTransitionAt = new Date().toISOString();
    this.emit("workflow.stage_advanced", execution.id, "workflow", {
      workflowId: definition.id,
      completedStageId: stageId,
      currentStageId: nextStage,
      result: "advanced"
    });

    return execution;
  }

  setStageFailureMode(executionId: string, stageId: string, mode: StageFailureMode): WorkflowExecution {
    const execution = this.requireWorkflow(executionId);
    execution.stageFailureModes[stageId] = mode;
    execution.lastTransitionAt = new Date().toISOString();
    this.emit("workflow.stage_advanced", execution.id, "workflow", {
      workflowId: execution.workflowId,
      stageId,
      result: "failure_mode_updated",
      mode
    });
    return execution;
  }

  tickAllRunningWorkflows(): WorkflowExecution[] {
    const updates: WorkflowExecution[] = [];
    for (const execution of this.workflows.values()) {
      if (execution.status === "running") {
        updates.push(this.tickWorkflow(execution.id));
      }
    }
    return updates;
  }

  private requireAgent(agentId: string): Agent {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent;
  }

  private requireWorkflow(executionId: string): WorkflowExecution {
    const execution = this.workflows.get(executionId);
    if (!execution) {
      throw new Error(`Workflow execution not found: ${executionId}`);
    }
    return execution;
  }

  private requireWorkflowDefinition(workflowId: string): WorkflowDefinition {
    const definition = this.workflowDefinitions.get(workflowId);
    if (!definition) {
      throw new Error(`Workflow definition not found: ${workflowId}`);
    }
    return definition;
  }

  private assignAgentsToStages(definition: WorkflowDefinition): Record<string, string> {
    const assignments: Record<string, string> = {};
    for (const stage of definition.stages) {
      const assigned = [...this.agents.values()].find((agent) => agent.role === stage.requiredRole);
      if (assigned) {
        assignments[stage.id] = assigned.id;
      }
    }
    return assignments;
  }

  private computeBackoffMs(definition: WorkflowDefinition, attempt: number): number {
    const base = definition.retryPolicy.initialBackoffMs;
    const backoff = base * 2 ** Math.max(0, attempt - 1);
    return Math.min(backoff, definition.retryPolicy.maxBackoffMs);
  }

  private shouldFailStage(execution: WorkflowExecution, stageId: string): boolean {
    const mode = execution.stageFailureModes[stageId] ?? "none";
    if (mode === "none") {
      return false;
    }
    if (mode === "always_fail") {
      return true;
    }

    const attempt = execution.retryCountByStage[stageId] ?? 0;
    const hashSeed = `${execution.id}:${stageId}:${attempt}`;
    let hash = 0;
    for (let i = 0; i < hashSeed.length; i += 1) {
      hash = (hash * 31 + hashSeed.charCodeAt(i)) % 997;
    }
    return hash % 2 === 0;
  }

  private emit(
    eventType: DomainEvent["eventType"],
    aggregateId: string,
    aggregateType: DomainEvent["aggregateType"],
    payload: unknown
  ): void {
    const event: DomainEvent = {
      eventId: `event-${crypto.randomUUID()}`,
      eventType,
      aggregateId,
      aggregateType,
      timestamp: new Date().toISOString(),
      version: 1,
      actor: { id: "orchestrator", type: "system" },
      payload,
      metadata: {
        workspaceId: "default",
        tokenCost:
          typeof payload === "object" && payload !== null && "tokenCost" in payload && typeof payload.tokenCost === "number"
            ? payload.tokenCost
            : undefined,
        costUsd:
          typeof payload === "object" && payload !== null && "costUsd" in payload && typeof payload.costUsd === "number"
            ? payload.costUsd
            : undefined,
        wallClockMs:
          typeof payload === "object" && payload !== null && "wallClockMs" in payload && typeof payload.wallClockMs === "number"
            ? payload.wallClockMs
            : undefined
      }
    };
    this.eventSink.append(event);
  }
}
