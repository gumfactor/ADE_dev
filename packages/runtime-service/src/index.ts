import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { InMemoryEventStore } from "@ade/event-store";
import { OrchestratorService } from "@ade/orchestrator-core";
import type { DomainEvent, MessageEnvelope, StageFailureMode } from "@ade/types";
import { RuntimeProjectionStore } from "./projections.js";
import { RuntimeRegistryStore } from "./registry.js";
import { seedAgents, seedMessages, seedRelationships, seedWorkflow } from "./seed.js";

const HOST = process.env.ADE_RUNTIME_HOST ?? "127.0.0.1";
const PORT = Number(process.env.ADE_RUNTIME_PORT ?? 8787);
const WORKFLOW_TICK_MS = Number(process.env.ADE_WORKFLOW_TICK_MS ?? 2500);

const eventStore = new InMemoryEventStore();
const projections = new RuntimeProjectionStore();
const registry = new RuntimeRegistryStore();

const sockets = new Set<import("ws").WebSocket>();

function refreshProjections(orchestrator: OrchestratorService): void {
  projections.updateAgents(orchestrator.listAgents());
  projections.updateWorkflows(orchestrator.listWorkflows());
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

  if (method === "GET" && url.pathname === "/api/metrics") {
    const snapshot = projections.snapshot(eventStore.query({ limit: 500 }));
    sendJson(res, 200, projections.metrics(snapshot.events));
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
