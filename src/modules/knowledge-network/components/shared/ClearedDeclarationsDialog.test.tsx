/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ClearedDeclaration } from "@/modules/knowledge-network/types/knowledge-network";
import { definitionKey } from "@/modules/knowledge-network/utils/declaration-labels";

import { ClearedDeclarationsDialog } from "./ClearedDeclarationsDialog";

const cleared: ClearedDeclaration[] = [
  { fields: ["aliases"], id: "lab_order", kind: "object_type" },
  {
    fields: ["aliases", "constraints"],
    id: "lab_order",
    kind: "object_type",
    property: "order_no",
  },
  {
    fields: ["semantic", "required"],
    id: "lab_order",
    kind: "object_type",
    property: "ordered_at",
  },
  {
    fields: ["reverse_name", "cardinality", "fallback_for"],
    id: "order_for_patient",
    kind: "relation_type",
  },
  { fields: ["future_field"], id: "revoke", kind: "action_type" },
];

function renderDialog(props: Partial<Parameters<typeof ClearedDeclarationsDialog>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ClearedDeclarationsDialog
      cleared={cleared}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open
      {...props}
    />,
  );
  return { onCancel, onConfirm };
}

describe("ClearedDeclarationsDialog", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-CN");
  });

  it("lists what would be cleared by definition, with declarations named in words", () => {
    renderDialog({
      names: new Map([[definitionKey("object_type", "lab_order"), "检验申请"]]),
    });

    expect(screen.getByText("覆盖会清除已有的声明")).toBeInTheDocument();
    const order = screen.getByRole("region", { name: "检验申请" });
    expect(within(order).getByText("对象类 · 检验申请")).toBeInTheDocument();
    expect(within(order).getByText("lab_order")).toBeInTheDocument();
    expect(within(order).getByText("对象类本身：别名")).toBeInTheDocument();
    expect(within(order).getByText("order_no：别名、取值约束")).toBeInTheDocument();
    expect(within(order).getByText("ordered_at：语义、必填")).toBeInTheDocument();

    // A package names no definition, so the id stands in; a relation has its own declarations only.
    const relation = screen.getByRole("region", { name: "order_for_patient" });
    expect(within(relation).getByText("关系类 · order_for_patient")).toBeInTheDocument();
    expect(within(relation).getByText("反向名称、关系基数、替代路径")).toBeInTheDocument();

    // A declaration this release does not know keeps the backend's name.
    expect(
      within(screen.getByRole("region", { name: "revoke" })).getByText("future_field"),
    ).toBeInTheDocument();
  });

  it("folds a long property list until asked", () => {
    renderDialog({
      cleared: Array.from({ length: 7 }, (_, index) => ({
        fields: ["semantic"],
        id: "lab_order",
        kind: "object_type" as const,
        property: `p${index}`,
      })),
    });

    expect(screen.getByText("p4：语义")).toBeInTheDocument();
    expect(screen.queryByText("p5：语义")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "另有 2 个属性，展开查看" }));

    expect(screen.getByText("p6：语义")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /展开查看/ })).not.toBeInTheDocument();
  });

  it("confirms only from the danger button, and cancels from the other", () => {
    const { onCancel, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "取 消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "清除声明并导入" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("still explains the refusal when the backend listed nothing", () => {
    renderDialog({ cleared: [] });

    expect(screen.getByText("后端没有列出具体会清除哪些声明。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清除声明并导入" })).toBeInTheDocument();
  });

  it("reads in English", async () => {
    await i18n.changeLanguage("en-US");
    renderDialog();

    expect(screen.getByText("Overwriting clears existing declarations")).toBeInTheDocument();
    expect(screen.getByText("Object type itself: Aliases")).toBeInTheDocument();
    expect(screen.getByText("order_no: Aliases, Value constraints")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear declarations and import" }),
    ).toBeInTheDocument();
  });
});
