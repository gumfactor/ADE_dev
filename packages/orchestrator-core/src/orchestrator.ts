import {
  type Agent,
  type AgentState,
  type ApprovalRequest,
  type DomainEvent,
  type MessageEnvelope,
  type WorkflowDefinition,
  type WorkflowExecution
} from "@ade/types";
import { ApprovalEngine } from "./approval-engine.js";
import { MessageBus } from "./messaging.js";
import { DependencyGraphScheduler } from "./scheduler.js";
import { AgentStateMachine } from "./state-machine.js";

interface EventSink {
  append(event: DomainEvent): void;
}

export class OrchestratorService {
  private readonly agents = new Map<string, Agent>();
  private readonly workflows = new Map<string, WorkflowExecution>();
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

  startWorkflow(definition: WorkflowDefinition): WorkflowExecution {
    const execution: WorkflowExecution = {
      id: `exec-${crypto.randomUUID()}`,
      workflowId: definition.id,
      status: "running",
      stageAgentAssignments: {},
      currentStageId: undefined,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    };

    this.workflows.set(execution.id, execution);

    const readyStages = this.scheduler.getReadyStageIds(definition.stages, new Set<string>());
    execution.currentStageId = readyStages[0];

    this.emit("workflow.stage_advanced", execution.id, "workflow", {
      workflowId: definition.id,
      currentStageId: execution.currentStageId
    });

    return execution;
  }

  private requireAgent(agentId: string): Agent {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    return agent;
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
      metadata: { workspaceId: "default" }
    };
    this.eventSink.append(event);
  }
}
