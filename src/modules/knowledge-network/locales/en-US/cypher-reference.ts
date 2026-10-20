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
      "MATCH pattern [WHERE condition] RETURN items [ORDER BY …] [SKIP n] [LIMIT n]",
      "Read-only: MATCH and RETURN are required; no CREATE, MERGE, SET, DELETE or REMOVE.",
      "Always write a LIMIT; SKIP and LIMIT take a non-negative integer.",
    ],
    notes: [""],
  },
  {
    title: "Nodes and relationships",
    rules: [
      "Write a node as (variable:ObjectType), by object type id; quote ids with special characters in backticks, as in (a:`my-type`).",
      "A node's first mention names its object type; a node has exactly one.",
      "Write a relationship as -[r:RELATION]-> or <-[:RELATION]-, naming exactly one relation type; no variable length [*1..3] and no <-->.",
      "Join several paths with commas or more MATCH clauses, linked by shared variables.",
      "OPTIONAL MATCH must start from a node already matched and follow one relationship to one new node.",
    ],
    notes: [
      "",
      "One continuous path",
      "Two paths joined by a comma",
      "Returns every a, with n = 0 where nothing is linked",
    ],
  },
  {
    title: "WHERE conditions",
    rules: [
      "Compare with = <> < <= > >=; not-equal is <>, never !=. Two properties can be compared, as in a.x <> a.y.",
      "IN takes a literal list: a.code IN ['A', 'B']; no null in the list.",
      "Strings: STARTS WITH, CONTAINS, ENDS WITH, against a string literal only.",
      "Nulls: IS NULL, IS NOT NULL; never = null.",
      "Combine with AND, OR, NOT and parentheses; no XOR and no chained a < b < c.",
      "Date-typed properties compare with date('2026-08-13') or datetime('2026-08-13T09:30:00'); no other functions.",
      "No aggregates in a condition.",
    ],
    notes: ["", "", ""],
  },
  {
    title: "RETURN, aggregates and ordering",
    rules: [
      "Return nodes, relationships or properties (a.name), renamed with AS; no RETURN * and no bare constants.",
      "A relationship variable is returned whole; no r.x.",
      "Aggregates: count(*), count(x), count(DISTINCT a.p), sum, avg, min, max, collect; no nesting.",
      "RETURN DISTINCT works on properties; ORDER BY a property, an aggregate or a returned column, never a node.",
    ],
    notes: ["", "", ""],
  },
  {
    title: "WITH",
    rules: [
      "WITH passes on one property (WITH DISTINCT a.p AS v) or one list (WITH collect(a.p) AS vs) to the next MATCH.",
      "An aggregate cannot be carried into the next MATCH, and a query with WITH cannot return whole nodes.",
    ],
    notes: [""],
  },
  {
    title: "How results show",
    rules: [
      "A result with nodes or relationships draws as a graph, with a table beside it; one without them shows as a table.",
      "Derived edge: return a AS source, 'NAME' AS relationType, b AS target per row, drawn as an orange dashed line between the two.",
      "Its count is the nodes collected in the row, a list's length or the first number column; rows for the same pair add up.",
      'Computed columns: scalars returned beside one node (count, sum and the like) stay with it, readable in its details and usable as its caption; with several nodes, name a column "<variable>_<name>" to attach it, the rest stay in the table.',
    ],
    notes: ["Derived edge with a count", "Nodes with computed columns"],
  },
  {
    title: "Not supported",
    rules: [
      "UNION, UNWIND, CALL { } subqueries, EXISTS subqueries.",
      "CASE, list and pattern comprehensions, functions other than date/datetime/localdatetime, ^.",
      "Variable-length paths, relationships with no or several types, two-way relationships, several labels on a node.",
      "DISTINCT or ORDER BY on nodes, aggregates in conditions, ordering by a constant or condition, positional parameters (use $name).",
    ],
  },
];
