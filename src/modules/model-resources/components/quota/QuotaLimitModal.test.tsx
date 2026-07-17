/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AppServicesContext } from "@/framework/context/contexts";
import { QuotaLimitModal } from "@/modules/model-resources/components/quota/QuotaLimitModal";
import { getModelQuotaDetail } from "@/modules/model-resources/services/quota.service";
import type { ModelQuota } from "@/modules/model-resources/types/quota";

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values?.amount ? `${key}:${values.amount}` : key,
  }),
}));

vi.mock("@/modules/model-resources/services/quota.service", () => ({
  createModelQuota: vi.fn(),
  getModelQuotaDetail: vi.fn(),
  updateModelQuota: vi.fn(),
}));

const quotaRecord: ModelQuota = {
  billingType: 1,
  confId: "quota-1",
  currencyType: 1,
  id: "quota-1",
  inputTokens: 100,
  model: "gpt-4o",
  modelId: "llm-1",
  modelName: "Demo GPT",
  modelSeries: "gpt",
  numType: [2, 2],
  outputTokens: 50,
  priceType: ["thousand", "thousand"],
  referPriceIn: 0.01,
  referPriceOut: 0.02,
};

function renderModal() {
  return render(
    <AppServicesContext.Provider
      value={{
        message: {
          error: vi.fn(),
          success: vi.fn(),
          warning: vi.fn(),
        } as never,
        modal: {} as never,
        runtimeConfig: {} as never,
      }}
    >
      <QuotaLimitModal mode="edit" onClose={vi.fn()} open record={quotaRecord} />
    </AppServicesContext.Provider>,
  );
}

describe("QuotaLimitModal", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  it("does not render an undefined table row while quota detail is loading", () => {
    vi.mocked(getModelQuotaDetail).mockReturnValue(new Promise(() => undefined));

    renderModal();

    expect(screen.getByText("modelResources.quotas.modal.limitTitle")).toBeTruthy();
    expect(screen.getByText("Demo GPT")).toBeTruthy();
  });
});
