import type { Agent, WorkflowExecution, WorkflowStage } from "@ade/types";

export interface StageExecutionContext {
  stage: WorkflowStage;
  execution: WorkflowExecution;
  assignedAgent?: Agent;
}

export interface StageExecutionResult {
  success: boolean;
  summary: string;
  toolName: string;
  tokenCost: number;
  costUsd: number;
  wallClockMs: number;
}

type StageExecutor = (ctx: StageExecutionContext) => StageExecutionResult;

function baseResult(ctx: StageExecutionContext, summary: string, toolName: string): StageExecutionResult {
  const roleFactor = ctx.assignedAgent?.role === "manager" ? 1.2 : 1;
  return {
    success: true,
    summary,
    toolName,
    tokenCost: Math.round((80 + summary.length) * roleFactor),
    costUsd: Number((0.0025 * roleFactor).toFixed(4)),
    wallClockMs: 300 + summary.length * 12
  };
}

const plannerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Generated execution plan for stage ${ctx.stage.displayName}`, "planner.generate_plan");

const implementerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Applied implementation changes for ${ctx.stage.displayName}`, "filesystem.write");

const reviewerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Reviewed changes and produced feedback for ${ctx.stage.displayName}`, "review.analyze");

const testerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Executed test suite for ${ctx.stage.displayName}`, "terminal.run_tests");

const validatorExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Validated quality gates for ${ctx.stage.displayName}`, "validator.run");

const scannerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Security scanning completed for ${ctx.stage.displayName}`, "security.scan");

const deployerExecutor: StageExecutor = (ctx) =>
  baseResult(ctx, `Prepared deployment bundle for ${ctx.stage.displayName}`, "deploy.prepare");

const EXECUTORS: Record<WorkflowStage["primitive"], StageExecutor> = {
  planner: plannerExecutor,
  implementer: implementerExecutor,
  reviewer: reviewerExecutor,
  tester: testerExecutor,
  validator: validatorExecutor,
  security_scanner: scannerExecutor,
  deployer: deployerExecutor
};

export function executeStage(ctx: StageExecutionContext): StageExecutionResult {
  return EXECUTORS[ctx.stage.primitive](ctx);
}
