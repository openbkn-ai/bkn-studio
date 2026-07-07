# HTTP Agent UX Follow-ups Implementation Design

## Linked Issues

- #55 `ux(execution-factory): guide next steps after HTTP capability creation`
- #56 `ux(execution-factory): preview and select OpenAPI endpoints before import`
- #57 `enhancement(execution-factory): include data sensitivity in Agent risk review`
- #58 `enhancement(execution-factory): persist debug success examples into Agent contract`

## Goal

Improve the HTTP/OpenAPI capability onboarding experience from a real user mental model:

1. I created a tool and need a clear next step.
2. I imported an OpenAPI document and need to know which endpoints become tools.
3. I need Agent risk to reflect data sensitivity, not only HTTP method.
4. I need successful debug results to become Agent evidence.

## Scope for This Iteration

### Implement Now

- Add a success guidance surface after quick HTTP API creation with actions:
  - view created tool/toolset;
  - debug/verify next;
  - complete Agent contract.
- Add an OpenAPI endpoint review panel in the import form:
  - method;
  - path;
  - summary;
  - inferred risk;
  - input/response count.
- Add front-end data sensitivity inference and display in the HTTP Agent contract:
  - normal;
  - possible_sensitive;
  - high_sensitive.
- Add tests for data sensitivity inference and OpenAPI endpoint review rendering.
- Extend E2E coverage to verify the new UI guidance appears in the real cURL/OpenAPI flows.

### Document/Prepare But Do Not Persist Yet

- #58 backend persistence of debug examples is not implemented in this iteration.
- The current implementation keeps session-level successful debug runs as Agent evidence.
- Durable examples need either a backend contract metadata field or a new example API. That should be a backend-supported follow-up before claiming cross-refresh persistence.

## User Experience Design

### #55 Creation Success Guidance

After a quick HTTP API is successfully created, the user sees a lightweight result panel instead of only a toast:

```text
HTTP API added to toolset

Tool: query_weather
Toolset: weather_toolbox

Recommended next steps
[View toolset] [Debug now] [Complete Agent contract]
```

This preserves the fast creation flow but makes the next action explicit.

### #56 OpenAPI Endpoint Review

When the OpenAPI document validates, show an endpoint list below the validation message:

```text
Endpoint review

GET    /weather          Query weather        low risk      1 input · 1 response
POST   /weather/alert    Create alert         medium risk   3 inputs · 1 response
DELETE /weather/{id}     Delete alert         high risk     1 input · 1 response
```

First iteration is review-only. Selection can come in the next slice if backend import supports partial import.

### #57 Data Sensitivity

Risk currently infers side effects from HTTP method:

- GET -> read/low risk;
- POST/PUT/PATCH -> write/medium risk;
- DELETE -> write/high risk.

This is necessary but not sufficient. Add sensitivity inference from title, path, description, and semantic text:

- `log`, `audit`, `trace` -> possible_sensitive.
- `user`, `customer`, `order`, `finance`, `invoice`, `credential`, `token`, `secret`, `password` -> high_sensitive.
- otherwise normal.

The contract panel displays:

```text
Data sensitivity: possible_sensitive
```

This helps prevent the UX from saying "safe" for sensitive GET tools.

### #58 Debug Evidence

The current #47 implementation already converts the latest successful debug run into a session-level passed example. This iteration clarifies the UI copy:

```text
Latest successful debug is used as a session Agent example.
```

Durable persistence remains a follow-up until backend storage is available.

## Test Plan

- Unit:
  - sensitivity inference returns possible/high sensitivity for log/user/order/finance endpoints.
  - endpoint review extracts method/path/summary/risk/counts from OpenAPI.
  - contract panel displays sensitivity.
- E2E:
  - quick cURL weather flow shows next-step guidance and still debugs successfully.
  - OpenAPI import flow shows endpoint review and still imports successfully.
  - log cURL flow displays sensitivity hint when opening the Agent contract.

## Non-goals

- No database migration.
- No OpenAPI partial import submit.
- No durable debug example API.
- No MCP/Skill UI changes.
