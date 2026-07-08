/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type ResourceScope = {
  database?: string;
  schema?: string;
};

const TOKEN_RE = /[A-Za-z0-9_]+/g;

function firstIdentifierToken(input: string) {
  const match = input.match(TOKEN_RE);
  return match?.[0] ?? "";
}

/**
 * Best-effort parse database/schema from a resource source identifier.
 *
 * Supported:
 * - "db.table"              => { database: "db" }
 * - "db.schema.table"       => { database: "db", schema: "schema" }
 * - "schema.table"          => { database: "schema" } (treat as db bucket for UI grouping)
 * - "SELECT ... FROM db.tbl" / "SELECT ... FROM schema.tbl" => tries to extract token after FROM.
 */
export function parseResourceScope(sourceIdentifier: string): ResourceScope {
  const raw = (sourceIdentifier ?? "").trim();
  if (!raw) {
    return {};
  }

  // SQL snippet: try to detect `FROM xxx.yyy` or `FROM xxx.yyy.zzz`
  const fromMatch = raw.match(/\bfrom\s+([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+){0,2})/i);
  const scopeCandidate = fromMatch?.[1] ?? raw;

  const parts = scopeCandidate
    .split(".")
    .map((part) => firstIdentifierToken(part.trim()))
    .filter(Boolean);

  if (parts.length >= 3) {
    return { database: parts[0], schema: parts[1] };
  }

  if (parts.length >= 2) {
    return { database: parts[0] };
  }

  return {};
}

