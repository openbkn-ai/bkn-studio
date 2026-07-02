# Capability Create Menu Design

## Goal

Unify the Execution Factory capability creation entry so the top-right button and empty-state button expose the same business-oriented creation choices.

## Scope

This change implements issue #21's core menu and entry consistency requirements:

- Use one menu configuration for all capability creation entry points.
- Group choices by user intent: HTTP / API, MCP, Skill / Function, and capability package.
- Preserve existing create flows: quick HTTP API, OpenAPI import, MCP registration, Skill import, Function toolset creation, and ADP import.
- Keep the empty-state ADP shortcut out of scope for this pass unless it already exists in the page; the unified menu includes ADP import.

The larger follow-up requirements for full field guidance, built-in capability lifecycle, examples, and terminology cleanup are documented in the issue but are not fully implemented here. Existing forms already contain some business helper text; this pass avoids broad form rewrites.

## Entry Recommendation

The primary product entry remains the Capability Library page:

- Top-right `Add Capability` button.
- Empty-state `Add Capability` button.

Both entries should render the same dropdown menu before opening a drawer or modal. This makes the page feel consistent whether users are creating their first capability or adding another one later.

## Interaction

Selecting a menu item opens the existing flow directly:

- Add HTTP API -> `AddCapabilityWizard` in quick API mode.
- Import OpenAPI -> `AddCapabilityWizard` in OpenAPI import mode.
- Register MCP service -> `AddCapabilityWizard` in MCP mode.
- Import Skill -> `AddCapabilityWizard` in Skill mode.
- Add Function capability -> `AddCapabilityWizard` in Function mode.
- Import ADP package -> `ImportResourceModal` in ADP mode.

The dropdown itself replaces the old mode-picker-first behavior for these two entry points. If a flow is opened from a deep link or context-specific page, the existing wizard behavior remains available.

## Architecture

Add a pure menu model under `src/modules/execution-factory/utils/` so tests can verify grouping and item consistency without rendering Ant Design components. `CreateMenu` renders that model with Ant Design `Dropdown` and owns the existing drawer/modal state.

`ExecutionUnitListScene` uses `CreateMenu` in two places:

- Toolbar mode for the page actions.
- Empty-state mode for the zero-data CTA.

Both instances call the same component and therefore share the same menu.

## Testing

Unit tests cover:

- The menu has the required four groups in order.
- The menu includes all required creation paths.
- Top toolbar and empty-state menu models are identical because both come from the same exported helper.
- ADP import resolves to an import-capable tab when the current tab is Skill.

Manual QA should verify that each menu item opens the expected drawer or import modal.
