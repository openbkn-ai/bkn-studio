/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

describe("localized accessibility labels", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("switches navigation and canvas labels with the locale", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("common.back")).toBe("Back");
    expect(i18n.t("common.zoomIn")).toBe("Zoom in");
    expect(i18n.t("common.zoomOut")).toBe("Zoom out");
    expect(i18n.t("common.fitView")).toBe("Fit view");

    await i18n.changeLanguage("zh-CN");
    expect(i18n.t("common.back")).toBe("返回");
    expect(i18n.t("common.zoomIn")).toBe("放大");
    expect(i18n.t("common.zoomOut")).toBe("缩小");
    expect(i18n.t("common.fitView")).toBe("适应视图");
  });
});
