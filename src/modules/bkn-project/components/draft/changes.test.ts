/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import type { DraftDecision } from "@/modules/bkn-project/types/draft";

import { describeDecision, itemNames, whoDecided } from "./changes";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const names = itemNames(mapDraft(mockDraft("p1")));

const decision = (change: Partial<DraftDecision>): DraftDecision => ({
  action: "adopt",
  after: true,
  before: false,
  by: { id: "me", type: "user" },
  itemId: "customers",
  kind: "object_types",
  time: 1,
  ...change,
});

describe("change log", () => {
  it("says what was adopted, by its kind and current name", () => {
    expect(describeDecision(t, decision({}), names).text).toBe(
      'bknProject.model.changes.action.adopt:{"kind":"bknProject.model.changes.kind.object_types","name":"customers"}',
    );
    expect(
      describeDecision(
        t,
        decision({
          action: "unadopt",
          itemId: "sales_orders_to_customers",
          kind: "relation_types",
        }),
        names,
      ).text,
    ).toContain('"name":"sales_orders_to_customers"');
  });

  it("says what confirming the draft accepted, never as an unnamed item", () => {
    const accepted = describeDecision(
      t,
      decision({
        action: "accept_undecided",
        after: ["object_types/bom", "relation_types/bom_to_parts"],
        before: null,
        itemId: "",
        kind: "draft",
      }),
      names,
    );
    expect(accepted.text).toBe(
      'bknProject.model.changes.confirmation.accept_undecided:{"count":2}',
    );
    expect(
      describeDecision(
        t,
        decision({
          action: "accept_unresolved_conflicts",
          after: ["k1"],
          itemId: "",
          kind: "draft",
        }),
        names,
      ).text,
    ).toBe('bknProject.model.changes.confirmation.accept_unresolved_conflicts:{"count":1}');
    // A decision on the draft added later still reads as one, not as an object type.
    expect(
      describeDecision(
        t,
        decision({ action: "accept_more", after: null, itemId: "", kind: "draft" }),
        names,
      ).text,
    ).toBe('bknProject.model.changes.confirmation.other:{"count":0}');
  });

  it("shows what a rename and a description replaced", () => {
    const rename = describeDecision(
      t,
      decision({ action: "rename", after: "Client", before: "customers" }),
      names,
    );
    expect(rename.text).toContain('"after":"Client"');
    expect(rename.text).toContain('"before":"customers"');

    const describe = describeDecision(
      t,
      decision({ action: "describe", after: "People who buy", before: "" }),
      names,
    );
    expect(describe.before).toBe("bknProject.model.changes.empty");
    expect(describe.after).toBe("People who buy");
  });

  it("names the chosen identity and what it replaced", () => {
    const chosen = describeDecision(
      t,
      decision({
        action: "identity",
        after: ["material_code"],
        before: [],
        itemId: "material_bom",
      }),
      names,
    );
    expect(chosen.text).toContain('"properties":"material_code"');
    expect(chosen.before).toBe("bknProject.model.changes.empty");
    expect(chosen.after).toBe("material_code");

    const composite = describeDecision(
      t,
      decision({ action: "identity", after: ["a", "b"], before: ["id"] }),
      names,
    );
    expect(composite.after).toBe("a + b");
    expect(composite.before).toBe("id");
  });

  it("says which field was restored and the property it became", () => {
    const restored = describeDecision(
      t,
      decision({
        action: "restore",
        after: "contact_phone_2",
        before: { field: "contact_phone", keyword: "phone", object_type: "customers" },
        kind: "excluded",
      }),
      names,
    );
    expect(restored.text).toContain('"field":"contact_phone"');
    expect(restored.text).toContain('"property":"contact_phone_2"');
    expect(restored.text).toContain('"name":"customers"');
  });

  it("reads an action it does not know as a change, never as an error", () => {
    expect(describeDecision(t, decision({ action: "merge" }), names).text).toContain(
      "bknProject.model.changes.action.other",
    );
  });

  it("says who decided without showing an account id", () => {
    const directory = new Map([["u2", "Li Lei"]]);
    expect(whoDecided(t, { id: "me", type: "user" }, "me", directory)).toBe(
      "bknProject.model.changes.you",
    );
    expect(whoDecided(t, { id: "u2", type: "user" }, "me", directory)).toBe("Li Lei");
    expect(whoDecided(t, { id: "u3", type: "user" }, "me", directory)).toBe(
      "bknProject.model.changes.someone",
    );
  });
});

describe("catalogs added", () => {
  it("counts what adding catalogs drafted, or says drafting their tables failed", () => {
    const added = describeDecision(
      t,
      decision({
        action: "add_catalogs",
        after: {
          catalog_ids: ["c2"],
          object_types: ["leads", "visits"],
          relation_types: ["visits_to_leads"],
          value_types: [],
        },
        before: null,
        itemId: "",
        kind: "draft",
      }),
      {},
    );
    expect(added.text).toBe(
      'bknProject.model.changes.addCatalogs.done:{"count":1,"objects":2,"relations":1}',
    );
    const failed = describeDecision(
      t,
      decision({
        action: "add_catalogs",
        after: { catalog_ids: ["c2", "c3"], error: "timeout" },
        itemId: "",
        kind: "draft",
      }),
      {},
    );
    expect(failed.text).toBe('bknProject.model.changes.addCatalogs.failed:{"count":2}');
  });
});
