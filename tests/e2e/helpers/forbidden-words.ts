/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Words a community image (no knowledge-base extension installed) must never show: the
 * professional edition's entries, badges and explanations. Studio only offers an upgrade for
 * an extension that is installed but not licensed, so with nothing installed none of these
 * appear. The list follows the prototype's `ceForbidden`, with the English wording added.
 */
export const COMMUNITY_FORBIDDEN = [
  /专业版/,
  /知识库/,
  /对象存储/,
  /抽取/,
  /表述类型/,
  /合并规则/,
  /证据强度/,
  /概念模型抽取/,
  /调试样本/,
  /验收样本/,
  /文档版本/,
  /\bprofessional\b/i,
  /\bknowledge[ -]?bases?\b/i,
  /\bobject storage\b/i,
  /\bextraction\b/i,
  /\bmerge rules?\b/i,
  /\bdocument versions?\b/i,
];

/**
 * Everything a reader can see on the page right now: the visible text of the whole document
 * (navigation, main content, open dialogs and drawers) and the hints that only show on hover
 * or to a screen reader (title, aria-label, placeholder).
 */
export async function visibleTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts = [document.body.innerText];
    for (const element of Array.from(
      document.body.querySelectorAll("[title], [aria-label], [placeholder]"),
    )) {
      const html = element as HTMLElement;
      // Hidden elements (closed menus, inactive tabs) are not on screen.
      if (!html.offsetParent && getComputedStyle(html).position !== "fixed") {
        continue;
      }
      for (const name of ["title", "aria-label", "placeholder"]) {
        const value = html.getAttribute(name);
        if (value) {
          texts.push(value);
        }
      }
    }
    return texts;
  });
}

/** Each forbidden word found, with up to 16 characters on either side. */
export function forbiddenHits(texts: string[], words: RegExp[] = COMMUNITY_FORBIDDEN): string[] {
  const hits = new Set<string>();
  for (const text of texts) {
    for (const word of words) {
      const global = new RegExp(`.{0,16}(?:${word.source}).{0,16}`, `g${word.flags}`);
      for (const match of text.matchAll(global)) {
        hits.add(match[0].replace(/\s+/g, " ").trim());
      }
    }
  }
  return [...hits];
}

/** Fails with every hit and where it was seen, so one run lists them all. */
export async function expectNoForbiddenWords(page: Page, where: string) {
  const hits = forbiddenHits(await visibleTexts(page));
  expect(hits, `${where} shows professional-edition wording`).toEqual([]);
}
