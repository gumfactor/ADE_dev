# Domain Model

## Operating Model

ADE uses a manager-worker control spine with flexible DAG peer routes.

- Manager-worker links enforce authority, responsibility, and gated approvals.
- Peer specialist links allow direct agent-to-agent communication for speed.
- Human intervention is a first-class state transition, not an exception path.

## Core Entities

- Agent: Runtime unit with role, state, context, and budgets.
- AgentRelationship: Directed edge defining hierarchy or peer specialization.
- WorkflowDefinition: Stage template with retries, timeouts, and escalation.
- WorkflowExecution: Runtime instance of a workflow definition.
- MessageEnvelope: Typed payload for agent/human communication.
- ApprovalRequest: Risk-scored action gate with signer requirements.
- SignatureChain: Tamper-evident approval and handoff attestations.
- DomainEvent: Immutable event envelope for all stateful actions.

## State Invariants

1. Each agent has at most one manager.
2. Peer edges can exist between any agents if policy allows.
3. Any high-risk tool action must pass approval gate before execution.
4. Every state change must emit an event.
5. Terminal states are completed, failed, cancelled.

## Approval Model

- Baseline is permissive/additive.
- Low-risk operations auto-approve.
- Risk score thresholds route to single or multi-signer approval.
- Critical threshold blocks and escalates.

## Optimization Modes

- balanced: default speed/cost/safety tradeoff
- fastest: prioritize throughput
- safest: maximize governance constraints
- cheapest: minimize cost and token burn
