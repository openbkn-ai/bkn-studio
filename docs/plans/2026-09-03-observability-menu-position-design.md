# Observability Menu Position Design

## Goal

Place the Observability top-level menu after General Business Knowledge Network
(which contains the data-resource entry) and before Model Resources.

## Decision

Use the existing contribution anchor mechanism. Change only
`bknTraceNavigation.afterKey` from `model-resources` to
`general-business-knowledge-network`.

This keeps menu ownership unchanged, preserves all permissions and routes, and
does not affect the System Management menu.

## Verification

Update the focused navigation test to assert the order:

`general-business-knowledge-network` → `observability` → `model-resources` →
`system-management`.
