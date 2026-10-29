/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftObjectType } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { DraftItemDialog } from "./DraftItemDialog";

const draft = mapDraft(mockDraft("p1"));
const salesOrders = draft.items.objectTypes.find((item) => item.id === "sales_orders")!;

/** The mock's object type with one property of each kind an update field may or may not be. */
const withProperties = (overrides: Partial<DraftObjectType> = {}): DraftObjectType => ({
  ...salesOrders,
  incrementalKey: "",
  properties: [
    { ...salesOrders.properties[0], displayName: "更新时间", name: "updated_at", type: "datetime" },
    { ...salesOrders.properties[0], displayName: "版本", name: "version", type: "integer" },
    { ...salesOrders.properties[0], displayName: "金额", name: "amount", type: "decimal" },
  ],
  ...overrides,
});

const onSave = vi.fn(() => Promise.resolve());

const updateFieldSelect = () =>
  within(screen.getByRole("dialog")).getByRole("combobox", { name: "更新字段" });

describe("DraftItemDialog", () => {
  beforeAll(() => {
    // Ant Design's select reads breakpoints, which jsdom lacks.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
  });

  it("chooses an object type's update field among the properties that can be one", async () => {
    renderWithoutAntdStyles(
      <DraftItemDialog item={withProperties()} onCancel={vi.fn()} onSave={onSave} />,
    );

    expect(screen.getByRole("button", { name: /保\s*存/ })).toBeDisabled();
    fireEvent.mouseDown(updateFieldSelect());
    // A decimal grows too, but the local index cannot be refreshed by it, so it is not offered.
    expect(await screen.findByText("版本")).toBeInTheDocument();
    expect(screen.queryByText("金额")).toBeNull();
    fireEvent.click(screen.getByText("更新时间"));
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ incrementalKey: "updated_at" }));
  });

  it("recommends fields that grow with time, and warns about one that may not grow", async () => {
    renderWithoutAntdStyles(
      <DraftItemDialog
        item={withProperties({
          properties: [
            { ...salesOrders.properties[0], displayName: "版本", name: "version", type: "integer" },
            {
              ...salesOrders.properties[0],
              displayName: "更新时间",
              name: "updated_at",
              type: "datetime",
            },
          ],
        })}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.mouseDown(updateFieldSelect());
    const options = await screen.findAllByRole("option");
    // Time first and marked, though the draft lists the number first.
    expect(options.map((option) => option.textContent)).toEqual(["updated_at", "version"]);
    const listed = document.querySelectorAll(".ant-select-item-option-content");
    expect(listed[0].textContent).toContain("推荐");
    // Each option says its type, so a time and a sequence number read apart.
    expect(listed[0].textContent).toContain("日期时间");
    expect(listed[1].textContent).toContain("整数");
    expect(listed[1].textContent).not.toContain("推荐");

    fireEvent.click(within(listed[1] as HTMLElement).getByText("版本"));
    expect(
      await screen.findByText("更新字段应随记录更新而增大，例如更新时间。"),
    ).toBeInTheDocument();
  });

  it("clears an update field, and keeps names and the field in one edit", async () => {
    renderWithoutAntdStyles(
      <DraftItemDialog
        item={withProperties({ incrementalKey: "version" })}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: "订单" } });
    const select = updateFieldSelect().closest(".ant-select")!;
    fireEvent.mouseDown(select.querySelector(".ant-select-clear")!);
    fireEvent.click(screen.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ incrementalKey: "", name: "订单" }));
  });

  it("says when no property can be an update field, and offers none for other items", () => {
    const view = renderWithoutAntdStyles(
      <DraftItemDialog
        item={withProperties({ properties: [] })}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );
    expect(
      screen.getByText(
        "这个对象类没有能作为更新字段的属性：更新字段需要是日期、时间、整数，或长度有限的文本。",
      ),
    ).toBeInTheDocument();
    expect(updateFieldSelect()).toBeDisabled();
    view.unmount();

    // A field set before can still be cleared, though nothing else qualifies.
    const kept = renderWithoutAntdStyles(
      <DraftItemDialog
        item={withProperties({ incrementalKey: "old_field", properties: [] })}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );
    expect(updateFieldSelect()).toBeEnabled();
    kept.unmount();

    renderWithoutAntdStyles(
      <DraftItemDialog item={draft.items.relationTypes[0]} onCancel={vi.fn()} onSave={onSave} />,
    );
    expect(screen.queryByText("更新字段")).toBeNull();
  });
});
