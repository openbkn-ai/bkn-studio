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
  {
    language: "zh-CN",
    closeText: "关闭",
    loginHint: /执行一次登录/,
    transportHint: /仅检查 TCP\/TLS 连通性/,
    resourceHint: /业务响应与字段映射/,
  },
  {
    language: "en-US",
    closeText: "Close",
    loginHint: /runs one login/,
    transportHint: /checks TCP\/TLS reachability only/,
    resourceHint: /Validate business responses and field mappings/,
  },
])(
  "API connection test translations ($language)",
  ({ language, closeText, loginHint, transportHint, resourceHint }) => {
    it.each([true, false])(
      "explains the configured test and allows closing while pending (login: %s)",
      async (login) => {
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
              draftLogin={login}
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

        expect(screen.getByText(login ? loginHint : transportHint)).toBeInTheDocument();
        expect(screen.getByText(resourceHint)).toBeInTheDocument();
        expect(screen.queryByText("common.close")).not.toBeInTheDocument();
        // Ant Design inserts a space between two Chinese characters in button text.
        const closeName = new RegExp(`^${closeText.split("").join("\\s*")}$`);
        const button = screen.getByText(closeName).closest("button");
        expect(button).toHaveAccessibleName(closeName);
        expect(button).toBeEnabled();
        fireEvent.click(button!);
        expect(onClose).toHaveBeenCalledTimes(1);
      },
    );
  },
);
