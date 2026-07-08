# Agent Capability Manifest Design

Issue: https://github.com/openbkn-ai/bkn-studio/issues/47

## Goal

Evolve the current Execution Factory from a human-oriented resource management
surface into an Agent-readable capability governance surface.

The current factory already covers capability management, capability market,
sandbox runtime observability, toolboxes, tools, MCP services, Skill packages,
operators, import/export, and publish lifecycle. The gap is not resource
coverage. The gap is that capabilities are still mostly expressed as backend
resources instead of semantic, verifiable, Agent-usable business capabilities.

This design introduces a unified Capability Manifest and a semantic capability
detail experience while preserving the existing execution-factory routes,
services, resource models, and compatibility behavior.

## Current Capability Surface

The official Execution Factory currently exposes three major entries:

- Capability Management: manages local toolboxes, MCP services, Skill packages,
  and advanced operator resources.
- Capability Market: browses, installs, and syncs published capabilities from
  other business domains.
- Sandbox Runtime Management: shows sandbox runtime health, sessions, tasks,
  dependencies, and failure pressure.

The current resource types already cover:

- Toolbox: groups HTTP API tools and Function tools.
- Tool: supports OpenAPI and Function metadata, debug, enable/disable, and
  global parameters.
- MCP service: supports SSE / Streamable HTTP registration, tool discovery, and
  MCP tool debug.
- Skill package: supports ZIP / SKILL.md import, file preview, edit, and release
  history.
- Operator: supports OpenAPI / Function registration, debug, execution control,
  release history, and conversion to tool.
- Import/export: supports OpenAPI import, ADP package import/export, market
  install, and market sync.
- Publish governance: supports unpublish, published, offline, and editing
  states.

## Problem

### Resource Metadata Is Not Enough

Existing models mostly expose resource-level fields:

- name
- description
- status
- category
- schema
- createUser / updateUser
- releaseTime

These fields are useful for people managing resources, but they are not enough
for an Agent to reliably decide when and how to use a capability. For example,
`customer_id: string` does not tell an Agent whether it means customer master
data ID, phone number, user name, tenant ID, or an external system code.

### Capability Types Do Not Share A Contract

Tool, MCP, Skill, and Operator each have a valid internal model. Human users can
understand the differences, but Agents need a normalized contract for discovery,
selection, verification, and invocation planning.

The system should keep the existing resource models but expose a unified
capability view above them.

### Debug Results Are Not Persisted As Capability Evidence

Current debug flows are useful for one-time manual testing. Agent usage needs
stronger evidence:

- Which examples have passed?
- When was the capability last verified?
- What input was used?
- What output shape was observed?
- Was the result safe, partial, failed, or stale?
- Does the capability have side effects?

### Publish Status Is Not Agent Availability

`published` means the resource is available in the platform lifecycle. It does
not answer whether an Agent can see it, call it automatically, call it only after
human approval, or call it only in read-only/test mode.

## Product Principles

1. Keep the existing resource model stable.
   Do not replace Toolbox, Tool, MCP, Skill, or Operator in the first phase.

2. Add an Agent-readable semantic layer.
   The Agent-facing view should normalize different resource types into a single
   Capability Manifest.

3. Make capability quality visible.
   A capability should clearly show whether it is well described, tested,
   safe to call, and ready for Agent use.

4. Preserve human governance.
   Agent enablement is controlled by people. The system should support visible,
   reviewable policies instead of implicit automation.

5. Let semantics grow incrementally.
   First support manually maintained semantic fields and validation evidence.
   Later phases can add AI-assisted generation, schema inference, and automatic
   recommendation.

## User Stories

### Business User

As a business user, I want to open a capability detail page and immediately
understand what business problem it solves, when I should use it, and when I
should not use it, so that I do not have to reverse-engineer technical fields.

Value:

- Reduces onboarding cost.
- Makes capability reuse easier across teams.
- Helps business users choose the right capability without reading API specs.

### Capability Creator

As a capability creator, I want to explain each parameter in business language,
provide examples, and mark important constraints, so that Agents and downstream
users do not misuse identifiers, environment values, date ranges, or tenant
fields.

Value:

- Prevents invalid calls caused by ambiguous parameter names.
- Improves generated examples and debug data quality.
- Converts tacit integration knowledge into reusable metadata.

### Agent

As an Agent, I want one normalized manifest for Tool, MCP, Skill, and Operator
capabilities, so that I can search, rank, select, and plan calls without needing
four separate resource-specific adapters.

Value:

- Improves autonomous tool selection.
- Makes future Agent discovery APIs and MCP exposure simpler.
- Supports cross-type capability recommendation and composition.

### Platform Administrator

As a platform administrator, I want to control whether each capability is hidden,
discoverable, callable with approval, or callable automatically, so that Agent
autonomy can grow under clear governance.

Value:

- Reduces production risk.
- Makes side effects explicit.
- Supports compliance and audit.

### Operator / Auditor

As an operator or auditor, I want to see recent verification status, example
results, side effects, and risk level, so that I can judge whether a capability
is safe to expose to Agents.

Value:

- Turns debug into reusable evidence.
- Helps identify stale or broken capabilities.
- Supports production readiness reviews.

## Capability Manifest

The Capability Manifest is a normalized view generated from the underlying
resource plus semantic extensions.

```ts
export type CapabilitySourceType = "tool" | "mcp" | "skill" | "operator";

export type CapabilitySideEffect =
  | "none"
  | "read"
  | "write"
  | "external_action"
  | "unknown";

export type CapabilityRiskLevel = "low" | "medium" | "high";

export type CapabilityTestStatus = "untested" | "passed" | "failed" | "stale";

export type AgentVisibility = "hidden" | "discoverable" | "callable";

export type AgentInvokePolicy =
  | "manual_only"
  | "approval_required"
  | "auto_allowed";

export type CapabilityInputSemantic = {
  name: string;
  location?: "query" | "path" | "header" | "cookie" | "body" | "argument";
  dataType?: string;
  required?: boolean;
  businessMeaning?: string;
  examples?: unknown[];
  defaultStrategy?: string;
  constraints?: string[];
  dependsOn?: string[];
  sourceHint?: string;
};

export type CapabilityOutputSemantic = {
  name: string;
  path?: string;
  dataType?: string;
  businessMeaning?: string;
  examples?: unknown[];
  caveats?: string[];
};

export type CapabilityExample = {
  title: string;
  scenario?: string;
  input: unknown;
  expectedOutputSummary?: string;
  verifiedAt?: number;
  status?: CapabilityTestStatus;
};

export type CapabilityManifest = {
  id: string;
  sourceType: CapabilitySourceType;
  sourceId: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
  intent?: string;
  useCases?: string[];
  antiUseCases?: string[];
  inputSemantics?: CapabilityInputSemantic[];
  outputSemantics?: CapabilityOutputSemantic[];
  examples?: CapabilityExample[];
  sideEffects?: CapabilitySideEffect;
  authRequirements?: string[];
  riskLevel?: CapabilityRiskLevel;
  testStatus?: CapabilityTestStatus;
  agentVisibility?: AgentVisibility;
  agentInvokePolicy?: AgentInvokePolicy;
  updatedAt?: number;
};
```

## Source Mapping

### Tool

Tool is the highest-priority source because HTTP APIs and Function tools are the
most direct Agent-callable capabilities.

Initial mapping:

- `toolId` -> `sourceId`
- `name` -> `title`
- `description` -> `description`
- `metadataType` -> source subtype
- `ioSpec.parameters` -> `inputSemantics`
- `ioSpec.responses` -> `outputSemantics`
- `status` -> lifecycle status
- `useRule` -> invocation guidance

Recommended semantic additions:

- business intent
- parameter business meanings
- response field meanings
- side effect classification
- Agent invoke policy
- verified examples

### MCP

MCP service should be represented as an external tool source plus local
governance. Each discovered MCP tool can become a capability candidate.

Initial mapping:

- `mcpId` -> service source ID
- MCP tool `name` -> capability title
- MCP tool `description` -> description
- MCP tool `inputSchema` -> input semantics seed
- `mode`, `url`, and headers -> connection metadata

Recommended semantic additions:

- per-tool visibility policy
- per-tool approval policy
- service connection status
- tool discovery freshness
- call failure hints

### Skill

Skill packages should move from file-package management toward executable skill
understanding.

Initial mapping:

- `skillId` -> `sourceId`
- `name` -> `title`
- `description` -> `description`
- `version` -> version metadata
- SKILL.md content -> semantic seed
- file summary -> supporting artifacts

Recommended semantic additions:

- skill tasks
- required context
- executable entry points
- dependencies
- examples
- safety boundaries

### Operator

Operator remains an advanced and compatibility-oriented capability source.

Initial mapping:

- `operatorId` -> `sourceId`
- `name` -> `title`
- `description` -> `description`
- `metadataType` -> source subtype
- `executeControl` -> runtime constraints
- release history -> version evidence

Recommended semantic additions:

- orchestration use cases
- retry behavior explanation
- workflow node guidance
- conversion relationship to Tool

## UX Design

### Capability Detail Tabs

Each resource detail page should gradually converge toward the same information
architecture:

1. Overview
   - title, type, lifecycle status, category
   - business intent
   - use cases and anti-use cases
   - risk level and side effect badge
   - Agent availability summary

2. Inputs / Outputs
   - technical schema
   - business meaning per input
   - examples and constraints
   - output field explanations
   - empty-state guidance when schema is missing

3. Debug / Verification
   - existing debug entry
   - sample input
   - latest result
   - verification status
   - failure reason and retry guidance

4. Agent Usage
   - visibility policy
   - invoke policy
   - approval requirements
   - auth requirements
   - generated Agent-facing usage summary

5. Publish / Version
   - existing publish state
   - release history
   - rollback or republish actions where supported

6. Runtime / Observability
   - recent calls
   - success rate when available
   - sandbox sessions when applicable
   - errors and latency when available

### Capability List Improvements

The existing type tabs should remain, but list cards should expose Agent
readiness:

- semantic completeness
- test status
- risk level
- Agent visibility
- side effect

Suggested filters:

- Agent visible / hidden
- callable automatically / approval required
- tested / untested / failed
- read-only / write / external action
- semantic completeness

### Creation Flow Improvements

The current creation menu is already grouped by intent. The next improvement is
to add semantic guidance after the technical resource is created:

- "Explain business purpose"
- "Explain key parameters"
- "Add example"
- "Run verification"
- "Choose Agent policy"

This should be a post-create readiness checklist rather than a blocking form in
the first phase.

## Data And Backend Strategy

### Phase 1: Frontend Contract And Metadata Extension

Use a frontend normalization layer to generate Capability Manifest from existing
records and optional semantic metadata.

This phase should avoid schema-breaking backend changes. If backend storage is
needed, prefer one extensible metadata field per resource type rather than
separate hard-coded columns for every semantic concept.

Recommended storage shape:

```ts
type CapabilitySemanticMetadata = {
  intent?: string;
  useCases?: string[];
  antiUseCases?: string[];
  inputSemantics?: CapabilityInputSemantic[];
  outputSemantics?: CapabilityOutputSemantic[];
  examples?: CapabilityExample[];
  sideEffects?: CapabilitySideEffect;
  authRequirements?: string[];
  riskLevel?: CapabilityRiskLevel;
  agentVisibility?: AgentVisibility;
  agentInvokePolicy?: AgentInvokePolicy;
};
```

### Phase 2: Verification Evidence

Persist selected debug runs as verification evidence.

Recommended fields:

- capability ID
- source type and source ID
- input snapshot
- output summary
- status
- error summary
- duration
- verified by
- verified at

### Phase 3: Agent Discovery API / MCP

Expose the manifest through a stable Agent-facing interface:

- search capabilities by intent
- get manifest by capability ID
- get examples
- get latest verification result
- get invoke policy
- request a test call

This can later become an Execution Factory MCP server.

## Implementation Phases

### Phase 1: Design And Read-Only Manifest

Deliverables:

- Capability Manifest types.
- Source-to-manifest normalization helpers.
- Read-only semantic detail sections.
- Unit tests for mapping Tool / MCP / Skill / Operator records.

No backend mutation is required in this phase.

### Phase 2: Editable Semantics

Deliverables:

- UI to edit business intent, use cases, parameter meanings, output meanings,
  side effects, and Agent policy.
- Service layer changes to save semantic metadata.
- Validation for required semantic fields when Agent visibility is `callable`.

### Phase 3: Verification Evidence

Deliverables:

- Save debug result as example or verification evidence.
- Show latest verification status in list and detail pages.
- Mark stale verification when capability metadata changes after last verified
  run.

### Phase 4: Agent Discovery Surface

Deliverables:

- Capability search API or service facade.
- Agent-facing manifest endpoint.
- MCP exposure design for BKN Agent integration.

## Compatibility

The first implementation should not remove or rename existing routes:

- `/execution-factory/units`
- `/execution-factory/catalog`
- `/execution-factory/sandbox-runtime`
- toolbox, MCP, Skill, and operator detail routes

Existing actions must remain available:

- create
- edit
- debug
- publish
- offline
- import
- export
- market install
- market sync

The semantic layer is additive.

## Testing Strategy

Unit tests:

- manifest mapping from Tool record
- manifest mapping from MCP record and MCP tool schema
- manifest mapping from Skill record
- manifest mapping from Operator record
- Agent policy validation
- semantic completeness scoring

Component tests:

- detail overview renders semantic sections
- missing semantics show useful empty guidance
- risk and Agent policy badges render correctly
- schema-derived input rows can be enriched with business meaning

E2E tests:

- create or load a Tool, open detail, view Agent Usage section
- enrich parameter semantics, save, reload, and verify persistence
- run debug and save result as verification evidence
- filter list by Agent visibility and test status

Manual QA:

- verify HTTP API, OpenAPI import, MCP, Skill, Function, and Operator paths
- verify existing publish/import/export flows are not blocked by missing
  semantic metadata
- verify existing market install/sync still works

## Open Questions

1. Should semantic metadata be saved in each resource service or a new shared
   capability metadata service?
2. Should Agent visibility default to `hidden` or `discoverable` for newly
   published capabilities?
3. Should `auto_allowed` require at least one passed verification example?
4. Should write/external-action capabilities always require approval in the
   first production phase?

## Recommended First Issue Breakdown

1. Add read-only Capability Manifest normalization.
2. Add semantic overview sections to Tool detail first.
3. Extend MCP and Skill detail pages with the same read-only manifest pattern.
4. Add editable semantic metadata after the read-only structure is stable.
5. Add verification evidence after debug flows are confirmed stable.

## Implemented First Slice

The first implementation slice keeps the feature additive and read-only:

- Adds normalized Capability Manifest types.
- Adds pure mapping helpers for Tool, MCP tool, Skill, and Operator records.
- Adds readiness scoring based on intent, input semantics, output semantics,
  verified examples, verification status, and Agent policy.
- Adds a reusable Agent readiness panel.
- Shows the panel in the Tool detail workflow and MCP tool detail workflow.

The first slice intentionally does not persist editable semantic metadata or
debug verification evidence. Those remain follow-up slices after the UI
placement and manifest contract are validated.
