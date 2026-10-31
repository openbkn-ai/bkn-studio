/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { DraftItemActions } from "@/modules/bkn-project/components/draft/DraftTables";
import { COLLAPSED_ITEMS } from "@/modules/bkn-project/components/useCollapsedList";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { Draft, DraftRelationType } from "@/modules/bkn-project/types/draft";
import type { PendingItem } from "@/modules/bkn-project/types/publish";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { DraftChangesPanel } from "./DraftChangesPanel";

const actions = {
  adoptBlocker: () => null,
  archived: false,
  busy: false,
  onAdopt: vi.fn(),
  onChooseIdentity: vi.fn(),
  onEdit: vi.fn(),
  onRestore: vi.fn(),
} as DraftItemActions;

/** The mock draft with its customers given two time properties and no update field. */
function draft(): Draft {
  const next = mapDraft(mockDraft("p1"));
  const customers = next.items.objectTypes.find((item) => item.id === "customers")!;
  customers.incrementalKey = "";
  customers.properties = [
    ...customers.properties,
    { ...customers.properties[0], displayName: "更新时间", name: "updated_at", type: "datetime" },
    { ...customers.properties[0], displayName: "", name: "created_at", type: "datetime" },
  ];
  return next;
}

function updateField(extra: Partial<PendingItem["updateField"]> = {}): PendingItem {
  return {
    blocking: false,
    itemId: "customers",
    kind: "object_types",
    name: "客户",
    neededBy: [],
    reason: "needs_update_field",
    updateField: { allowed: true, values: ["updated_at", "created_at"], ...extra },
  };
}

function renderPanel(
  items: PendingItem[],
  onSet = vi.fn().mockResolvedValue(true),
  of = draft(),
  focus?: string,
) {
  renderWithoutAntdStyles(
    <DraftChangesPanel
      actions={actions}
      currentUserId="me"
      directory={new Map()}
      draft={of}
      focus={focus}
      neededBy={new Map()}
      onSetUpdateField={onSet}
      unadoptedEnds={[]}
      updateFields={items}
    />,
  );
  return onSet;
}

/** The panel as a link to customers' update field opens it. */
function panel(of: Draft, ends: DraftRelationType[], items: PendingItem[]) {
  return (
    <DraftChangesPanel
      actions={actions}
      currentUserId="me"
      directory={new Map()}
      draft={of}
      focus="update-field:customers"
      neededBy={new Map()}
      onSetUpdateField={vi.fn().mockResolvedValue(true)}
      unadoptedEnds={ends}
      updateFields={items}
    />
  );
}

describe("DraftChangesPanel update field", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
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

  it("suggests an update field by its display name, and sets the property's name", async () => {
    const onSet = renderPanel([updateField()]);
    expect(screen.getByText("选择更新字段")).toBeInTheDocument();
    expect(
      screen.getByText(/还没有更新字段。设好后，本地索引会按它增量刷新，只更新变化的记录。/),
    ).toBeInTheDocument();
    expect(screen.getByText("更新时间")).toBeInTheDocument();
    expect(screen.queryByText("updated_at")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "设为更新字段" }));
    await waitFor(() => expect(onSet).toHaveBeenCalledWith("customers", "updated_at"));
  });

  it("offers nothing to set on an archived project, nor without a time field", () => {
    renderPanel([updateField({ allowed: false, reason: "archived" })]);
    expect(screen.getByRole("button", { name: "设为更新字段" })).toBeDisabled();
  });

  it("says when there is no time field to choose", () => {
    renderPanel([updateField({ values: [] })]);
    expect(screen.getByText("没有可用的时间字段")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "设为更新字段" })).toBeNull();
  });

  it("marks the update field a link led to", () => {
    renderPanel([updateField()], undefined, undefined, "update-field:customers");
    expect(screen.getByText("选择更新字段").closest("li")?.className).toMatch(/changeFocused/);
  });

  it("opens the folded list when the update field a link led to is past the first few", () => {
    const of = draft();
    // Three relations waiting for their ends come first and fill the folded list.
    const ends = Array.from({ length: COLLAPSED_ITEMS }, (_, at) => ({
      ...of.items.relationTypes[0],
      id: `ends-${at}`,
      name: `关系${at}`,
    }));
    renderWithoutAntdStyles(panel(of, ends, [updateField()]));
    expect(screen.getByText("选择更新字段").closest("li")?.className).toMatch(/changeFocused/);
    expect(screen.getByRole("button", { name: "收起" })).toBeInTheDocument();
  });

  it("opens the folded list when the linked update field arrives after the first render", () => {
    const of = draft();
    const ends = Array.from({ length: COLLAPSED_ITEMS }, (_, at) => ({
      ...of.items.relationTypes[0],
      id: `ends-${at}`,
      name: `关系${at}`,
    }));
    const { rerender } = renderWithoutAntdStyles(panel(of, ends, []));
    expect(screen.queryByText("选择更新字段")).toBeNull();
    rerender(panel(of, ends, [updateField()]));
    expect(screen.getByText("选择更新字段")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起" })).toBeInTheDocument();
  });

  it("drops the suggestion once the draft has an update field", () => {
    const next = draft();
    next.items.objectTypes.find((item) => item.id === "customers")!.incrementalKey = "updated_at";
    renderPanel([updateField()], vi.fn(), next);
    expect(screen.queryByText("选择更新字段")).toBeNull();
  });
});
