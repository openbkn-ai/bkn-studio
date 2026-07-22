/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import styles from "./JsonCodeBlock.module.css";

type JsonCodeBlockProps = {
  value: unknown;
  className?: string;
};

// Dependency-free JSON syntax highlighter. Tokenizes a pretty-printed JSON
// string and wraps strings / keys / numbers / literals in classed spans so the
// stylesheet can theme them. Kept intentionally small — Monaco is overkill for
// a read-only preview.
const TOKEN_PATTERN =
  /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlight(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(json)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(json.slice(lastIndex, match.index));
    }

    const token = match[0];
    let className = styles.number;
    if (token.startsWith("\"")) {
      className = match[2] ? styles.key : styles.string;
    } else if (token === "true" || token === "false") {
      className = styles.boolean;
    } else if (token === "null") {
      className = styles.null;
    }

    nodes.push(
      <span className={className} key={key}>
        {token}
      </span>,
    );
    key += 1;
    lastIndex = match.index + token.length;
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}

function toPretty(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function JsonCodeBlock({ value, className }: JsonCodeBlockProps) {
  const pretty = toPretty(value);
  const blockClassName = [styles.block, className].filter(Boolean).join(" ");

  if (pretty === null) {
    return <pre className={blockClassName}>-</pre>;
  }

  return <pre className={blockClassName}>{highlight(pretty)}</pre>;
}
