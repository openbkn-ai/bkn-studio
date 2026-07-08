# OpenAPI Relative Server URL Import Design

## Issue

GitHub issue: #80 `bug(execution-factory): OpenAPI import accepts relative servers URL then fails on save`

## Problem

The OpenAPI import drawer can fetch and validate a public OpenAPI 3.x document such as:

```text
https://petstore3.swagger.io/api/v3/openapi.json
```

The document validates successfully and endpoint preview works. However, its first server is relative:

```json
{
  "servers": [{ "url": "/api/v3" }]
}
```

The UI currently fills the Service URL with `/api/v3`. The backend registration path requires a full HTTP(S) service URL, so the final save fails with a generic URL-format error. This is confusing because users already saw "OpenAPI document validated successfully".

## User Story

As a user importing an OpenAPI interface set from a URL, I want the system to resolve relative `servers.url` values against the OpenAPI document URL when possible, so I can import public OpenAPI documents without manually editing JSON.

As a user importing by paste or file upload, I want a clear prompt when `servers.url` is relative, so I know that I must provide the absolute service URL before saving.

## Design Goals

- Preserve OpenAPI structural validation: relative `servers.url` is legal OpenAPI and should not make the document invalid.
- Add import-time service URL validation because the Execution Factory runtime requires an absolute callable base URL.
- Resolve relative server URLs only when the OpenAPI document source URL is known.
- Show field-level, actionable guidance before submit.
- Avoid backend API changes.

## Proposed Data Flow

### 1. Track OpenAPI Document Source

`OpenApiSpecInput` already supports paste, file upload, and URL fetch. Extend its `onChange` contract or add a second callback so consumers can know the source:

```ts
type OpenApiSpecSource =
  | { kind: "paste" }
  | { kind: "file"; fileName?: string }
  | { kind: "url"; url: string };
```

`ImportOpenApiCapabilityForm` stores this source in local state next to `openapiSpec`.

### 2. Analyze Server URL Intent

Add a utility near `metadata-content.ts`, or a small dedicated helper:

```ts
type ResolvedOpenApiServerUrl =
  | { ok: true; url: string; source: "absolute" | "resolved-relative" }
  | { ok: false; reason: string; relativeUrl?: string };
```

Rules:

- If `servers[0].url` is absolute `http://` or `https://`, return it unchanged.
- If it starts with `/` and source is URL, resolve with the source origin:
  - source: `https://petstore3.swagger.io/api/v3/openapi.json`
  - server: `/api/v3`
  - result: `https://petstore3.swagger.io/api/v3`
- If it is relative without leading slash, resolve against the source document directory:
  - source: `https://example.com/docs/openapi.json`
  - server: `../api`
  - result: `https://example.com/api`
- If source is paste or file and server is relative, do not guess. Return a validation warning that asks the user to fill Service URL manually.
- If no valid server exists, keep existing structural validation behavior for missing/empty servers.

### 3. Fill Service URL Before Submit

When `analysis.ok`:

- Use the resolver to compute the callable service URL.
- If resolver succeeds, set `serviceUrl` to the resolved absolute URL.
- If resolver fails because the server is relative and source is unknown, keep the service field editable and set a field warning/error:
  - "The OpenAPI server `/api/v3` is relative. Please enter a full service URL, for example `https://example.com/api/v3`."

### 4. Submit Guard

Before calling `onSubmit`, validate the final `serviceUrl`:

- Must be absolute HTTP(S).
- If invalid, set the `serviceUrl` field error and scroll/focus it.
- Do not let the request reach backend with `/api/v3`.

This prevents the generic backend URL-format toast from being the first feedback.

### 5. User Feedback

When a relative server URL is resolved from URL source, show a calm informational hint:

```text
Detected relative OpenAPI server /api/v3 and resolved it to https://petstore3.swagger.io/api/v3.
```

When manual input is required:

```text
This OpenAPI document uses a relative server URL /api/v3. Enter the full service URL before importing.
```

Use the same subtle blue-gray information style as the Execution Factory import and debug panels. Avoid red until the user tries to submit without a valid URL.

## Files

Likely files to update:

- `src/modules/execution-factory/components/OpenApiSpecInput.tsx`
- `src/modules/execution-factory/components/create-menu/ImportOpenApiCapabilityForm.tsx`
- `src/modules/execution-factory/utils/metadata-content.ts`
- `src/modules/execution-factory/locales/zh-CN.ts`
- `src/modules/execution-factory/locales/en-US.ts`
- `src/modules/execution-factory/utils/metadata-content.test.ts`
- A component or E2E test for URL import with Petstore-style relative server.

## Test Plan

Unit tests:

- Absolute server URL remains unchanged.
- URL source plus `/api/v3` resolves to origin + path.
- URL source plus `../api` resolves relative to the document URL directory.
- Paste/file source plus `/api/v3` returns a manual-input warning.
- Submit guard rejects `/api/v3` with a service URL field error.

E2E/component tests:

- In OpenAPI import URL mode, fill `https://petstore3.swagger.io/api/v3/openapi.json`.
- After fetch, Service URL is `https://petstore3.swagger.io/api/v3`.
- Endpoint preview still shows operations.
- Import submit no longer fails because of `/api/v3`.

## Risks

- Some OpenAPI documents intentionally use relative servers for deployment portability. Resolving relative URLs should only happen when the source URL is known and should remain editable.
- External network availability can make E2E flaky. Prefer component tests with mocked fetch for CI; keep live Petstore URL as manual verification or optional E2E.
