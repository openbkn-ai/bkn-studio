/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { memo, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { closeOpenMarkdown, splitMarkdownBlocks } from "./markdown-blocks";
import styles from "./MarkdownText.module.css";

type MarkdownTextProps = {
  className?: string;
  text: string;
  /** dark = colors for dark containers, such as AntD's default black tooltip. */
  tone?: "dark" | "light";
  /**
   * compact = a description inside a card or tooltip (default); document = a full document such
   * as a skill package's SKILL.md, with body and headings each one size larger and square corners
   * aligned with the rest of the site's panels.
   */
  variant?: "compact" | "document";
  /**
   * The text is still arriving (a streamed answer): it renders by block and closes the open tail,
   * so each token reparses only the last block.
   */
  streaming?: boolean;
};

/** One Markdown block. memo keeps stable blocks from reparsing while text streams in. */
const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {
  return <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>;
});

/**
 * The one Markdown renderer across the app (GFM), for descriptions and streamed answers alike. Its styles are self-contained and do not
 * depend on agent-chat theme variables, so it works in cards, tooltips, detail overviews, and more.
 */
export const MarkdownText = memo(function MarkdownText({
  className,
  text,
  tone = "light",
  variant = "compact",
  streaming = false,
}: MarkdownTextProps) {
  const blocks = useMemo(() => {
    // Complete text is parsed whole, keeping what spans blocks (reference links, footnotes).
    if (!streaming) return null;
    const parts = splitMarkdownBlocks(text);
    if (parts.length === 0) return parts;
    return [...parts.slice(0, -1), closeOpenMarkdown(parts[parts.length - 1])];
  }, [text, streaming]);
  const classes = [
    styles.md,
    tone === "dark" ? styles.dark : "",
    variant === "document" ? styles.doc : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      {blocks === null ? (
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      ) : (
        blocks.map((block, index) => <MarkdownBlock key={index} text={block} />)
      )}
    </div>
  );
});
