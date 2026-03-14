# Work Log

## 2026-03-14 - Phase 1: Command Contracts and Executable Workflow Commands

### Objective

Introduce a formal command layer so the UI can drive workflow execution via typed commands instead of ad-hoc endpoint calls.

### Implemented

- Added shared command types for workflow actions:
  - start, pause, resume, cancel, tick, set failure mode, update assignment.
- Added command lifecycle event types in domain events.
- Added orchestrator methods to record command lifecycle events with human actor attribution.
- Added a unified `POST /api/commands` endpoint to execute workflow commands and emit command lifecycle events.
- Updated runtime and event schema docs for command-driven control.

### Notes

- Existing direct workflow endpoints are retained for backward compatibility.
- New command endpoint is intended as the primary operator interaction contract for upcoming UI phases.
