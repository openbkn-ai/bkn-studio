/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { enUS } from "@/app/locales/resources/en-US";
import { zhCN } from "@/app/locales/resources/zh-CN";

import { ApiCatalogConnectionTestModal } from "./ApiCatalogConnectionTestModal";

describe.each([
  { language: "zh-CN", closeText: "关闭" },
  { language: "en-US", closeText: "Close" },
])("API connection test translations ($language)", ({ language, closeText }) => {
  it("renders a translated footer close button and keeps it active during a test", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: language,
      fallbackLng: "en-US",
      resources: { "zh-CN": { translation: zhCN }, "en-US": { translation: enUS } },
      interpolation: { escapeValue: false },
    });
    const onClose = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ApiCatalogConnectionTestModal
          saved={false}
          defaultScope="draft"
          canTestDraft
          canTestSaved={false}
          loading
          result={null}
          revision={0}
          onRun={vi.fn()}
          onClose={onClose}
        />
      </I18nextProvider>,
    );

    expect(screen.queryByText("common.close")).not.toBeInTheDocument();
    // Ant Design inserts a space between two Chinese characters in button text.
    const closeName = new RegExp(`^${closeText.split("").join("\\s*")}$`);
    const button = screen.getByText(closeName).closest("button");
    expect(button).toHaveAccessibleName(closeName);
    expect(button).toBeEnabled();
    fireEvent.click(button!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
