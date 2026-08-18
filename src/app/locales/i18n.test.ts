/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";

describe("document language synchronization", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("keeps the document language aligned when the UI locale changes", async () => {
    await i18n.changeLanguage("en-US");

    expect(document.documentElement.lang).toBe("en-US");

    await i18n.changeLanguage("zh-CN");

    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
