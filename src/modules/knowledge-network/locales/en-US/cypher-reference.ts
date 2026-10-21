/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CypherReferenceTexts } from "@/modules/knowledge-network/cypher/cypher-reference";

/** The syntax reference's text; `notes` line up with each section's examples ("" for none). */
export const cypherReferenceEnUS: CypherReferenceTexts = [
  {
    title: "Query shape",
    rules: [
      "MATCH pattern [WHERE condition] RETURN items [ORDER BY …] [SKIP n] [LIMIT n]; a query may open with WITH ['a', 'b'] AS codes to name constants for its conditions.",
      "Read-only: RETURN is required; no CREATE, MERGE, SET, DELETE or REMOVE.",
      "Without LIMIT a query returns at most 1000 rows, and LIMIT is capped at 10000; a query holds at most 8 relationships and 9 nodes.",
    ],
    notes: ["", "Constants up front"],
  },
  {
    title: "Nodes and relationships",
    rules: [
      "Write a node as (variable:ObjectType), by object type id; quote ids with special characters in backticks, as in (a:`my-type`). A node's first mention names its object type and may carry an inline property map {prop: value}.",
      "Write a relationship as -[r:RELATION]->, <-[r:RELATION]- or undirected -[r:RELATION]-, naming exactly one relation type. Name it and return it, or the graph draws no line.",
      "Join paths with commas or more MATCH clauses; a variable written twice is the same node, and paths sharing no variable are combined pairwise.",
      "OPTIONAL MATCH writes one relationship attaching one new node to a node already found: when nothing matches, the row stays and the new node is empty. What it introduces may not be required again by a later MATCH or WHERE.",
    ],
    notes: [
      "",
      "An inline property finds one object",
      "One continuous path, every relationship named",
      "Two paths joined by a comma",
      "Returns every a, with n = 0 where nothing is linked",
    ],
  },
  {
    title: "WHERE conditions",
    rules: [
      "Compare with = <> < <= > >=; not-equal is <>, never !=. Both sides may be properties, as in a.x <> a.y, or arithmetic, as in a.amount * a.rate > 100.",
      "IN takes a list: a.code IN ['A', 'B'], or a parameter IN $list.",
      "Strings: STARTS WITH, CONTAINS, ENDS WITH, on string properties only, matched as a literal substring; % and _ are not wildcards.",
      "Nulls: IS NULL, IS NOT NULL; never = null.",
      "Combine with AND, OR, NOT and parentheses; no XOR. Dates are written date('2026-08-13').",
    ],
    notes: ["", "", ""],
  },
  {
    title: "RETURN, aggregates and ordering",
    rules: [
      "Return nodes, relationships or properties (a.name), renamed with AS; a condition can be a column too, valued true, false or null.",
      "Aggregates: count(*), count(x), count(DISTINCT a.p), sum, avg, min, max. There is no GROUP BY: aggregating groups by the other returned columns.",
      "collect(x) gathers each group into a list and {k: v} builds a map; collect cannot be returned beside count, sum and the like, so count in a query of its own.",
      "Arithmetic + - * / %: dividing two integers is refused, so multiply one side by 1.0 for a fraction; % takes integers.",
      "CASE WHEN … THEN … ELSE … END and coalesce(a, b): the branches are all numbers or all non-numbers.",
      "DISTINCT and ORDER BY apply to properties, aggregates and returned columns, not to nodes and relationships themselves, which already group by identity. After an aggregate or DISTINCT, order only by a returned value.",
    ],
    notes: ["", "", "CASE counts and an arithmetic share", ""],
  },
  {
    title: "WITH",
    rules: [
      "Filter after aggregating: after every MATCH, as in WITH a, count(*) AS n WHERE n > 100, then RETURN; more WITHs may compute and filter, and only the first one aggregates (except the second WITH's collect when comparing two lists). After a WITH that aggregates, RETURN may instead hold only aggregates such as count(*) over the groups, returning one row.",
      "After a WITH, RETURN may return the nodes it passed on, for instance to draw the filtered groups as derived edges.",
      "Pass one property's values to the next MATCH: WITH DISTINCT a.p AS v (or collect(a.p) AS vs), then MATCH … WHERE b.q = v (or b.q IN vs); no WITH may follow.",
      "Compare two lists (a different form from passing values to the next MATCH above): each of two stages collects one property, and the second WITH passes the first list on and collects the second; RETURN holds only size(l1), size(l2) and the shared count size([x IN l1 WHERE x IN l2]), as one row, and cannot return the lists themselves.",
      "Pass nodes on to the next MATCH: WITH a, count(b) AS total, then MATCH (a)-…, which may aggregate again, with total usable in RETURN and ORDER BY; when the query aggregates, return total as a column of its own wherever it is used. A WITH that does not aggregate passes each node on once per matched row, which multiplies the counts.",
    ],
    notes: [
      "Filter after aggregating",
      "Pass values to the next MATCH",
      "Compare two lists",
      "Pass nodes on to the next MATCH, drawn as derived edges with a count",
    ],
  },
  {
    title: "How results show",
    rules: [
      "A result with nodes or relationships draws as a graph, with a table beside it; one without them shows as a table. Nodes returned without their relationships draw no lines.",
      "Derived edge: return a AS source, 'NAME' AS relationType, b AS target per row, drawn as an orange dashed line between the two.",
      "Its count is the nodes collected in the row (as in collect({via: c}) AS evidence), a list's length or the first number column; rows for the same pair add up.",
      'Computed columns: scalars returned beside one node (count, sum and the like) stay with it, readable in its details and usable as its caption; with several nodes, name a column "<variable>_<name>" to attach it, the rest stay in the table.',
    ],
    notes: [
      "Derived edge with a count",
      "Derived edge with evidence",
      "Nodes with computed columns",
    ],
  },
  {
    title: "Not supported",
    rules: [
      "UNION, UNWIND, variable-length paths [:R*1..3], XOR, exponentiation ^, relationship properties r.x.",
      "Function calls other than date(), coalesce(), size() (on a list a WITH collected) and the aggregates.",
      "MATCH after a second WITH; collect after a WITH that aggregates (except the second WITH's collect when comparing two lists).",
      "DISTINCT on nodes or relationships (RETURN DISTINCT n, collect(DISTINCT n)) and ordering by them; collect beside count, sum and other aggregates.",
    ],
  },
];
