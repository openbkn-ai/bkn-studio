/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const supportNoticeMarker = "__i18next_supportNoticeShown";

function clearSupportNoticeMarker() {
  Reflect.deleteProperty(globalThis, supportNoticeMarker);
}

describe("i18n configuration", () => {
  it("keeps the vendor support notice out of application and test logs", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      clearSupportNoticeMarker();
      vi.resetModules();

      await import("@/app/locales/i18n");

      expect(consoleInfo).not.toHaveBeenCalledWith(
        expect.stringContaining("i18next is made possible by our own product"),
      );
    } finally {
      consoleInfo.mockRestore();
      clearSupportNoticeMarker();
    }
  });
});

describe("document language synchronization", () => {
  afterEach(async () => {
    const { default: i18n } = await import("@/app/locales/i18n");
    await i18n.changeLanguage("zh-CN");
  });

  it("keeps the document language aligned when the UI locale changes", async () => {
    const { default: i18n } = await import("@/app/locales/i18n");
    await i18n.changeLanguage("en-US");

    expect(document.documentElement.lang).toBe("en-US");

    await i18n.changeLanguage("zh-CN");

    expect(document.documentElement.lang).toBe("zh-CN");
  });
});
