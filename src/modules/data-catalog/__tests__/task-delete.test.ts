/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import { dataCatalogEnUS } from "../locales/en-US";
import { dataCatalogZhCN } from "../locales/zh-CN";

describe.each(["en-US", "zh-CN"])("task deletion titles (%s)", (language) => {
  it.each([1, 2])("names each task type for count=%s", async (count) => {
    const i18n = createInstance();
    await i18n.init({
      lng: language,
      resources: {
        "en-US": { translation: dataCatalogEnUS },
        "zh-CN": { translation: dataCatalogZhCN },
      },
    });
    expect(i18n.t("dataCatalog.task.batchDeleteConfirmContent")).toBe(
      language === "en-US"
        ? "Deleted task records cannot be recovered."
        : "删除后任务记录不可恢复。",
    );
    for (const [key, en, zh] of [
      ["batchDeleteDiscoveryConfirmTitle", "discovery", "探查"],
      ["batchDeleteSemanticConfirmTitle", "semantic understanding", "语义理解"],
      ["batchDeleteConfirmTitle", "build", "构建"],
    ]) {
      expect(i18n.t(`dataCatalog.task.${key}`, { count })).toBe(
        language === "en-US"
          ? `Delete ${count} ${en} task${count === 1 ? "" : "s"}`
          : `批量删除 ${count} 个${zh}任务`,
      );
    }
  });
});
