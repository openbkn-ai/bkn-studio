# Execution Factory HTTP Tool Lifecycle UI Design

## Issue

GitHub issue: https://github.com/openbkn-ai/bkn-studio/issues/90

## Problem

Execution Factory currently gives users a polished guided flow when creating HTTP API tools, but a different raw configuration page when they later view or edit the same tool. This breaks the user's mental model:

- Creation is business-oriented: cURL/form input, generated API preview, toolbox placement, and next actions.
- Editing is configuration-oriented: raw OpenAPI, global parameters, and IO/debug blocks.
- The same resource feels like a different product after saving.

For an enterprise product, the same capability should keep a stable information architecture across create, view, edit, debug, and publish.

## First Phase Scope

Only HTTP API / Tool lifecycle continuity is in scope for this phase.

In scope:

- Align HTTP API tool edit UI with the creation UI structure.
- Keep generated IO preview visible in a predictable place.
- Keep raw OpenAPI and global parameters available as advanced configuration.
- Preserve existing debug and save behavior.
- Improve wording and layout so the screen feels like a professional capability management surface.

Out of scope for this phase:

- Rewriting MCP, Skill, Toolbox, or Operator pages.
- Backend schema changes.
- Changing publish or marketplace logic.

## Desired User Mental Model

The user should think:

1. "This is the same HTTP API tool I created."
2. "The important business fields are still at the top."
3. "I can verify its request and response shape without reading raw OpenAPI."
4. "If I need low-level control, I can open Advanced configuration."
5. "Debug, save, and return actions are predictable."

## UI Structure

The HTTP API tool surface should use these sections:

1. Capability summary
   - Tool name
   - Description
   - Usage rules
   - Metadata type shown as read-only context

2. Interface preview
   - Request parameters
   - Request body
   - Response examples
   - Recent debug results if available

3. Advanced configuration
   - Raw OpenAPI spec
   - Global parameters
   - Function definition for function tools

4. Actions
   - Back/cancel
   - Debug
   - Save

## Design Principles

- Same information order across create and edit.
- Read-only or disabled state should come from mode, not a separate user journey.
- Advanced/raw configuration should not be the first thing users see.
- Status and success colors should be restrained and consistent with the current UI token style.
- Existing APIs and route behavior should remain stable.

## Acceptance Criteria

- Editing an HTTP API tool starts with business fields and IO preview, not raw OpenAPI.
- Raw OpenAPI is still available under an advanced section.
- Global parameters remain available under advanced configuration.
- Debug action remains available from the edit page.
- Existing tests for quick API creation still pass.
- A new component-level test verifies the HTTP tool lifecycle layout order.

