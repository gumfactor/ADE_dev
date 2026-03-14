# Runtime API

ADE runtime service streams orchestration state and supports approval actions.

## Start

- Build: `npm run build`
- Run: `npm run runtime:start`

Service defaults:
- Host: `127.0.0.1`
- Port: `8787`

Environment overrides:
- `ADE_RUNTIME_HOST`
- `ADE_RUNTIME_PORT`

## Endpoints

- `GET /health`
  - Returns basic liveness payload.

- `GET /api/snapshot`
  - Returns projected runtime state:
    - agents
    - relationships
    - workflows
    - approvals
    - chats
    - recent events

- `GET /api/files/tree?path=<relative-directory>`
  - Returns a bounded-depth directory tree rooted at workspace path.

- `GET /api/files/read?path=<relative-file>`
  - Returns UTF-8 file contents for a workspace-relative file path.

- `POST /api/files/write`
  - Body:
    - `path` (workspace-relative file path)
    - `content` (string)
  - Writes UTF-8 file content into workspace file.

- `GET /api/metrics`
  - Returns projected reliability and efficiency metrics:
    - workflow totals and completion rate
    - retry and escalation counts
    - approval intervention counts
    - aggregate token/cost totals
    - mean workflow completion duration

- `GET /api/registry/tools`
  - Lists tool registry entries including trust level, version, scopes, and enablement.

- `POST /api/registry/tools/{toolId}/enabled`
  - Body:
    - `enabled` (boolean)
  - Enables/disables a tool entry.

- `GET /api/registry/mcps`
  - Lists MCP registry entries and endpoints.

- `POST /api/approvals/evaluate`
  - Body:
    - `toolName`
    - `scope` (`single_file` | `workspace` | `repo` | `system`)
  - Creates/returns an approval request when required by policy.
  - Tool policy guardrails are enforced first: tool must be registered, enabled, and authorized for the requested scope.

- `POST /api/approvals/{approvalId}/resolve`
  - Body:
    - `resolution` (`approved` | `rejected`)
    - `signerId`
  - Resolves a pending approval and emits event updates.

- `POST /api/workflows/tick-all`
  - Advances all running workflow executions by one stage step.

- `POST /api/workflows/{executionId}/tick`
  - Body:
    - `forceFailCurrentStage` (boolean, optional)
  - Advances one workflow execution by one stage step.
  - When `forceFailCurrentStage` is true, stage retries are applied and escalation triggers after retry budget is exhausted.

## WebSocket

- `GET /ws` (WebSocket upgrade)
  - Sends initial snapshot packet.
  - Broadcasts event packets with updated snapshot and metrics whenever new domain events are appended.

## Workflow Engine Notes

- Runtime auto-ticks workflows on an interval (`ADE_WORKFLOW_TICK_MS`, default 2500 ms).
- Successful ticks move workflow to the next dependency-ready stage.
- Failed ticks increment per-stage retry counters.
- When retry limit is exceeded, workflow pauses and escalates to configured role.
