/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { changedItem, proposalView } from "@/modules/bkn-project/components/ai/proposals";
import type { Proposal } from "@/modules/bkn-project/types/conversations";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const names = {
  logicNeed: (id: string) => ({ n1: "Late rate" })[id] ?? "",
  objectType: (id: string) => ({ o1: "Order", o2: "Line" })[id] ?? "",
  scenario: (id: string) => ({ s1: "Re-plan" })[id] ?? "",
};

const proposal = (extra: Partial<Proposal>): Proposal => ({
  before: null,
  intoBefore: null,
  intoId: "",
  item: null,
  kind: "logic_needs",
  networkItem: null,
  op: "add",
  parts: [],
  reason: "",
  resultId: "",
  status: "",
  targetId: "",
  ...extra,
});

const P = "bknProject.ask.proposal";

describe("proposalView", () => {
  it("words a change of one field as that field's change, named, never by id", () => {
    const view = proposalView(
      t,
      names,
      proposal({
        before: { name: "Re-plan", objectTypeIds: ["o1"] },
        item: { objectTypeIds: ["o1", "o2", "gone"] },
        op: "modify",
        targetId: "n2",
      }),
    );
    expect(view.op).toBe(`${P}.op.modify`);
    expect(view.label).toBe(
      `${P}.fieldOf:${JSON.stringify({ field: `${P}.field.objectTypeIds`, name: "Re-plan" })}`,
    );
    expect(view.before).toBe("Order");
    expect(view.after).toBe(
      `Order${"bknProject.listSeparator"}Line${"bknProject.listSeparator"}${P}.gone`,
    );
  });

  it("names a merge by both items, and a link by what the network has", () => {
    const merge = proposalView(
      t,
      names,
      proposal({
        before: { name: "Late rate" },
        intoBefore: { name: "On-time rate" },
        intoId: "n8",
        op: "merge",
        targetId: "n7",
      }),
    );
    expect(merge.label).toBe(
      `${P}.mergeLabel:${JSON.stringify({ from: "Late rate", into: "On-time rate" })}`,
    );
    expect(merge.after).toBe("On-time rate");

    const link = proposalView(
      t,
      names,
      proposal({
        before: { name: "Kit check need" },
        networkItem: { kind: "function", name: "Kit check", type: "function" },
        op: "link",
      }),
    );
    expect(link).toMatchObject({ after: "Kit check", afterInNetwork: true });
  });

  it("splits a scenario into its parts", () => {
    const view = proposalView(
      t,
      names,
      proposal({
        before: { name: "Chase and assess" },
        kind: "scenarios",
        op: "split",
        parts: [{ name: "Chase" }, { name: "Assess" }],
      }),
    );
    expect(view.before).toBe("Chase and assess");
    expect(view.after).toBe(`Chase${P}.fieldSeparator` + "Assess");
  });

  it("marks the item a proposal made or kept, and nothing for a deletion", () => {
    expect(changedItem(proposal({ op: "add", resultId: "n12" }))).toEqual({
      id: "n12",
      kind: "logic_needs",
    });
    expect(changedItem(proposal({ intoId: "n8", op: "merge", targetId: "n7" }))?.id).toBe("n8");
    expect(changedItem(proposal({ op: "delete", targetId: "n7" }))).toBeNull();
  });
});
