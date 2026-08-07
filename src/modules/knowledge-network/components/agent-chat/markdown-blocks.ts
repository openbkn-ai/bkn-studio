/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 流式 Markdown 的分块与尾块补全。
 *
 * 为什么要分块：react-markdown 每次渲染都会把整段正文重新 parse 成 mdast，
 * 流式下每来一个 token 就重来一次 = O(n²)，长答复直接卡死 UI。把正文切成
 * 「已经写完的块」+「正在写的尾块」，稳定块用 memo 挡住重渲，只有尾块重 parse，
 * 总成本回到 O(n)。
 */

/** 围栏行：``` 或 ~~~（允许最多 3 空格缩进）。 */
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
/** 列表项行：- * + 或 1. 1)。 */
const LIST_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/;
/** 列表项的续行（缩进 2 空格以上或 tab）。 */
const LIST_CONT_RE = /^(?: {2,}|\t)\S/;

function isListish(line: string): boolean {
  return LIST_RE.test(line) || LIST_CONT_RE.test(line);
}

/**
 * 把 Markdown 正文按块级边界（空行）切开。两处不切：
 * - 围栏代码块内部的空行；
 * - loose list 的项间空行（切了会变成两个 <ul>，有序列表还会重新从 1 编号）。
 */
export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (cur.length > 0) {
      blocks.push(cur.join("\n"));
      cur = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (fence !== null) {
      cur.push(line);
      const closing = FENCE_RE.exec(line);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }

    const opening = FENCE_RE.exec(line);
    if (opening) {
      fence = opening[1];
      cur.push(line);
      continue;
    }

    if (line.trim() === "") {
      // 空行是块边界，除非它夹在同一个 loose list 的两个列表项之间。
      const prev = [...cur].reverse().find((l) => l.trim() !== "");
      const next = lines.slice(i + 1).find((l) => l.trim() !== "");
      if (prev && next && isListish(prev) && isListish(next)) {
        cur.push(line);
        continue;
      }
      flush();
      continue;
    }

    cur.push(line);
  }

  flush();
  return blocks;
}

/** 正文里是否还有没闭合的围栏；有则返回该补的闭合标记。 */
function openFenceMarker(text: string): string | null {
  let fence: string | null = null;
  for (const line of text.split("\n")) {
    const m = FENCE_RE.exec(line);
    if (!m) continue;
    if (fence === null) fence = m[1];
    else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
  }
  return fence;
}

function countOccurrences(line: string, token: string): number {
  let n = 0;
  let at = line.indexOf(token);
  while (at !== -1) {
    n += 1;
    at = line.indexOf(token, at + token.length);
  }
  return n;
}

/**
 * 尾块补全：流式尾巴常停在半个语法上（``` 只开了头、`code 少一个反引号、
 * **加粗 少两个星号），直接渲染会闪一下裸文本。补上闭合再渲染。
 * 只补，不改原文——补出来的字符下一个 token 到了就被真实内容覆盖。
 */
export function closeOpenMarkdown(block: string): string {
  const fence = openFenceMarker(block);
  if (fence !== null) return `${block}${block.endsWith("\n") ? "" : "\n"}${fence}`;

  const lines = block.split("\n");
  const last = lines[lines.length - 1];
  // 围栏行本身（``` 收尾）不参与行内语法配对，否则那三个反引号会被当成没闭合的行内代码。
  if (last.trim() === "" || FENCE_RE.test(last)) return block;

  let tail = "";
  // 先补加粗再补行内代码：**`x 的闭合顺序是 `** 反过来。
  if (countOccurrences(last, "**") % 2 === 1) tail = `**${tail}`;
  const backticks = countOccurrences(last, "`") - countOccurrences(last, "``") * 2;
  if (backticks % 2 === 1) tail = `\`${tail}`;
  return tail ? block + tail : block;
}
