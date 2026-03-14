import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { InMemoryEventStore } from "@ade/event-store";
import { OrchestratorService } from "@ade/orchestrator-core";
import type { DomainEvent, MessageEnvelope, StageFailureMode, WorkflowCommandType } from "@ade/types";
import { RuntimeProjectionStore } from "./projections.js";
import { RuntimeRegistryStore } from "./registry.js";
import { seedAgents, seedMessages, seedRelationships, seedWorkflow } from "./seed.js";

const HOST = process.env.ADE_RUNTIME_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ADE_RUNTIME_PORT ?? 8787);
const WORKFLOW_TICK_MS = Number(process.env.ADE_WORKFLOW_TICK_MS ?? 2500);
const WORKSPACE_ROOT = resolve(process.env.ADE_WORKSPACE_ROOT ?? "/workspaces/ADE_dev");

const eventStore = new InMemoryEventStore();
const projections = new RuntimeProjectionStore();
const registry = new RuntimeRegistryStore();

const sockets = new Set<import("ws").WebSocket>();

function refreshProjections(orchestrator: OrchestratorService): void {
  projections.updateAgents(orchestrator.listAgents());
  projections.updateWorkflows(orchestrator.listWorkflows());
  projections.updateWorkflowDefinitions(orchestrator.listWorkflowDefinitions());
  projections.updateApprovals(orchestrator.listApprovals());
}

function broadcast(orchestrator: OrchestratorService, event: DomainEvent): void {
  refreshProjections(orchestrator);
  const snapshot = projections.snapshot(eventStore.query({ limit: 500 }));
  const metrics = projections.metrics(snapshot.events);
  const payload = JSON.stringify({ type: "event", event, snapshot, metrics });

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

const orchestrator = new OrchestratorService({
  append(event) {
    eventStore.append(event);
    broadcast(orchestrator, event);
  }
});

for (const agent of seedAgents) {
  orchestrator.registerAgent(agent);
}

projections.updateRelationships(seedRelationships);

for (const message of seedMessages) {
  projections.appendChatMessage(message as MessageEnvelope);
  orchestrator.sendMessage(message);
}

orchestrator.startWorkflow(seedWorkflow);
orchestrator.evaluateApproval("filesystem.write", "repo");
refreshProjections(orchestrator);

setInterval(() => {
  orchestrator.tickAllRunningWorkflows();
}, WORKFLOW_TICK_MS);

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveWorkspacePath(inputPath: string): string {
  const sanitized = inputPath.trim().replace(/^\/+/, "");
  const target = resolve(join(WORKSPACE_ROOT, normalize(sanitized)));
  if (!target.startsWith(WORKSPACE_ROOT)) {
    throw new Error("Path escapes workspace root");
  }
  return target;
}

interface WorkspaceNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: WorkspaceNode[];
}

function pickWorkflowDefinition(workflowId?: string) {
  if (!workflowId) {
    return orchestrator.listWorkflowDefinitions()[0] ?? seedWorkflow;
  }
  return orchestrator.listWorkflowDefinitions().find((definition) => definition.id === workflowId);
}

function isWorkflowCommandType(value: string): value is WorkflowCommandType {
  return [
    "workflow.start",
    "workflow.pause",
    "workflow.resume",
    "workflow.cancel",
    "workflow.tick",
    "workflow.set_failure_mode",
    "workflow.update_assignment"
  ].includes(value);
}

async function buildTree(targetPath: string, relativePath = "", depth = 0): Promise<WorkspaceNode[]> {
  if (depth > 3) {
    return [];
  }

  const entries = await readdir(targetPath, { withFileTypes: true });
  const sorted = entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

  const nodes: WorkspaceNode[] = [];

  for (const entry of sorted) {
    const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        kind: "directory",
        children: await buildTree(join(targetPath, entry.name), entryRelativePath, depth + 1)
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        kind: "file"
      });
    }
  }

  return nodes;
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && url.pathname === "/api/snapshot") {
    sendJson(res, 200, projections.snapshot(eventStore.query({ limit: 500 })));
    return;
  }

  if (method === "GET" && url.pathname === "/api/files/tree") {
    const requestedPath = url.searchParams.get("path") ?? "";
    try {
      const target = resolveWorkspacePath(requestedPath);
      const targetStat = await stat(target);
      if (!targetStat.isDirectory()) {
        sendJson(res, 400, { error: "path must be a directory" });
        return;
      }
      const tree = await buildTree(target, requestedPath.replace(/^\/+/, ""));
      sendJson(res, 200, { root: requestedPath || ".", tree });
      return;
    } catch (error) {
      sendJson(res, 400, { error: (error as Error).message });
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api/files/read") {
    const requestedPath = url.searchParams.get("path");
    if (!requestedPath) {
      sendJson(res, 400, { error: "path query parameter is required" });
      return;
    }
    try {
      const target = resolveWorkspacePath(requestedPath);
      const targetStat = await stat(target);
      if (!targetStat.isFile()) {
        sendJson(res, 400, { error: "path must be a file" });
        return;
      }
      const content = await readFile(target, "utf8");
      sendJson(res, 200, { path: requestedPath, content });
      return;
    } catch (error) {
      sendJson(res, 400, { error: (error as Error).message });
      return;
    }
  }

  if (method === "POST" && url.pathname === "/api/files/write") {
    const body = (await readBody(req)) as { path?: string; content?: string };
    if (!body.path || typeof body.content !== "string") {
      sendJson(res, 400, { error: "path and content are required" });
      return;
    }
    try {
      const target = resolveWorkspacePath(body.path);
      await writeFile(target, body.content, "utf8");
      sendJson(res, 200, { ok: true, path: body.path });
      return;
    } catch (error) {
      sendJson(res, 400, { error: (error as Error).message });
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api/metrics") {
    const snapshot = projections.snapshot(eventStore.query({ limit: 500 }));
    sendJson(res, 200, projections.metrics(snapshot.events));
    return;
  }

  if (method === "POST" && url.pathname === "/api/commands") {
    const body = (await readBody(req)) as {
      commandId?: string;
      type?: string;
      actorId?: string;
      payload?: Record<string, unknown>;
    };

    if (!body.type || !isWorkflowCommandType(body.type)) {
      sendJson(res, 400, { error: "Unsupported command type" });
      return;
    }

    const commandId = body.commandId ?? `cmd-${crypto.randomUUID()}`;
    const actorId = body.actorId ?? "operator";
    const issuedAt = new Date().toISOString();
    const payload = body.payload ?? {};

    orchestrator.recordCommandAccepted({
      commandId,
      commandType: body.type,
      actorId,
      acceptedAt: issuedAt
    });

    try {
      if (body.type === "workflow.start") {
        const definition = pickWorkflowDefinition(typeof payload.workflowId === "string" ? payload.workflowId : undefined);
        if (!definition) {
          throw new Error(`Workflow definition not found: ${String(payload.workflowId ?? "<empty>")}`);
        }
        const execution = orchestrator.startWorkflow(definition);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution,
          definition
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution, definition });
        return;
      }

      if (body.type === "workflow.pause") {
        if (typeof payload.executionId !== "string") {
          throw new Error("executionId is required");
        }
        const execution = orchestrator.pauseWorkflow(payload.executionId);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      if (body.type === "workflow.resume") {
        if (typeof payload.executionId !== "string") {
          throw new Error("executionId is required");
        }
        const execution = orchestrator.resumeWorkflow(payload.executionId);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      if (body.type === "workflow.cancel") {
        if (typeof payload.executionId !== "string") {
          throw new Error("executionId is required");
        }
        const execution = orchestrator.cancelWorkflow(payload.executionId);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      if (body.type === "workflow.tick") {
        if (typeof payload.executionId !== "string") {
          throw new Error("executionId is required");
        }
        const execution = orchestrator.tickWorkflow(payload.executionId, payload.forceFailCurrentStage === true);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      if (body.type === "workflow.set_failure_mode") {
        if (typeof payload.executionId !== "string" || typeof payload.stageId !== "string" || typeof payload.mode !== "string") {
          throw new Error("executionId, stageId, and mode are required");
        }
        if (!( ["none", "random", "always_fail"] as StageFailureMode[] ).includes(payload.mode as StageFailureMode)) {
          throw new Error("mode must be one of: none, random, always_fail");
        }
        const execution = orchestrator.setStageFailureMode(payload.executionId, payload.stageId, payload.mode as StageFailureMode);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      if (body.type === "workflow.update_assignment") {
        if (typeof payload.executionId !== "string" || typeof payload.stageId !== "string" || typeof payload.agentId !== "string") {
          throw new Error("executionId, stageId, and agentId are required");
        }
        const execution = orchestrator.updateStageAgentAssignment(payload.executionId, payload.stageId, payload.agentId);
        orchestrator.recordCommandApplied({
          commandId,
          commandType: body.type,
          actorId,
          appliedAt: new Date().toISOString(),
          execution
        });
        refreshProjections(orchestrator);
        sendJson(res, 200, { ok: true, commandId, commandType: body.type, execution });
        return;
      }

      throw new Error("Unsupported command type");
    } catch (error) {
      const message = (error as Error).message;
      orchestrator.recordCommandRejected({
        commandId,
        commandType: body.type,
        actorId,
        rejectedAt: new Date().toISOString(),
        reason: message
      });
      refreshProjections(orchestrator);
      sendJson(res, 400, { ok: false, commandId, commandType: body.type, error: message });
      return;
    }
  }

  const metricDetailMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)$/);
  if (method === "GET" && metricDetailMatch) {
    const metricId = metricDetailMatch[1] ?? "";
    if (metricId.length === 0) {
      sendJson(res, 400, { error: "metric id is required" });
      return;
    }
    const snapshot = projections.snapshot(eventStore.query({ limit: 500 }));
    const computed = projections.metrics(snapshot.events);

    const details: Record<string, { title: string; value: number; unit?: string; description: string; samples: number[] }> = {
      completionRate: {
        title: "Workflow completion rate",
        value: computed.workflowTotals.completionRate,
        unit: "%",
        description: "Completed workflow executions divided by total executions.",
        samples: snapshot.events
          .filter((event) => event.eventType === "workflow.stage_advanced")
          .slice(-20)
          .map(() => computed.workflowTotals.completionRate)
      },
      pendingApprovals: {
        title: "Pending approvals",
        value: computed.reliability.pendingApprovals,
        description: "Approvals currently waiting for human or policy sign-off.",
        samples: snapshot.events
          .filter((event) => event.eventType === "approval.requested" || event.eventType === "approval.resolved")
          .slice(-20)
          .map((event) => (event.eventType === "approval.requested" ? 1 : 0))
      },
      retryEvents: {
        title: "Retry events",
        value: computed.reliability.retryEvents,
        description: "Count of stage transitions that entered retry mode.",
        samples: snapshot.events
          .filter(
            (event) =>
              event.eventType === "workflow.stage_advanced" &&
              typeof event.payload === "object" &&
              event.payload !== null &&
              "result" in event.payload &&
              event.payload.result === "retrying"
          )
          .slice(-20)
          .map((_, index) => index + 1)
      },
      escalationEvents: {
        title: "Escalation events",
        value: computed.reliability.escalationEvents,
        description: "Count of stage transitions escalated due to exhaustion or policy.",
        samples: snapshot.events
          .filter(
            (event) =>
              event.eventType === "workflow.stage_advanced" &&
              typeof event.payload === "object" &&
              event.payload !== null &&
              "result" in event.payload &&
              event.payload.result === "escalated"
          )
          .slice(-20)
          .map((_, index) => index + 1)
      },
      totalCostUsd: {
        title: "Total runtime cost",
        value: computed.efficiency.totalCostUsd,
        unit: "USD",
        description: "Accumulated cost across tool executions in event history.",
        samples: snapshot.events.slice(-20).map((event) => Number((event.metadata.costUsd ?? 0).toFixed(4)))
      }
    };

    const detail = details[metricId];
    if (!detail) {
      sendJson(res, 404, { error: `Unknown metric: ${metricId}` });
      return;
    }

    sendJson(res, 200, { metricId, ...detail, eventCount: snapshot.events.length });
    return;
  }

  if (method === "GET" && url.pathname === "/api/registry/tools") {
    sendJson(res, 200, { tools: registry.listTools() });
    return;
  }

  if (method === "GET" && url.pathname === "/api/registry/mcps") {
    sendJson(res, 200, { mcps: registry.listMcps() });
    return;
  }

  const toolToggleMatch = url.pathname.match(/^\/api\/registry\/tools\/([^/]+)\/enabled$/);
  if (method === "POST" && toolToggleMatch) {
    const toolId = toolToggleMatch[1];
    if (!toolId) {
      sendJson(res, 400, { error: "tool id is required" });
      return;
    }
    const body = (await readBody(req)) as { enabled?: boolean };
    if (typeof body.enabled !== "boolean") {
      sendJson(res, 400, { error: "enabled boolean is required" });
      return;
    }
    try {
      const tool = registry.setToolEnabled(toolId, body.enabled);
      sendJson(res, 200, { tool });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  if (method === "POST" && url.pathname === "/api/workflows/tick-all") {
    const executions = orchestrator.tickAllRunningWorkflows();
    refreshProjections(orchestrator);
    sendJson(res, 200, { executions });
    return;
  }

  if (method === "POST" && url.pathname === "/api/workflows/start") {
    const body = (await readBody(req)) as { workflowId?: string };
    const definition = pickWorkflowDefinition(body.workflowId);
    if (!definition) {
      sendJson(res, 404, { error: `Workflow definition not found: ${body.workflowId ?? "<empty>"}` });
      return;
    }
    const execution = orchestrator.startWorkflow(definition);
    refreshProjections(orchestrator);
    sendJson(res, 200, { execution, definition });
    return;
  }

  const workflowMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)$/);
  if (workflowMatch) {
    const executionId = workflowMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    if (method === "GET") {
      try {
        const execution = orchestrator.getWorkflow(executionId);
        const definition = orchestrator.listWorkflowDefinitions().find((item) => item.id === execution.workflowId);
        sendJson(res, 200, { execution, definition });
        return;
      } catch (error) {
        sendJson(res, 404, { error: (error as Error).message });
        return;
      }
    }
    if (method === "PATCH") {
      const body = (await readBody(req)) as { stageId?: string; agentId?: string };
      if (!body.stageId || !body.agentId) {
        sendJson(res, 400, { error: "stageId and agentId are required" });
        return;
      }
      try {
        const execution = orchestrator.updateStageAgentAssignment(executionId, body.stageId, body.agentId);
        refreshProjections(orchestrator);
        sendJson(res, 200, { execution });
        return;
      } catch (error) {
        sendJson(res, 404, { error: (error as Error).message });
        return;
      }
    }
  }

  const workflowPauseMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/pause$/);
  if (method === "POST" && workflowPauseMatch) {
    const executionId = workflowPauseMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    try {
      const execution = orchestrator.pauseWorkflow(executionId);
      refreshProjections(orchestrator);
      sendJson(res, 200, { execution });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  const workflowResumeMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/resume$/);
  if (method === "POST" && workflowResumeMatch) {
    const executionId = workflowResumeMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    try {
      const execution = orchestrator.resumeWorkflow(executionId);
      refreshProjections(orchestrator);
      sendJson(res, 200, { execution });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  const workflowCancelMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/cancel$/);
  if (method === "POST" && workflowCancelMatch) {
    const executionId = workflowCancelMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    try {
      const execution = orchestrator.cancelWorkflow(executionId);
      refreshProjections(orchestrator);
      sendJson(res, 200, { execution });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  const tickMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/tick$/);
  if (method === "POST" && tickMatch) {
    const executionId = tickMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    const body = (await readBody(req)) as { forceFailCurrentStage?: boolean };
    try {
      const execution = orchestrator.tickWorkflow(executionId, body.forceFailCurrentStage === true);
      refreshProjections(orchestrator);
      sendJson(res, 200, { execution });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  const failureModeMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/failure-mode$/);
  if (method === "POST" && failureModeMatch) {
    const executionId = failureModeMatch[1];
    if (!executionId) {
      sendJson(res, 400, { error: "workflow execution id is required" });
      return;
    }
    const body = (await readBody(req)) as { stageId?: string; mode?: StageFailureMode };
    if (!body.stageId || !body.mode) {
      sendJson(res, 400, { error: "stageId and mode are required" });
      return;
    }
    if (!(["none", "random", "always_fail"] as StageFailureMode[]).includes(body.mode)) {
      sendJson(res, 400, { error: "mode must be one of: none, random, always_fail" });
      return;
    }
    try {
      const execution = orchestrator.setStageFailureMode(executionId, body.stageId, body.mode);
      refreshProjections(orchestrator);
      sendJson(res, 200, { execution });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  if (method === "POST" && url.pathname === "/api/approvals/evaluate") {
    const body = (await readBody(req)) as { toolName?: string; scope?: "single_file" | "workspace" | "repo" | "system" };
    const toolName = body.toolName ?? "filesystem.write";
    const scope = body.scope ?? "workspace";

    const toolPolicy = registry.assertToolAllowed(toolName, scope);
    if (!toolPolicy.ok) {
      sendJson(res, 403, { error: toolPolicy.error });
      return;
    }

    const request = orchestrator.evaluateApproval(toolName, scope);
    refreshProjections(orchestrator);
    sendJson(res, 200, { request });
    return;
  }

  const resolveMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/resolve$/);
  if (method === "POST" && resolveMatch) {
    const approvalId = resolveMatch[1];
    if (!approvalId) {
      sendJson(res, 400, { error: "approval id is required" });
      return;
    }
    const body = (await readBody(req)) as { resolution?: "approved" | "rejected"; signerId?: string };
    if (!body.resolution || !body.signerId) {
      sendJson(res, 400, { error: "resolution and signerId are required" });
      return;
    }
    try {
      const request = orchestrator.resolveApproval(approvalId, body.resolution, body.signerId);
      refreshProjections(orchestrator);
      sendJson(res, 200, { request });
      return;
    } catch (error) {
      sendJson(res, 404, { error: (error as Error).message });
      return;
    }
  }

  const agentMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
  if (agentMatch && method === "GET") {
    const agentId = agentMatch[1];
    if (!agentId) {
      sendJson(res, 400, { error: "agent id is required" });
      return;
    }
    const snapshot = projections.snapshot(eventStore.query({ limit: 500 }));
    const agent = snapshot.agents.find((item) => item.id === agentId);
    if (!agent) {
      sendJson(res, 404, { error: `Agent not found: ${agentId}` });
      return;
    }

    const workflows = snapshot.workflows.filter((workflow) =>
      Object.values(workflow.stageAgentAssignments).includes(agentId)
    );
    const approvals = snapshot.approvals.filter((approval) => approval.agentId === agentId);
    const messages = snapshot.chats[agentId] ?? [];
    const peerAgents = snapshot.agents.filter((item) => agent.peers.includes(item.id));

    sendJson(res, 200, {
      agent,
      workflows,
      approvals,
      messages,
      peerAgents
    });
    return;
  }

  const agentChatMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/chat$/);
  if (agentChatMatch && method === "POST") {
    const agentId = agentChatMatch[1];
    if (!agentId) {
      sendJson(res, 400, { error: "agent id is required" });
      return;
    }
    const body = (await readBody(req)) as { text?: string; model?: string };
    if (!body.text || !body.text.trim()) {
      sendJson(res, 400, { error: "text is required" });
      return;
    }

    const agent = orchestrator.listAgents().find((item) => item.id === agentId);
    if (!agent) {
      sendJson(res, 404, { error: `Agent not found: ${agentId}` });
      return;
    }

    const userMessage: MessageEnvelope<{ text: string; model?: string }> = {
      id: `msg-${crypto.randomUUID()}`,
      from: "human-user",
      to: [agentId],
      intent: "clarify",
      scope: "private",
      payload: {
        text: body.text.trim(),
        model: body.model ?? "simulated"
      },
      sentAt: new Date().toISOString()
    };
    projections.appendChatMessage(userMessage);
    orchestrator.sendMessage(userMessage);

    const relatedWorkflowCount = orchestrator
      .listWorkflows()
      .filter((workflow) => Object.values(workflow.stageAgentAssignments).includes(agentId)).length;

    const agentMessage: MessageEnvelope<{ text: string; model: string }> = {
      id: `msg-${crypto.randomUUID()}`,
      correlationId: userMessage.id,
      from: agentId,
      to: [agentId, "human-user"],
      intent: "inform",
      scope: "private",
      payload: {
        text: `Acknowledged. I am ${agent.name} (${agent.role}) and currently ${agent.state}. I am attached to ${relatedWorkflowCount} workflow execution(s). Next step: ${agent.activeStep ?? "await operator guidance"}.`,
        model: body.model ?? "simulated"
      },
      sentAt: new Date().toISOString()
    };

    projections.appendChatMessage(agentMessage);
    orchestrator.sendMessage(agentMessage);
    refreshProjections(orchestrator);

    sendJson(res, 200, {
      reply: agentMessage,
      conversation: projections.snapshot(eventStore.query({ limit: 500 })).chats[agentId] ?? []
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket: WebSocket) => {
  sockets.add(socket);
  socket.send(
    JSON.stringify({
      type: "snapshot",
      snapshot: projections.snapshot(eventStore.query({ limit: 500 })),
      metrics: projections.metrics(eventStore.query({ limit: 500 }))
    })
  );

  socket.on("close", () => {
    sockets.delete(socket);
  });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`ADE runtime service listening on http://${HOST}:${PORT}`);
});
