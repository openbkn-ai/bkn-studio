# Sandbox Runtime UI Design

## Goal

Implement the `bkn-studio` UI for issue #27: a read-only `沙箱运行时管理` page under `执行工厂（实验版）` that visualizes the Sandbox Runtime observability APIs delivered by `bkn-foundry` issue #116.

## Product Placement

The entry belongs under the experimental Execution Factory group, next to the capability library and capability market:

```text
执行工厂（实验版）
  - 能力库
  - 能力市场
  - 沙箱运行时管理
```

The label must be `沙箱运行时管理`, not `运行时管理`, because the page only covers Sandbox Runtime sessions and should not imply ownership of every runtime in OpenBKN.

## Visual Target

The page should match the previously proposed operational-console mockup:

- Existing OpenBKN left navigation.
- Breadcrumb `执行工厂（实验版） / 沙箱运行时管理`.
- Title `沙箱运行时管理` with technical subtitle `Sandbox Runtime`.
- Four top status cards: Control Plane, Session Pool, Running Tasks, Failed Sessions.
- Dense troubleshooting filters.
- Session table.
- Right-side detail drawer.

The tone is quiet, dense, and operational. It is not a marketing page and not a monitoring wall.

## Data Model

Frontend calls only `operator-integration` internal management APIs:

- `GET /api/agent-operator-integration/internal-v1/sandbox/health`
- `GET /api/agent-operator-integration/internal-v1/sandbox/pool`
- `GET /api/agent-operator-integration/internal-v1/sandbox/sessions`
- `GET /api/agent-operator-integration/internal-v1/sandbox/sessions/{id}`

The backend response already covers session id, status, runtime, template, resources, dependency state, timestamps, and recent error. The UI also needs business troubleshooting fields:

- `task_id`
- `capability_id`
- `capability_name`
- `user_id`
- `user_name`

These should be optional backend fields derived from sandbox session metadata/env vars. They are not required from sandbox-control-plane to keep compatibility.

## Test Data Principle

No frontend mock data is allowed. The page renders real API responses. Local demo/test data should be produced by the backend or by real sandbox sessions generated through execution flows. Frontend tests can validate mappers and request construction with deterministic inputs, but the application runtime must not silently fall back to fake session rows.

## Out of Scope

This issue is read-only. It must not expose terminate, cleanup, prewarm, dependency reinstall, full log download, or governance buttons. Those belong to the follow-up governance issue.

## Completion Criteria

- The navigation shows `沙箱运行时管理`.
- The page closely matches the UI mockup structure.
- The status cards, filters, table, and detail drawer use real API fields.
- Missing backend fields are added as optional fields in `bkn-foundry`.
- Frontend has no hard-coded fake session data.
- Tests cover backend field extraction and frontend data mapping.
- Local run can show a complete page with non-empty real API data.
