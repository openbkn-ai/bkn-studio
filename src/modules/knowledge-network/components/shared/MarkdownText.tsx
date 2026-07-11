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
  /** dark = 深色容器（如 antd 默认黑底 tooltip）下的配色。 */
  tone?: "dark" | "light";
};

/**
 * 描述类富文本的 Markdown 渲染（GFM）。样式自包含（不依赖 agent-chat 的
 * 主题变量），可用于卡片 tooltip、详情页概览等任意上下文。
 */
export const MarkdownText = memo(function MarkdownText({
  className,
  text,
  tone = "light",
}: MarkdownTextProps) {
  const classes = [styles.md, tone === "dark" ? styles.dark : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes}>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
});
