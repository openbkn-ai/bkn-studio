# Audit Filter Layout Design

## Status

Implemented.

## Goal

Make the audit-log filters compact and reliable: a single row containing time range, resource or business module, result status, and an operator value that accepts either a name or an ID.

## Scope

- Remove the ambiguous free-text `q` search and free-text action filter from the audit-log page.
- Keep only structured filters and send them through the observability log API.
- Interpret the new `actor` query as an exact actor ID or a case-insensitive match against the persisted actor-name snapshot.
- Preserve `actor_id` for existing exact-ID links and API callers.

## Alternatives considered

1. Resolve an entered actor name to an ID in the UI. Rejected: it fails for deleted users and historical names, and couples audit search to the user directory.
2. Expand generic `q` over all audit fields. Rejected: its broad, unclear semantics caused the reported defect.
3. Add an explicit actor query contract and retain only structured filters. Chosen: the displayed controls have stable, testable semantics.

## Data flow

The Studio page sends `actor=<name-or-id>` alongside the selected time range, module/resource, and outcome. The observability handler parses that value into `LogQuery.ActorQuery`. The service applies the actor predicate only after receiving source records, matching `ActorID` exactly or `ActorNameSnapshot` case-insensitively. This preserves source authorization and avoids requiring upstream adapters to support name search.

## Compatibility and risk

`actor_id` remains exact-match compatible. Removing `q` and the free-text action control is intentional UI/API-call simplification; no persisted data, permissions, or schema migrations are involved. On narrow screens the row may wrap naturally, while standard desktop widths remain one row.

## Verification

- Studio request tests prove that the page omits `q` and passes the four retained filter categories.
- Backend tests prove actor-name and actor-ID matches, including filtering after source retrieval.
- Existing focused Studio and Go service tests remain green.
