/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Form } from "antd";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CapabilityCategoryFields } from "./CapabilityCategoryFields";
import { ExecutionUnitCard } from "./execution-unit/ExecutionUnitCard";
import { executionFactoryEnUS } from "../locales/en-US";
import { executionFactoryZhCN } from "../locales/zh-CN";
import { resolveToolboxCategoryLabel } from "../utils/detail-display";

vi.mock("@/modules/execution-factory/services/category.service", () => ({
  listOperatorCategories: vi.fn().mockResolvedValue([
    { categoryType: "data_process", name: "数据处理" },
    { categoryType: "data_split", name: "数据分割" },
    { categoryType: "custom_team", name: "团队自定义" },
  ]),
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

async function createI18n(locale: string) {
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    fallbackLng: false,
    resources: {
      "en-US": { translation: executionFactoryEnUS },
      "zh-CN": { translation: executionFactoryZhCN },
    },
  });
  return i18n;
}

describe("predefined capability category labels (#886)", () => {
  it.each([
    ["en-US", "Data Processing", "Data Splitting"],
    ["zh-CN", "数据处理", "数据拆分"],
  ])(
    "localizes the creation dropdown and function-set card in %s",
    async (locale, process, split) => {
      const i18n = await createI18n(locale);
      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <Form>
            <CapabilityCategoryFields initialValue="data_process" />
          </Form>
          <ExecutionUnitCard
            activeTab="toolbox"
            item={{
              id: "function-set",
              name: "Functions",
              metadataType: "function",
              category: "data_process",
              categoryName: "数据处理",
              status: "unpublish",
            }}
          />
        </I18nextProvider>,
      );

      await waitFor(() =>
        expect(container.querySelector(".ant-select-selection-item")).toHaveTextContent(process),
      );
      const card = container.querySelector(".ant-card") as HTMLElement;
      expect(within(card).getByText(process)).toBeInTheDocument();
      if (locale === "en-US") expect(within(card).queryByText("数据处理")).toBeNull();
      fireEvent.mouseDown(screen.getByRole("combobox"));
      await waitFor(() => expect(screen.getByText(split)).toBeInTheDocument());
      expect(screen.getByText("团队自定义")).toBeInTheDocument();
      expect(screen.queryByText("数据分割")).toBeNull();
    },
  );

  it("updates loaded dropdown labels when the locale changes without resetting the selection", async () => {
    const i18n = await createI18n("en-US");
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Form>
          <CapabilityCategoryFields initialValue="data_process" />
        </Form>
      </I18nextProvider>,
    );
    await waitFor(() =>
      expect(container.querySelector(".ant-select-selection-item")).toHaveTextContent(
        "Data Processing",
      ),
    );
    await act(() => i18n.changeLanguage("zh-CN"));
    await waitFor(() =>
      expect(container.querySelector(".ant-select-selection-item")).toHaveTextContent("数据处理"),
    );
  });

  it("preserves toolbox-specific labels, custom names and missing-value fallbacks", async () => {
    const i18n = await createI18n("en-US");
    const t = (key: string) => i18n.t(key);
    expect(
      resolveToolboxCategoryLabel({ categoryType: "box_category", categoryName: "工具箱" }, t),
    ).toBe("Toolbox");
    expect(
      resolveToolboxCategoryLabel({ categoryType: "custom_team", categoryName: "团队自定义" }, t),
    ).toBe("团队自定义");
    expect(resolveToolboxCategoryLabel({ categoryType: "unknown" }, t)).toBe("unknown");
    expect(resolveToolboxCategoryLabel({}, t)).toBe("-");
  });
});
