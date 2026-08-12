# BKN Trace Standalone HTML Design

## Goal

Provide a reviewable BKN Trace high-fidelity prototype that opens without Studio authentication, edition checks, backend proxies, or API availability.

## Decision

Create one self-contained file at `public/bkn-trace-prototype.html`. It embeds all HTML, CSS, JavaScript, and the verified snapshot of conversation `conv_73fc12a00ac46933c3d8015616a1b1b3`.

The file must work in two ways:

- direct file open through `file://`;
- Vite static serving at `/studio/bkn-trace-prototype.html`.

## Interaction

The standalone page preserves the approved prototype model:

- **时间链视图**: two real interactions and nine chronological operations;
- **知识网络视图**: knowledge network, observed objects, real context relations, and adjacent objects;
- **shared right detail panel**: selection details, query condition, result, reproducible SQL, and technical information;
- **collapsible detail panel**;
- `search_schema` results remain exploration candidates rather than evidence.

## Data Boundary

Only verified facts already used by the React prototype are embedded. Unknown request and operation identifiers are omitted. The only displayed technical identifiers are those known from the real trace or BKN definition.

## Technical Boundary

- No imports, external fonts, images, libraries, or module scripts.
- No `fetch`, `XMLHttpRequest`, WebSocket, or `/api/` references.
- No changes to production navigation or capability checks.
- No attempt to share runtime code with the React prototype; this is a disposable review artifact, not a second production implementation.

## Verification

- A static contract test checks the conversation ID, both view controls, real operation count, and absence of network APIs.
- The file is opened through Vite and checked for HTTP 200.
- The file can be opened directly from disk.
