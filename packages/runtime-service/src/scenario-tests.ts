import assert from "node:assert/strict";
import { InMemoryEventStore } from "@ade/event-store";
import { OrchestratorService } from "@ade/orchestrator-core";
import type { Agent, WorkflowDefinition } from "@ade/types";
import { RuntimeRegistryStore } from "./registry.js";

function makeAgents(): Agent[] {
  return [
    {
      id: "agent-manager-01",
      name: "Manager",
      role: "manager",
      state: "executing",
      peers: [],
      context: { workspaceId: "tests", branch: "main", objective: "Coordinate" },
      budget: { tokenBudget: 10000, costBudgetUsd: 10, wallClockBudgetMs: 60_000 },
      createdAt: new Date().toISOString()
    },
    {
      id: "agent-worker-impl-01",
      name: "Implementer",
      role: "worker",
      state: "executing",
      peers: [],
      context: { workspaceId: "tests", branch: "main", objective: "Implement" },
      budget: { tokenBudget: 10000, costBudgetUsd: 10, wallClockBudgetMs: 60_000 },
      createdAt: new Date().toISOString()
    },
    {
      id: "agent-worker-test-01",
      name: "Tester",
      role: "validator",
      state: "executing",
      peers: [],
      context: { workspaceId: "tests", branch: "main", objective: "Test" },
      budget: { tokenBudget: 10000, costBudgetUsd: 10, wallClockBudgetMs: 60_000 },
      createdAt: new Date().toISOString()
    }
  ];
}

function makeWorkflow(maxRetries = 2, initialBackoffMs = 1, maxBackoffMs = 4): WorkflowDefinition {
  return {
    id: `wf-${crypto.randomUUID()}`,
    name: "Scenario Workflow",
    version: "0.1.0",
    stages: [
      { id: "plan", primitive: "planner", displayName: "Plan", requiredRole: "manager", dependsOnStageIds: [] },
      {
        id: "implement",
        primitive: "implementer",
        displayName: "Implement",
        requiredRole: "worker",
        dependsOnStageIds: ["plan"]
      },
      {
        id: "test",
        primitive: "tester",
        displayName: "Test",
        requiredRole: "validator",
        dependsOnStageIds: ["implement"]
      }
    ],
    retryPolicy: { maxRetries, initialBackoffMs, maxBackoffMs },
    timeoutPolicy: { planningTimeoutMs: 10_000, executionTimeoutMs: 10_000, approvalTimeoutMs: 5_000 },
    escalationPolicy: { escalateAfterMs: 10_000, escalateToRole: "manager" },
    optimizationDefault: "balanced"
  };
}

function makeOrchestrator(): OrchestratorService {
  const store = new InMemoryEventStore();
  const orchestrator = new OrchestratorService({ append: (event) => store.append(event) });
  for (const agent of makeAgents()) {
    orchestrator.registerAgent(agent);
  }
  return orchestrator;
}

function tickUntilDone(orchestrator: OrchestratorService, executionId: string, maxTicks = 20): void {
  for (let i = 0; i < maxTicks; i += 1) {
    const exec = orchestrator.tickWorkflow(executionId);
    if (exec.status === "completed" || exec.status === "failed" || exec.status === "paused") {
      return;
    }
  }
}

function scenarioSuccessLoop(): void {
  const orchestrator = makeOrchestrator();
  const execution = orchestrator.startWorkflow(makeWorkflow());
  tickUntilDone(orchestrator, execution.id);
  const finalState = orchestrator.listWorkflows().find((wf) => wf.id === execution.id);
  assert.ok(finalState, "workflow should exist");
  assert.equal(finalState.status, "completed");
  assert.deepEqual(finalState.completedStageIds.sort(), ["implement", "plan", "test"].sort());
}

function scenarioRetryThenSuccess(): void {
  const orchestrator = makeOrchestrator();
  const execution = orchestrator.startWorkflow(makeWorkflow(2, 0, 0));

  // Fail implement stage once, then recover.
  orchestrator.setStageFailureMode(execution.id, "implement", "always_fail");

  let sawRetry = false;
  for (let i = 0; i < 20; i += 1) {
    const state = orchestrator.tickWorkflow(execution.id);
    if ((state.retryCountByStage.implement ?? 0) > 0) {
      sawRetry = true;
      orchestrator.setStageFailureMode(execution.id, "implement", "none");
    }
    if (state.status === "completed") {
      break;
    }
  }

  const finalState = orchestrator.listWorkflows().find((wf) => wf.id === execution.id);
  assert.ok(finalState, "workflow should exist");
  assert.equal(sawRetry, true, "should have retried at least once");
  assert.equal(finalState.status, "completed");
}

function scenarioRetryExhaustedEscalation(): void {
  const orchestrator = makeOrchestrator();
  const execution = orchestrator.startWorkflow(makeWorkflow(1, 0, 0));
  orchestrator.setStageFailureMode(execution.id, "implement", "always_fail");

  for (let i = 0; i < 20; i += 1) {
    const state = orchestrator.tickWorkflow(execution.id);
    if (state.status === "paused") {
      break;
    }
  }

  const finalState = orchestrator.listWorkflows().find((wf) => wf.id === execution.id);
  assert.ok(finalState, "workflow should exist");
  assert.equal(finalState.status, "paused");
  assert.equal(finalState.escalationStageId, "implement");
}

function scenarioApprovalBlockByPolicy(): void {
  const registry = new RuntimeRegistryStore();
  registry.setToolEnabled("filesystem.write", false);
  const result = registry.assertToolAllowed("filesystem.write", "workspace");
  assert.equal(result.ok, false);
  assert.ok(result.error?.includes("disabled"));
}

function run(): void {
  scenarioSuccessLoop();
  scenarioRetryThenSuccess();
  scenarioRetryExhaustedEscalation();
  scenarioApprovalBlockByPolicy();
  // eslint-disable-next-line no-console
  console.log("Scenario tests passed: success, retry recovery, escalation, approval policy block");
}

run();
