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
`parent_outside_display` explains a parent outside the loaded window.
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
shows its loaded-node count, an unknown total and no active paging entry; the UI
never invents a continuation cursor or assumes that the returned graph is full.
