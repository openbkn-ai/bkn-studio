/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { useEffect, useState } from "react";

import { useResolvedTheme } from "@/app/theme/theme-context";

import styles from "./MarkdownText.module.css";

type Mermaid = (typeof import("mermaid"))["default"];

// Loaded on the first diagram only: most text has none, and the library is large.
let loading: Promise<Mermaid> | null = null;
function loadMermaid(): Promise<Mermaid> {
  loading ??= import("mermaid").then((module) => module.default);
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

// Mermaid keeps one configuration for the page, so diagrams are drawn one at a time.
let queue: Promise<unknown> = Promise.resolve();
let sequence = 0;

// Drawn SVGs by theme and source, so a diagram that renders again shows at once: a streamed
// answer is parsed whole when it completes, which mounts its diagrams anew.
const KEPT = 50;
const drawnSvgs = new Map<string, string>();

function keep(key: string, svg: string) {
  drawnSvgs.delete(key);
  drawnSvgs.set(key, svg);
  for (const oldest of drawnSvgs.keys()) {
    if (drawnSvgs.size <= KEPT) break;
    drawnSvgs.delete(oldest);
  }
}

function diagramKey(source: string, dark: boolean): string {
  return `${dark ? "dark" : "light"}:${source}`;
}

/** A diagram's SVG, drawn in the page's theme; rejects when the source is not valid. */
function draw(source: string, dark: boolean): Promise<string> {
  const key = diagramKey(source, dark);
  const next = queue.then(async () => {
    // Asked for again while it was waiting its turn.
    const kept = drawnSvgs.get(key);
    if (kept !== undefined) return kept;
    const mermaid = await loadMermaid();
    // strict: text stays text (no HTML labels, no click handlers), and the SVG is sanitized.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
    });
    await mermaid.parse(source);
    const id = `bkn-mermaid-${(sequence += 1)}`;
    try {
      const { svg } = await mermaid.render(id, source);
      keep(key, svg);
      return svg;
    } finally {
      // A failed render can leave its scratch element in the page.
      document.getElementById(`d${id}`)?.remove();
    }
  });
  queue = next.catch(() => undefined);
  return next;
}

/**
 * A ```mermaid block drawn as a diagram. Until it is drawn, and when its source is not a valid
 * diagram, it shows the source as written.
 */
export function MermaidDiagram({ source }: { source: string }) {
  const dark = useResolvedTheme() === "dark";
  const [drawn, setDrawn] = useState<{ key: string; svg: string } | null>(null);
  const key = diagramKey(source, dark);
  const svg = drawn?.key === key ? drawn.svg : drawnSvgs.get(key);

  useEffect(() => {
    if (drawnSvgs.has(key)) return;
    let live = true;
    draw(source, dark).then(
      (drawnSvg) => {
        if (live) setDrawn({ key, svg: drawnSvg });
      },
      () => {
        if (live) setDrawn(null);
      },
    );
    return () => {
      live = false;
    };
  }, [dark, key, source]);

  if (svg === undefined)
    return (
      <pre>
        <code className="language-mermaid">{source}</code>
      </pre>
    );
  return (
    <div
      className={styles.mermaid}
      role="img"
      // The SVG comes from Mermaid in strict mode, which sanitizes what it outputs.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
