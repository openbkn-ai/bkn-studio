# cURL Parser Contract Design

## Issue

GitHub issue: #73 `bug(execution-factory): cURL 解析缺少请求体、Header 与异常诊断`

## Goal

When a user pastes a common cURL command in Execution Factory's HTTP API creation flow, Studio should convert the command into an accurate OpenAPI operation contract. The parser must preserve method, URL, query parameters, relevant headers, request body schema/example, and clear validation errors.

## Current Behavior

The current parser in `src/modules/execution-factory/utils/curl-to-openapi.ts` recognizes only:

- HTTP method
- service origin
- path
- query parameters
- a summary derived from the last path segment

It does not parse `-H`, `--header`, `-d`, `--data`, `--data-raw`, `--data-binary`, `-F`, or `--form`. As a result, this cURL:

```bash
curl -X POST https://api.example.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

is previewed as a POST `/login` operation with no request body. That loses the Agent-facing input contract.

## Design

### Parser Boundary

Keep parsing logic in `curl-to-openapi.ts`, but split the code into small helpers:

- normalize line continuations across Unix, PowerShell, and CMD styles
- tokenize cURL with shell-like quote handling
- scan tokens into URL, method, headers, data parts, form parts, and flags
- convert the parsed command into the existing `ParsedQuickApi` model
- build OpenAPI from `ParsedQuickApi`

This keeps the public API stable for existing UI callers: `parseCurlCommand`, `parseQuickApiUrl`, and `buildOpenApiFromQuickApi`.

### Data Model

Extend `ParsedQuickApi` with:

- `headers`: parsed non-content-type headers
- `contentType`: the effective request body media type
- `requestBody`: body schema/example metadata
- `warnings`: non-blocking parse warnings such as GET with body

Extend `QuickApiParameter` to support header parameters. Preserve existing query/path behavior.

### Body Rules

1. JSON body
   - Use explicit `Content-Type: application/json`, or infer JSON when body begins with `{` or `[`.
   - Parse JSON into an OpenAPI schema with examples.
   - Objects become `type: object` with property schemas.
   - Arrays become `type: array` with item schema inferred from the first item.

2. Form URL encoded body
   - Use `Content-Type: application/x-www-form-urlencoded`, or parse simple `a=1&b=2` data when no JSON is detected.
   - Generate object schema with string fields and an example object.

3. Multipart form
   - Parse `-F name=value` and `--form name=value`.
   - Generate `multipart/form-data` requestBody.
   - Treat `@file` values as string/binary placeholders with an example value.

4. Raw body
   - For `--data-binary` or unparseable body, keep a string example under `text/plain` or the provided content type.

5. `-G` with data
   - Convert data fields into query parameters instead of requestBody.

6. `@file` data
   - Return a clear error for `-d @file.json`, because the browser cannot read local files from pasted cURL.

### Header Rules

- `Content-Type` controls requestBody media type and should not be duplicated as a normal header parameter.
- `Accept` can be ignored for input parameters.
- `Authorization`, `Cookie`, and `X-API-Key` style values are sensitive. Do not bake literal values into examples. Add them as header parameters with a safe description.
- Other headers become optional OpenAPI header parameters.

### Error Diagnosis

`parseCurlCommand` should return actionable error messages for:

- not starting with `curl`
- unclosed quote
- missing URL
- multiple URLs
- unsupported URL scheme
- invalid URL
- invalid header format
- invalid JSON body
- unsupported `@file` body

Messages should be field-ready, because the UI maps parse failures to the cURL text area.

### UI Preview

The current operation preview already reads OpenAPI requestBody. Once the OpenAPI contains requestBody, it can show JSON schema/example. Improve the summary count so requestBody is visible even when there are no query/header parameters:

- `0 个 URL/Header 参数 · JSON 请求体 2 个字段 · 1 个响应`

This makes the user's mental model clear: body fields are not the same as URL parameters, but they are part of the callable contract.

## Files

- `src/modules/execution-factory/utils/curl-to-openapi.ts`
- `src/modules/execution-factory/utils/curl-to-openapi.test.ts`
- `src/modules/execution-factory/utils/openapi-operation-io.ts`
- `src/modules/execution-factory/components/OpenApiEndpointReview.tsx`
- optional E2E coverage in `tests/e2e/specs/execution-factory/e2e-quick-api.spec.ts`

## Test Strategy

Use TDD for parser behavior:

- JSON POST cURL creates requestBody schema/example.
- `--url` and `--request` are supported.
- `-G -d` converts data to query parameters.
- form-urlencoded data creates requestBody fields.
- multipart form creates multipart requestBody.
- invalid JSON returns a specific JSON error.
- unclosed quote returns a quote error.
- `-d @file.json` returns a file-content error.

Then run existing Execution Factory unit tests and targeted E2E if time allows.

## Risks

- cURL is shell syntax, not a trivial string format. The parser will intentionally support the common subset used in API docs and browser copies rather than every cURL option.
- Sensitive headers must not leak as literal defaults.
- Existing GET/query behavior must remain compatible.
