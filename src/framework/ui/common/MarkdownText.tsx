/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
};

/**
 * Markdown renderer for descriptive rich text (GFM). Its styles are self-contained and do not
 * depend on agent-chat theme variables, so it works in cards, tooltips, detail overviews, and more.
 */
export const MarkdownText = memo(function MarkdownText({
  className,
  text,
  tone = "light",
  variant = "compact",
}: MarkdownTextProps) {
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
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
});
