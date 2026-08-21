# Business Provenance Trial 404 Design

## Goal

When the Enterprise business-provenance capability is unavailable, Studio must show the upgrade guidance without issuing a business-provenance API request or displaying a misleading HTTP 404 toast.

## Context

The Enterprise agent-observability assembly intentionally returns 404 for `/api/agent-observability/v1/business-provenance/*` while no Enterprise entitlement is active. This hides paid routes. The current Studio route can still mount `BusinessProvenanceScene`; its initial effect then requests the conversations endpoint. The capability page remains visually correct, but the resulting expected 404 is presented as an application error.

## Design

Use the already-established edition/capability boundary for the Business Provenance route as the render boundary. In the no-entitlement path it renders only the upgrade guidance. The query scene is not mounted, so its initial fetch never runs. The entitled path retains the current `BusinessProvenanceScene` unchanged.

Do not translate the backend 404 into a new public response, and do not merely suppress the toast. Both alternatives either alter route-hiding semantics or retain an unnecessary request.

## Regression Coverage

- A trial or Community capability state renders the upgrade guidance without mounting protected live content.
- The Business Provenance route explicitly selects that non-mount policy.
- An entitled state renders the existing scene, preserving the current query behavior.
- Existing role/profile denial behavior remains unchanged.

## Verification

Run focused component tests first, then the BKN Trace suite and the repository quality commands required by `AGENTS.md` before commit.
