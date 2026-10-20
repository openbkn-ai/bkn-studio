/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * The Cypher the data query page can run: the read-only subset bkn-backend accepts
 * (`adp/bkn/bkn-backend/server/logics/cypher`), plus how the page shows the result.
 *
 * Every example was run against the live backend. Names are placeholders in the shape of a real
 * network (`ObjectType`, `RELATION`, `property`), so an example filled into the editor is a
 * starting point to rename, not a query that runs as it is.
 */

import { cypherReferenceEnUS } from "@/modules/knowledge-network/locales/en-US/cypher-reference";
import { cypherReferenceZhCN } from "@/modules/knowledge-network/locales/zh-CN/cypher-reference";

export type ReferenceExample = { query: string; note?: string };
export type ReferenceSection = {
  title: string;
  /** Plain lines; one rule each. */
  rules: string[];
  examples?: ReferenceExample[];
};

/** One language's text for the reference, section by section in the order of `EXAMPLES`. */
export type CypherReferenceTexts = { title: string; rules: string[]; notes?: string[] }[];

/** Each section's example queries; the same in every language. */
const EXAMPLES: string[][] = [
  ["MATCH (a:ObjectType) RETURN a LIMIT 25"],
  [
    "MATCH (a:ObjectType)-[r:RELATION]->(b:OtherType) RETURN a, r, b LIMIT 25",
    "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType)-[:RELATION_B]->(c:ThirdType)\nRETURN a, b, c LIMIT 25",
    "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType), (b)-[:RELATION_B]->(c:ThirdType)\nRETURN a, c LIMIT 25",
    "MATCH (a:ObjectType)\nOPTIONAL MATCH (a)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n LIMIT 25",
  ],
  [
    "MATCH (a:ObjectType)\nWHERE a.status <> 'closed' AND a.code IN ['A', 'B']\nRETURN a LIMIT 25",
    "MATCH (a:ObjectType)\nWHERE a.name STARTS WITH 'Bra' OR a.name CONTAINS 'many'\nRETURN a LIMIT 25",
    "MATCH (a:ObjectType) WHERE a.amount > 80 AND a.owner IS NOT NULL RETURN count(*) AS n",
  ],
  [
    "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n, count(DISTINCT b.owner) AS owners, max(b.amount) AS top\nLIMIT 25",
    "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a.name AS name, count(b) AS n\nORDER BY n DESC SKIP 5 LIMIT 5",
    "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType) RETURN a, collect(b.id) AS ids LIMIT 25",
  ],
  [
    "MATCH (a:ObjectType) WHERE a.name = 'X'\nWITH collect(a.id) AS ids\nMATCH (b:OtherType) WHERE b.owner_id IN ids\nRETURN count(*) AS n",
  ],
  [
    "MATCH (a:ObjectType)<-[:RELATION_A]-(b:OtherType)-[:RELATION_B]->(c:ThirdType)\nRETURN a AS source, 'LINKED_TO' AS relationType, c AS target, count(b) AS n\nLIMIT 25",
    "MATCH (a:ObjectType)<-[:RELATION]-(b:OtherType)\nRETURN a, count(b) AS n, max(b.amount) AS top\nORDER BY n DESC LIMIT 25",
  ],
  [],
];

/** The reference in the reader's language. */
export function cypherReference(language: string): ReferenceSection[] {
  const texts = language.toLowerCase().startsWith("zh") ? cypherReferenceZhCN : cypherReferenceEnUS;
  return texts.map((section, index) => {
    const queries = EXAMPLES[index] ?? [];
    return {
      title: section.title,
      rules: section.rules,
      ...(queries.length > 0
        ? {
            examples: queries.map((query, at) => {
              const note = section.notes?.[at];
              return { query, ...(note ? { note } : {}) };
            }),
          }
        : {}),
    };
  });
}
