/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftObjectType } from "@/modules/bkn-project/types/draft";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { IdentityDialog } from "./IdentityDialog";

const salesOrders = mapDraft(mockDraft("p1")).items.objectTypes.find(
  (item) => item.id === "sales_orders",
)!;

/** An object type waiting for its identity, its properties named as people read them. */
const waiting = (candidate?: string[]): DraftObjectType => ({
  ...salesOrders,
  key: { ...salesOrders.key, ...(candidate ? { candidate } : {}) },
  needsIdentity: true,
  primaryKeys: [],
  properties: [
    { ...salesOrders.properties[0], displayName: "单号", name: "id", type: "integer" },
    { ...salesOrders.properties[0], displayName: "分录号", name: "entry_id", type: "integer" },
    { ...salesOrders.properties[0], displayName: "", name: "remark", type: "string" },
  ],
});

const save = () => screen.getByRole("button", { name: /保\s*存/ });

describe("IdentityDialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("selects what drafting counted unique, and names properties as people read them", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    renderWithoutAntdStyles(
      <IdentityDialog
        objectType={waiting(["id", "entry_id"])}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );

    const dialog = within(screen.getByRole("dialog"));
    expect(
      dialog.getByText(
        "起草时统计过：按「单号、分录号」的组合区分记录，整张表没有重复也没有空值，已为你选上。",
      ),
    ).toBeInTheDocument();
    expect(dialog.getByRole("checkbox", { name: /单号 id/ })).toBeChecked();
    expect(dialog.getByRole("checkbox", { name: /分录号 entry_id/ })).toBeChecked();
    // A property without a name people read shows its own.
    expect(dialog.getByRole("checkbox", { name: /remark/ })).not.toBeChecked();

    fireEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(["id", "entry_id"]));
  });

  it("says when drafting counted nothing unique, and selects nothing for the person", () => {
    renderWithoutAntdStyles(
      <IdentityDialog objectType={waiting()} onCancel={vi.fn()} onSave={vi.fn()} />,
    );

    expect(
      screen.getByText("起草时没有统计出在整张表里唯一的属性或组合，可以按你对业务的了解选择。"),
    ).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });
});
