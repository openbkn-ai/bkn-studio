# Trace display range and Span browsing

The initial Trace detail request remains a single request. `span_display` describes
only the loaded graph window: at most 1,000 unique nodes from a bounded raw-record
read of up to 1,001 records. The existing summary cardinality is an estimate and
is labeled approximately; an absent total remains unknown. No extra first-screen
count query is made. The loaded window is sorted by start time, then Span ID; it
is not necessarily the globally earliest 1,000 Spans, especially for legacy
stored envelopes.

`trace_query_truncated` is a display-limit notice, not proof of missing
collection. Other partial reasons and Operation diagnostics remain visible.
`parent_outside_display` means the parent was not found in the loaded window;
it may not have been collected or may simply not have been loaded. This reason
alone proves neither state. Authorized paging can help inspect the records.
`span_scope_unavailable` describes a permission boundary; `span_unavailable`
retains its collection-gap meaning.

Only an explicit **Browse Span pages** action calls
`GET /api/agent-observability/v1/traces/{trace_id}/spans`. The server requires
trusted global raw Trace access. Each live page contains at most 100 unique
Spans sorted by Span ID, a different ordering from the graph. Pages replace the
current table; only cursor strings are retained for previous-page navigation.
An empty terminal page still permits returning to the previous page. Parents
may be outside the current page, so paging never creates inferred graph edges.
This is not a PIT snapshot: newly added records can be inspected by refreshing
from the first page. Closing or changing Trace cancels pending page requests.

Forbidden, unsupported legacy storage, invalid cursors, query budgets and
request failures receive explicit messages. Failed paging does not erase the
existing graph or Operation details. An older backend without `span_display`
shows its loaded-node count and no active paging entry. A positive, available
summary cardinality remains explicitly approximate; absent counts stay unknown.
The UI never invents a continuation cursor or assumes that the returned graph is full.

### Root-service candidates

The root-service filter preserves exact, case-sensitive manual values. Opening its candidate control explicitly requests `/api/agent-observability/v1/trace-root-services`; first render and typing while closed add no discovery requests. Candidates follow current access, time range and other draft filters, excluding the service filter and list pagination. Search fragments are matched by the server; returned canonical names are preserved. Results are bounded to 100 names, with a refinement hint when more are available. Selecting or typing only changes the draft until Query is pressed.

Closing, unmounting or changing other draft filters aborts and clears candidate requests. Empty candidates and failed/unsupported candidate APIs have distinct feedback; manual exact queries remain available, including with older backends. Candidates are never inferred from the current Trace page.
