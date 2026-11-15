/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ReactNode } from "react";

import styles from "./JsonTextBlock.module.css";

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
    if (token.startsWith('"')) {
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

export function JsonTextBlock({
  text,
  className,
  maxHeight,
}: {
  text: string;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <pre
      className={[styles.block, className].filter(Boolean).join(" ")}
      style={maxHeight === undefined ? undefined : { maxHeight, overflow: "auto" }}
    >
      {highlight(text)}
    </pre>
  );
}
