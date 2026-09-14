/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { promptFromPersisted, promptToPersist } from "./agent-chat.service";

const V1 = "你是检索助手。需要数据时调用 search_schema / query_object_instance。";
const V2 = "你是检索助手。先弄清结构再取数，检索工具是主路。";

describe("system prompt persistence", () => {
  /**
   * The reason this exists: storing the prompt unconditionally froze whichever
   * default was current when the pane was first used, and the restore path only
   * fell back when the key was absent. Shipping a better default then reached
   * nobody who had already opened the pane.
   */
  it("carries a later default through to a user who never edited the prompt", () => {
    const stored = promptToPersist(V1, V1);

    expect(promptFromPersisted(stored, V2)).toBe(V2);
  });

  it("keeps an edited prompt across a change of default", () => {
    const edited = "只用 run_sql 回答。";
    const stored = promptToPersist(edited, V1);

    expect(stored).toBe(edited);
    expect(promptFromPersisted(stored, V2)).toBe(edited);
  });

  it("treats an absent or blank stored prompt as the default", () => {
    expect(promptFromPersisted(undefined, V2)).toBe(V2);
    expect(promptFromPersisted("", V2)).toBe(V2);
    expect(promptFromPersisted("   \n ", V2)).toBe(V2);
  });
});
