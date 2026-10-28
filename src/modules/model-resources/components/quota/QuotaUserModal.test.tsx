/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppServicesContext } from "@/framework/context/contexts";
import { modelResourcesEnUS } from "../../locales/en-US";
import { modelResourcesZhCN } from "../../locales/zh-CN";
import { deleteUserQuotas, listUserQuotas, saveUserQuotas } from "../../services/quota.service";
import type { ModelQuota } from "../../types/quota";
import { QuotaUserModal } from "./QuotaUserModal";

vi.mock("@/modules/system-admin", () => ({ DirectoryUserPicker: () => null }));
vi.mock("../../services/quota.service", () => ({
  listUserQuotas: vi.fn(),
  saveUserQuotas: vi.fn(),
  deleteUserQuotas: vi.fn(),
}));

const i18n = createInstance();
const warning = vi.fn();
const errorMessage = vi.fn();
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
          message: { error: errorMessage, success: vi.fn(), warning } as never,
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

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en-US");
});

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

describe("QuotaUserModal allocation checks", () => {
  const user = {
    userId: "u1",
    userName: "Test user",
    userQuotaId: "uq1",
    modelQuotaId: "q1",
    inputTokens: 1,
    outputTokens: 0.5,
    numType: [1, 4],
  };
  const saveButton = () => screen.getByRole("button", { name: "common.save" });

  it("shows small remaining quantities as raw tokens", async () => {
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 1234,
      outputTokensRemain: 0,
      items: [],
    });
    renderModal({ ...record, numType: [3, 4] });
    expect(await screen.findByText("Remaining quota: 1,234 tokens/month")).toBeInTheDocument();
  });

  it("warns before any write when an input allocation exceeds the remainder", async () => {
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 9000,
      outputTokensRemain: 0,
      items: [user],
    });
    renderModal();
    await screen.findByText("Test user");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "11" } });
    fireEvent.click(saveButton());
    expect(warning).toHaveBeenCalledWith(
      "Input tokens allocation exceeds the remaining available quota. Reduce the allocation or refresh and try again.",
    );
    expect(saveUserQuotas).not.toHaveBeenCalled();
    expect(deleteUserQuotas).not.toHaveBeenCalled();
  });

  it("accepts an unchanged allocation larger than the remainder", async () => {
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 1000,
      outputTokensRemain: 0,
      items: [{ ...user, inputTokens: 9 }],
    });
    renderModal();
    await screen.findByText("Test user");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveUserQuotas).toHaveBeenCalled());
    expect(warning).not.toHaveBeenCalled();
  });

  it("uses output units and gives a localized warning", async () => {
    await i18n.changeLanguage("zh-CN");
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 9000,
      outputTokensRemain: 1500000,
      items: [user],
    });
    renderModal({ ...record, billingType: 1 });
    await screen.findByText("Test user");
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "2.1" } });
    fireEvent.click(saveButton());
    expect(warning).toHaveBeenCalledWith(
      "输出 tokens的新增分配量超过剩余可分配额度，请减少分配量或刷新后重试。",
    );
    expect(saveUserQuotas).not.toHaveBeenCalled();
  });

  it("credits a deleted user's quota before validating the remaining user", async () => {
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 1000,
      outputTokensRemain: 0,
      items: [
        { ...user, inputTokens: 5 },
        { ...user, userId: "u2", userName: "Other user", userQuotaId: "uq2", inputTokens: 4 },
      ],
    });
    renderModal();
    await screen.findByText("Other user");
    fireEvent.click(screen.getAllByRole("button", { name: "common.delete" })[1]);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveUserQuotas).toHaveBeenCalled());
    expect(deleteUserQuotas).toHaveBeenCalledWith(["uq2"]);
    expect(warning).not.toHaveBeenCalled();
  });

  it("does not delete rows when the edited total would still exceed the quota", async () => {
    vi.mocked(listUserQuotas).mockResolvedValue({
      inputTokensRemain: 1000,
      outputTokensRemain: 0,
      items: [
        { ...user, inputTokens: 5 },
        { ...user, userId: "u2", userName: "Other user", userQuotaId: "uq2", inputTokens: 4 },
      ],
    });
    renderModal();
    await screen.findByText("Other user");
    fireEvent.click(screen.getAllByRole("button", { name: "common.delete" })[1]);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "11" } });
    fireEvent.click(saveButton());
    expect(warning).toHaveBeenCalled();
    expect(deleteUserQuotas).not.toHaveBeenCalled();
    expect(saveUserQuotas).not.toHaveBeenCalled();
  });

  it("keeps saving disabled before balances load or after loading fails", async () => {
    let failLoad: (reason: Error) => void = () => undefined;
    vi.mocked(listUserQuotas).mockReturnValue(
      new Promise((_, reject) => {
        failLoad = reject;
      }),
    );
    renderModal();
    expect(saveButton()).toBeDisabled();
    failLoad(new Error("Quota load failed"));
    await waitFor(() => expect(errorMessage).toHaveBeenCalled());
    expect(saveButton()).toBeDisabled();
    expect(saveUserQuotas).not.toHaveBeenCalled();
  });
});
