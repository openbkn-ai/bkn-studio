# Issue 47 HTTP Agent UI Implementation Design

## Goal

Evolve the existing Execution Factory HTTP experience into an Agent-readable capability workflow without rebuilding the underlying resource model. The first implementation focuses on HTTP/OpenAPI tools only. MCP and Skill keep their current flows and will receive separate designs later.

## Product Principle

The UI should generate as much as possible from cURL, URL, and OpenAPI documents, then ask the user to confirm or fill only the business semantics and governance decisions that cannot be inferred reliably.

Automatically generated:

- HTTP method, server URL, path, parameters, request body, responses.
- Initial tool name, description, toolbox name, and toolbox description when OpenAPI provides metadata.
- Initial side effect and risk hints from HTTP method and path naming.
- Agent readiness score and missing items.

User confirmed or filled:

- Business intent.
- Use cases and anti-use cases.
- Input and output business meanings.
- Verification example after debug.
- Agent visibility and invoke policy.
- Risk override when business context differs from HTTP method inference.

## Scope

### In Scope

- Add a lightweight HTTP Agent contract UI that displays and edits Agent-oriented fields around a `CapabilityManifest`.
- Reorganize HTTP tool detail into a clearer structure: overview, contract, debug, and publish sections.
- Keep quick HTTP creation lightweight: source, tool metadata, toolbox placement.
- Make OpenAPI import clearer by emphasizing parsed endpoint selection and default Agent policy in UI copy and layout.
- Surface Agent readiness, missing items, risk, verification, visibility, and invoke policy in HTTP tool contexts.
- Preserve existing tool, toolbox, debug, import, export, and publish services.

### Out of Scope

- No new Agent runtime, planner, or autonomous invocation engine.
- No backend database schema migration.
- No MCP or Skill contract editor in this issue.
- No LLM-generated semantic descriptions.
- No multi-environment credential management.
- No replacement of existing execution-factory routes.

## UI Architecture

### Existing Surfaces Kept

- `ExecutionUnitListScene` remains the ability management entry.
- `AddCapabilityWizard` remains the add-capability drawer.
- `QuickAddApiForm` remains the single HTTP API creation form.
- `ImportOpenApiCapabilityForm` remains the full OpenAPI import form.
- `ToolboxToolsScene` remains the toolbox detail and tool list page.
- `ToolDetailScene` remains the dedicated tool edit page.

### New/Changed UI Units

1. `HttpCapabilityContractPanel`
   - Focused display/edit component for business intent, use cases, input/output semantics, risk, visibility, and invoke policy.
   - It consumes a `CapabilityManifest`.
   - First version is front-end-only and uses existing manifest inference plus local form controls.

2. `HttpCapabilityOverviewPanel`
   - Compact summary for method/path/status/readiness/risk/test state.
   - Used near the top of the HTTP tool detail view.

3. `ToolDetailScene` tab layout
   - Tabs: overview, contract, debug, publish.
   - Existing form fields move into the overview/contract sections without changing service payload shape.

4. Quick HTTP copy/layout refinement
   - Keep current cURL/form tabs.
   - Keep OpenAPI IO preview.
   - Make Agent readiness preview and missing items visible next to generated interface preview.

## Data Model Strategy

Use the existing `CapabilityManifest` as the front-end contract:

```ts
type CapabilityManifest = {
  id: string;
  sourceType: "tool" | "mcp" | "skill" | "operator";
  sourceId: string;
  title: string;
  description?: string;
  intent?: string;
  useCases?: string[];
  antiUseCases?: string[];
  inputSemantics?: CapabilityInputSemantic[];
  outputSemantics?: CapabilityOutputSemantic[];
  examples?: CapabilityExample[];
  sideEffects?: CapabilitySideEffect;
  riskLevel?: CapabilityRiskLevel;
  testStatus?: CapabilityTestStatus;
  agentVisibility?: AgentVisibility;
  agentInvokePolicy?: AgentInvokePolicy;
};
```

First version does not persist all manifest fields independently. It maps:

- `title` from tool name.
- `description` from tool description.
- `intent` from use rule or description.
- input/output semantics from OpenAPI IO schema.
- side effect and risk from HTTP method.
- test status from debug/example state when available in session.
- visibility and invoke policy from inferred defaults.

When backend support is added later, the same component can submit the full manifest payload.

## Interaction Design

### Quick Add HTTP API

The quick add drawer remains a low-friction creation path:

1. Interface source: cURL or form.
2. Tool metadata: name, one-line description, business intent.
3. Toolbox placement: existing or new toolbox.

The right side preview should show:

- Method, server URL, path.
- Input and response preview.
- Agent readiness score.
- Missing semantic items.

Validation must stay field-local. If cURL parsing or backend URL validation fails, the error is shown on cURL/server URL rather than only as a toast.

### Import OpenAPI

The OpenAPI import form focuses on batch clarity:

- Parse document from paste/file/URL.
- Show document title/version/server/endpoint count.
- Show a selectable endpoint list with method, path, summary, risk, and IO count.
- Apply default Agent policy to imported tools.

The first implementation can keep backend import behavior unchanged while improving preview and policy copy.

### HTTP Tool Detail

The detail page becomes the main place to complete Agent readiness:

- Overview: current technical and governance summary.
- Contract: business intent, use cases, input/output semantics, risk, visibility, invoke policy.
- Debug: run existing debug and optionally save a passed example in session.
- Publish: distinguish resource publish state from Agent availability.

## Testing Strategy

1. Unit tests for manifest inference remain in `capability-manifest.test.ts`.
2. New component tests verify:
   - HTTP contract panel renders intent, input semantics, output semantics, risk, visibility, invoke policy.
   - Missing readiness items are visible when semantics or examples are incomplete.
   - Read-only inferred fields remain visible even before backend persistence exists.
3. Existing execution factory tests must continue to pass.
4. Manual QA should cover:
   - Add HTTP API from cURL.
   - Import OpenAPI.
   - Open tool detail.
   - Review contract.
   - Debug with sample input.
   - Confirm publish/Agent policy separation.

## Rollout Plan

1. Add component tests for the HTTP contract UI.
2. Implement `HttpCapabilityContractPanel`.
3. Wire the panel into `ToolDetailScene`.
4. Refine quick HTTP/OpenAPI texts only where needed.
5. Run targeted execution-factory tests and lint.
6. Keep MCP/Skill untouched except shared manifest types already present.

## Risks

- If too many fields are required during creation, users will abandon the flow. Mitigation: keep creation lightweight and move semantics to detail.
- If Agent policy appears equivalent to publish status, users may accidentally overexpose tools. Mitigation: separate resource status and Agent status visually.
- If inferred semantics look authoritative, users may skip review. Mitigation: show missing/derived hints and ask for business confirmation.
