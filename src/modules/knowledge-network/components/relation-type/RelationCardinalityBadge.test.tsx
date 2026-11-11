/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import type { RelationDeclarations } from "@/modules/knowledge-network/types/knowledge-network";

import { RelationCardinalityBadge } from "./RelationCardinalityBadge";

afterEach(async () => {
  cleanup();
  await act(() => i18n.changeLanguage("zh-CN"));
});

function renderBadge(
  declarations: RelationDeclarations | undefined,
  source = "检验申请",
  target = "医生",
) {
  return render(
    <RelationCardinalityBadge
      declarations={declarations}
      sourceName={source}
      targetName={target}
    />,
  );
}

async function hover(text: string) {
  fireEvent.mouseEnter(screen.getByText(text));
  return screen.findByRole("tooltip");
}

describe("RelationCardinalityBadge", () => {
  it("shows each cardinality from source to target", () => {
    for (const [cardinality, notation] of [
      ["one_to_one", "1:1"],
      ["one_to_many", "1:N"],
      ["many_to_one", "N:1"],
      ["many_to_many", "N:N"],
    ] as const) {
      renderBadge({ cardinality });
      expect(screen.getByText(notation)).toBeTruthy();
      cleanup();
    }
  });

  it("shows nothing for a relation that declares no cardinality", () => {
    const { container } = renderBadge({ requiredEnds: ["source"] });
    expect(container.innerHTML).toBe("");
  });

  it("says on hover what it means, with the names of the ends in bold", async () => {
    renderBadge({ cardinality: "many_to_one", requiredEnds: ["source"] });

    const tip = await hover("N:1");
    expect(tip.textContent).toBe(
      "多对一一个 检验申请 对应一个 医生；一个 医生 可对应多个 检验申请。",
    );
    expect([...tip.querySelectorAll("strong")].map((item) => item.textContent)).toEqual([
      "多对一",
      "检验申请",
      "医生",
      "医生",
      "检验申请",
    ]);
  });

  it("says it in English", async () => {
    await act(() => i18n.changeLanguage("en-US"));
    renderBadge({ cardinality: "many_to_one" }, "Lab order", "Doctor");

    const tip = await hover("N:1");
    expect(tip.textContent).toBe(
      "Many to oneEach Lab order has at most one Doctor. A Doctor can have more than one Lab order.",
    );
  });

  it("says once a relation from a type to itself that reads the same from either end", async () => {
    renderBadge(
      {
        cardinality: "one_to_one",
        characteristics: ["symmetric"],
        requiredEnds: ["source", "target"],
      },
      "患者",
      "患者",
    );

    const tip = await hover("1:1");
    expect(tip.textContent).toBe("一对一一个 患者 对应一个 患者。");
  });

  it("keeps a name as text, even one that looks like markup", async () => {
    renderBadge({ cardinality: "one_to_many" }, "<b>科室</b>", "A & B");

    const tip = await hover("1:N");
    expect(tip.textContent).toContain("一个 <b>科室</b> 可对应多个 A & B");
  });
});
