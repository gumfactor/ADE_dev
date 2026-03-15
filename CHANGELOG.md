# Changelog

All notable changes to ADE_dev are documented in this file.

## [0.3.0] - 2026-03-15

### Added

- Added interactive workflows operator surface in [packages/command-center-ui/src/components/WorkflowsTab.tsx](packages/command-center-ui/src/components/WorkflowsTab.tsx).
- Added interactive agent workspace with per-agent chat in [packages/command-center-ui/src/components/AgentsTab.tsx](packages/command-center-ui/src/components/AgentsTab.tsx).
- Added metrics drill-down experience in [packages/command-center-ui/src/components/MetricsTab.tsx](packages/command-center-ui/src/components/MetricsTab.tsx).

### Changed

- Rewired tab routing in [packages/command-center-ui/src/layout/CommandCenterLayout.tsx](packages/command-center-ui/src/layout/CommandCenterLayout.tsx) so Workflows, Agents, and Metrics now use interactive surfaces instead of monitor-only views.

## [0.2.0] - 2026-03-14

### Added

- Added shared command contracts in [packages/types/src/commands.ts](packages/types/src/commands.ts).
- Added command lifecycle event types (`command.accepted`, `command.applied`, `command.rejected`) in [packages/types/src/events.ts](packages/types/src/events.ts).
- Added unified operator command endpoint `POST /api/commands` in [packages/runtime-service/src/index.ts](packages/runtime-service/src/index.ts).
- Added command lifecycle event emission from orchestrator in [packages/orchestrator-core/src/orchestrator.ts](packages/orchestrator-core/src/orchestrator.ts).

### Changed

- Updated runtime API documentation in [docs/RUNTIME_API.md](docs/RUNTIME_API.md).
- Updated event schema documentation in [docs/EVENT_SCHEMA.md](docs/EVENT_SCHEMA.md).
