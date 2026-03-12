# Event Schema

All stateful activity is represented by immutable domain events.

## Event Envelope

- eventId
- eventType
- aggregateId
- aggregateType
- timestamp
- version
- correlationId
- causationId
- actor
- payload
- metadata

## Required Event Types

- agent.created
- agent.state_changed
- agent.message_sent
- approval.requested
- approval.resolved
- tool.executed
- handoff.initiated
- handoff.resumed
- workflow.stage_advanced

## Contract Rules

1. Event IDs are unique and append-only.
2. Event ordering is timestamp-driven and replay-safe.
3. Correlation and causation fields preserve traceability.
4. Metadata includes workspace and optional cost/token telemetry.
5. Consumers must be idempotent under replay.
