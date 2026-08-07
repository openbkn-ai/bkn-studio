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

/** 从 from 往前找最近的非空行。 */
function lastNonBlank(lines: readonly string[], from: number): string | undefined {
  for (let i = from; i >= 0; i--) {
    if (lines[i].trim() !== "") return lines[i];
  }
  return undefined;
}

/** 从 from 往后找最近的非空行。 */
function firstNonBlank(lines: readonly string[], from: number): string | undefined {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim() !== "") return lines[i];
  }
  return undefined;
}

/**
 * 把 Markdown 正文按块级边界（空行）切开。两处不切：
 * - 围栏代码块内部的空行；
 * - loose list 的项间空行（切了会变成两个 <ul>，有序列表还会重新从 1 编号）。
 *
 * 已知边界：正文主体是一个长的松散列表时（LLM 答复很常见的「1. …\n\n2. …」），
 * 整份列表始终是同一个尾块，那一段的重复 parse 并没有消掉，收益显著低于预期。
 * 这是 loose list 语义逼出来的取舍——切了就断编号——不比切分前差，但别拿
 * 「已经按块渲染了」当结论去排查这类答复的卡顿。真要根治得让已完成的项单独成块、
 * 并给续接块补 `start=`，成本远超收益。
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
      // 前后各扫一次找最近的非空行，不切数组：这函数在流式热路径上每个 token 跑一次，
      // 拷贝版本会给它自己加一个二次项。
      const prev = lastNonBlank(cur, cur.length - 1);
      const next = firstNonBlank(lines, i + 1);
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
  // 行内语法按「当前正在写的这一段」配对，而不是只看最后一行：加粗/行内代码都可以跨行，
  // 只扫最后一行会漏掉 `**开头在上一行、还没闭合` 这种，正是本该消掉的症状。
  // 段落 = 尾块里最后一个空行之后的全部行（loose list 尾块里就是最后那个列表项）。
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === "") {
      start = i + 1;
      break;
    }
  }
  const para = lines.slice(start);
  if (para.length === 0 || para.join("").trim() === "") return block;
  // 段里出现围栏行（列表项内嵌的代码块）就不配对：那些反引号会把计数带偏，
  // 补错比不补更糟。
  if (para.some((l) => FENCE_RE.test(l))) return block;

  const text = para.join("\n");
  let tail = "";
  // 先补加粗再补行内代码：**`x 的闭合顺序是 `** 反过来。
  if (countOccurrences(text, "**") % 2 === 1) tail = `**${tail}`;
  const backticks = countOccurrences(text, "`") - countOccurrences(text, "``") * 2;
  if (backticks % 2 === 1) tail = `\`${tail}`;
  return tail ? block + tail : block;
}
