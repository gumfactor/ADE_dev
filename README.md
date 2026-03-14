# ADE_dev

Agent-First Development Environment (ADE)

## Mission

Build a next-generation IDE platform designed for concurrent AI agent operations, not a traditional editor with AI features added on top. ADE treats agents as first-class runtime entities and code editing as one of many orchestrated capabilities.

## Problem Statement

Current coding tools are still editor-first:

- Single-threaded human interaction is the primary flow.
- Agent work is hidden behind one active panel or chat stream.
- Multi-agent coordination is manual and fragile.
- Tool approval, safety controls, and traceability are fragmented.

ADE solves this by making orchestration, visibility, governance, and reliability the primary UX and system concerns.

## Product Principles

1. Agent-First, Not Editor-First
2. Visibility by Default
3. Human-in-the-Loop Governance
4. Deterministic, Auditable Execution
5. Security and Isolation as Core Runtime Features
6. Extensible Skills/Tools/MCP Ecosystem
7. Fast Parallelism with Safe Guardrails

## Core User Experience

### 1) Multi-Agent Command Center

- Live grid/list view of all running agents.
- Per-agent status: running, waiting-approval, blocked, waiting-input, failed, completed.
- Live token/time/cost/budget indicators.
- Active step and current objective per agent.
- Workspace and branch association per agent.

### 2) Agent Timeline and Trace

- Full per-agent event timeline.
- Every tool call logged with parameters, output summary, and policy result.
- Replay mode for post-mortem debugging and reliability analysis.

### 3) Unified Approval Queue

- Central review inbox for approvals:
  - risky tool execution
  - high-impact file changes
  - external network access
  - deployment actions
- Batched approvals and policy-based auto-approvals.

### 4) Multi-Chat Control Surface

- View and interact with multiple agent chats at once.
- Thread pinning, grouping, and dependency linking.
- Cross-agent broadcast instructions and scoped directives.

### 5) Workflow Builder

- Visual and code-defined agent loops.
- Built-in primitives:
  - planner
  - implementer
  - reviewer
  - tester
  - validator
  - security scanner
  - deployer
- Retry, backoff, timeout, escalation, and fallback policies.

### 6) Skills, Tools, and MCP Registry

- Searchable registry with metadata, trust level, permissions, and usage analytics.
- Versioned skill/tool definitions.
- Environment-scoped enable/disable controls.

### 7) Reliability and Observability Dashboard

- Success/failure rates by workflow and agent type.
- Mean time to completion and human intervention rate.
- Regression/failure pattern detection.
- Policy violations and near-miss tracking.

## Reference Architecture

### Frontend Shell

- Desktop app shell (cross-platform).
- Multi-pane orchestration UI and structured event stream rendering.
- Local cache for conversation state and execution artifacts.

### Orchestration Core

- Agent lifecycle manager (spawn, suspend, resume, terminate).
- State machine engine for workflow execution.
- Dependency graph scheduler for parallel tasks.
- Durable queue for long-running operations.

### Policy and Governance Engine

- Permission model: tool-level, workspace-level, organization-level.
- Rule engine for approvals and automatic blocking.
- Audit logger with immutable event records.

### Execution Runtime

- Isolated agent sandboxes per workspace/task.
- Tool adapters (filesystem, git, terminal, HTTP, cloud APIs).
- MCP client + registry integration.

### Data Plane

- Event store for all agent actions.
- Artifact store for patches, logs, diffs, and test outputs.
- Metrics store for reliability and performance telemetry.

## Agent State Model

Recommended normalized states:

- queued
- planning
- executing
- waiting_approval
- waiting_input
- blocked
- retrying
- completed
- failed
- cancelled

State transitions must be explicit, validated, and persisted.

## Safety and Security Model

1. Default-deny for destructive tools.
2. Fine-grained scopes for file, network, and process access.
3. Mandatory approval checkpoints for privileged actions.
4. Full provenance on every artifact (who/what/when/why).
5. Secrets isolation and redaction at tool boundary.
6. Tamper-evident audit logs.

## MVP Scope (Phase 1)

Goal: prove an agent-first UX with real productivity gains.

### Must Have

- Multi-agent dashboard with live statuses.
- Parallel chat panels (at least 4 concurrent agents).
- Unified approval queue.
- Basic workflow loops (plan -> implement -> test -> review).
- Tool/MCP registry (read-only metadata + enable/disable).
- Git-aware workspace integration with safe patch application.

### Success Metrics

- 2x reduction in time-to-merge for medium tasks.
- 30%+ reduction in manual orchestration overhead.
- <5% untraceable failures.
- >95% of high-risk actions passing through approval/policy controls.

## Phase 2

- Cross-workspace orchestration.
- Team-level shared agent pools.
- Rich policy authoring and simulation.
- Adaptive auto-routing to specialized agents.
- Reliability scoring and automated remediation suggestions.

## Phase 3

- Enterprise governance and compliance packs.
- Deployment and ops workflows as first-class agent loops.
- End-to-end SDLC automation with mandatory human checkpoints.

## Proposed Technical Stack (Pragmatic Starting Point)

- Frontend: React + TypeScript + Electron/Tauri shell.
- Backend orchestration: TypeScript or Go microservices.
- Event bus/queue: NATS or Kafka.
- Database: Postgres (state) + ClickHouse (telemetry analytics).
- Artifact storage: S3-compatible object store.
- Policy engine: Open Policy Agent (OPA).
- Observability: OpenTelemetry + Prometheus + Grafana.

## Initial Build Plan (First 8 Weeks)

1. Weeks 1-2
	- Define domain model for agents, workflows, approvals, and tool calls.
	- Implement minimal orchestration service and event schema.
2. Weeks 3-4
	- Build command-center UI with live streaming states.
	- Implement chat multiplexing for multiple agents.
3. Weeks 5-6
	- Add approval queue and policy checks.
	- Integrate core tools (filesystem, git, terminal).
4. Weeks 7-8
	- Add workflow loop templates and validator steps.
	- Instrument telemetry and reliability dashboards.

## What Makes ADE Different

- Not a forked editor with agent panels.
- A native orchestration platform where code editing is one capability in a larger autonomous workflow system.
- Designed for parallel agent productivity, governance, and reliability from day one.

## Next Deliverables

1. Product Requirements Document (PRD)
2. System design spec with service boundaries
3. Data model and event contract definitions
4. Workflow DSL and policy spec
5. Clickable UX prototype for command center and approval queue 

## Implementation Status

Phase 1 foundation is implemented in this repository as a TypeScript monorepo:

- `packages/types`: domain model and event contracts.
- `packages/orchestrator-core`: state machine, scheduler, approval engine, messaging bus, orchestrator service.
- `packages/event-store`: event append/query adapter (in-memory MVP).
- `packages/runtime-service`: HTTP/WebSocket runtime API for live snapshots and approvals.
- `packages/command-center-ui`: command-center prototype with Mission Grid, Relationship Graph, Intervention Rail, and multi-chat view.
- `docs`: architecture, domain model, event schema, approval workflow, and runtime API docs.

Command center UI now has a standalone Vite runtime host with API/WebSocket proxy support for local execution.

Workflow engine is now active in orchestrator runtime:

- Stage progression for dependency-ready workflow stages.
- Per-stage retry handling with retry-budget enforcement.
- Escalation to configured role when retries are exhausted.
- Runtime tick endpoints for deterministic progression/failure simulation.

Command-driven control is now available for workflow operations:

- Unified `POST /api/commands` endpoint for start/pause/resume/cancel/tick/failure-mode/assignment actions.
- Command lifecycle events emitted for auditability: `command.accepted`, `command.applied`, `command.rejected`.

Execution logs:

- Project change log: `CHANGELOG.md`
- Iteration work log: `WORKLOG.md`

### Chosen Operating Defaults

- Relationship model: manager-worker hierarchy on top of a flexible DAG.
- Approval model: permissive/additive baseline with risk escalation.
- Optimization mode: balanced by default.

## Quick Start

1. Install dependencies

  `npm install`

2. Type-check all packages

  `npm run typecheck`

3. Build all packages

  `npm run build`

4. Start runtime service (for live UI data + approval actions)

  `npm run runtime:start`

5. Start command center UI host in another terminal

  `npm run ui:dev`

  Open `http://127.0.0.1:5173`