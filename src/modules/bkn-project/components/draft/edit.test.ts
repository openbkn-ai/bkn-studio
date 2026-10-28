/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";

import { bknProjectEnUS } from "@/modules/bkn-project/locales/en-US";
import { bknProjectZhCN } from "@/modules/bkn-project/locales/zh-CN";
import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";

import { adoptBlocker, canAdopt, draftErrorCode, nameEdit, unadoptedWith } from "./edit";

const draft = () => mapDraft(mockDraft("p1"));

describe("draft edits", () => {
  it("names the relations that stopped being adopted with an object type", () => {
    const before = draft();
    const after = draft();
    after.items.objectTypes[0].adopted = false;
    after.items.relationTypes[0].adopted = false;

    expect(unadoptedWith(before, after).map((item) => item.id)).toEqual([
      "sales_orders_to_customers",
    ]);
    expect(unadoptedWith(before, before)).toEqual([]);
  });

  it("offers adopting only what the backend would accept", () => {
    const current = draft();
    const [customers, , materialBom] = current.items.objectTypes;
    const [toCustomers, bomToOrders] = current.items.relationTypes;

    // An adopted item can always be unadopted.
    expect(canAdopt(current, "object_types", customers)).toBe(true);
    // An object type waits for its identity.
    expect(canAdopt(current, "object_types", materialBom)).toBe(false);
    // A relation adopted before its end was unadopted can still be unadopted.
    expect(canAdopt(current, "relation_types", bomToOrders)).toBe(true);

    toCustomers.adopted = false;
    expect(canAdopt(current, "relation_types", toCustomers)).toBe(true);
    bomToOrders.adopted = false;
    // Both ends must be adopted to adopt a relation.
    expect(canAdopt(current, "relation_types", bomToOrders)).toBe(false);
  });

  it("says why an item cannot be adopted, so the page can tell people what to do first", () => {
    const current = draft();
    const [customers, , materialBom] = current.items.objectTypes;
    const bomToOrders = current.items.relationTypes[1];

    expect(adoptBlocker(current, "object_types", materialBom)).toBe("needsIdentity");
    expect(adoptBlocker(current, "object_types", customers)).toBeNull();
    bomToOrders.adopted = false;
    expect(adoptBlocker(current, "relation_types", bomToOrders)).toBe("endsNotAdopted");
  });

  it("sends only what changed, trimmed, and nothing for an empty edit", () => {
    const item = { description: "old", name: "Customer" };
    expect(nameEdit(item, { description: "old", name: " Client " })).toEqual({ name: "Client" });
    expect(nameEdit(item, { description: "", name: "Customer" })).toEqual({ description: "" });
    expect(nameEdit(item, { description: "old ", name: "Customer" })).toBeNull();
  });

  it("reads bkn-project's error code, and nothing from other errors", () => {
    const error = new AxiosError("stale", "ERR_BAD_REQUEST", undefined, undefined, {
      data: { description: "changed", error_code: "BknProject.Draft.Stale" },
      status: 409,
    } as AxiosResponse);

    expect(draftErrorCode(error)).toBe("Stale");
    expect(draftErrorCode(new Error("network"))).toBeUndefined();
  });

  // The page's tests mock t, so they cannot see a key placed in the wrong block.
  it.each([
    ["en-US", bknProjectEnUS],
    ["zh-CN", bknProjectZhCN],
  ])("has the editing copy under bknProject.model in %s", (_language, resources) => {
    const { model } = resources.bknProject;
    expect(model.edit.cascade_other).toContain("{{count}}");
    expect(model.edit.stale).toBeTruthy();
    expect(model.actions.adoptItem).toContain("{{name}}");
    expect(model.regenerateConfirm.content_other).toContain("{{count}}");
    expect(model.regenerateConfirm.contentUncounted).toBeTruthy();
    expect(model.catalogs.removed).toContain("{{names}}");
    expect(model.notice.askOwner).toBeTruthy();
    expect(model.notice.draftReadsMissing).toContain("{{names}}");
    expect(model.empty.noCatalogsAskOwner).toBeTruthy();
    for (const blocker of ["archived", "endsNotAdopted", "needsIdentity"] as const) {
      expect(model.adoptBlocked[blocker]).toBeTruthy();
    }
  });
});
