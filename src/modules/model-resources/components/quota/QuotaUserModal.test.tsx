/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppServicesContext } from "@/framework/context/contexts";
import { modelResourcesEnUS } from "../../locales/en-US";
import { modelResourcesZhCN } from "../../locales/zh-CN";
import { listUserQuotas } from "../../services/quota.service";
import type { ModelQuota } from "../../types/quota";
import { QuotaUserModal } from "./QuotaUserModal";

vi.mock("@/modules/system-admin", () => ({ DirectoryUserPicker: () => null }));
vi.mock("../../services/quota.service", () => ({
  listUserQuotas: vi.fn(),
  saveUserQuotas: vi.fn(),
  deleteUserQuotas: vi.fn(),
}));

const i18n = createInstance();
const record: ModelQuota = {
  id: "q1",
  confId: "q1",
  modelId: "m1",
  modelName: "Test model",
  model: "test",
  inputTokens: 10,
  outputTokens: 2,
  billingType: 0,
  numType: [1, 4],
  priceType: ["thousand", "thousand"],
};

beforeAll(async () => {
  await i18n.init({
    lng: "en-US",
    interpolation: { escapeValue: false },
    resources: {
      "en-US": { translation: modelResourcesEnUS },
      "zh-CN": { translation: modelResourcesZhCN },
    },
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function renderModal(quota = record) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AppServicesContext.Provider
        value={{
          message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } as never,
          modal: {} as never,
          runtimeConfig: {} as never,
          updateLocale: vi.fn(),
        }}
      >
        <QuotaUserModal onClose={vi.fn()} open record={quota} />
      </AppServicesContext.Provider>
    </I18nextProvider>,
  );
}

describe("QuotaUserModal remaining allocation", () => {
  it("renders 9000 raw tokens as 9K while keeping the assigned user quota at 1K", async () => {
    await i18n.changeLanguage("en-US");
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 9000,
      outputTokensRemain: 0,
      items: [
        {
          userId: "u1",
          userName: "Test user",
          modelQuotaId: "q1",
          inputTokens: 1,
          numType: [1, 0],
          inputsLeft: 992,
        },
      ],
    });
    renderModal();
    expect(await screen.findByText("Remaining quota: 9 K tokens/month")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toHaveValue("1");
    expect(screen.queryByText(/千/)).not.toBeInTheDocument();
  });

  it("converts input and output balances independently in separate billing", async () => {
    await i18n.changeLanguage("en-US");
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 9000,
      outputTokensRemain: 1500000,
      items: [],
    });
    renderModal({ ...record, billingType: 1 });
    expect(
      await screen.findByText("Remaining quota: input 9 K tokens/month, output 1.5 M tokens/month"),
    ).toBeInTheDocument();
  });

  it("uses Chinese units after changing language", async () => {
    await i18n.changeLanguage("zh-CN");
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 9000,
      outputTokensRemain: 0,
      items: [],
    });
    renderModal();
    expect(await screen.findByText(/9 千 tokens\/月/)).toBeInTheDocument();
  });
});
