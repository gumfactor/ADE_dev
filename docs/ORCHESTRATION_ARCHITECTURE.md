# Orchestration Architecture

## Packages

- @ade/types: Shared contracts for domain model.
- @ade/orchestrator-core: State machine, scheduler, approvals, messaging, orchestrator service.
- @ade/event-store: Event append/query layer (MVP in-memory adapter).
- @ade/command-center-ui: Agent-first mission control UI shell.

## Runtime Flow

1. Orchestrator registers agents and starts workflow execution.
2. Scheduler determines dependency-ready stages.
3. Agents execute actions and exchange typed messages.
4. Approval engine evaluates risky actions.
5. Approved or blocked actions emit events.
6. UI reads event-backed state for command center rendering.

## Reliability Patterns

- Explicit state transitions with validation.
- Immutable audit trail of all operations.
- Human takeover via waiting_input and waiting_approval states.
- Clear escalation path for blocked workflows.
