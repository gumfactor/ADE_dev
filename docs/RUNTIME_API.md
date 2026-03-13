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

- `POST /api/approvals/evaluate`
  - Body:
    - `toolName`
    - `scope` (`single_file` | `workspace` | `repo` | `system`)
  - Creates/returns an approval request when required by policy.

- `POST /api/approvals/{approvalId}/resolve`
  - Body:
    - `resolution` (`approved` | `rejected`)
    - `signerId`
  - Resolves a pending approval and emits event updates.

## WebSocket

- `GET /ws` (WebSocket upgrade)
  - Sends initial snapshot packet.
  - Broadcasts event packets with updated snapshot whenever new domain events are appended.
