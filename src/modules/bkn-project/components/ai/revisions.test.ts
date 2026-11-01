/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import {
  relationEditorValues,
  relationSave,
} from "@/modules/bkn-project/components/relation-type/relation-values";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";

import {
  applyObjectRevisions,
  applyRelationRevisions,
  endsText,
  objectPreview,
  type EndNames,
} from "./revisions";

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const property = (name: string, more: Partial<ObjectTypeDataProperty> = {}) =>
  ({ displayName: name, name, type: "string", ...more }) as ObjectTypeDataProperty;

const names: EndNames = {
  object: (id) => ({ dept: "Department", staff: "Employee" })[id] ?? id,
  property: (_objectTypeId, name) => ({ dept_no: "Department number" })[name] ?? name,
  table: (resourceId) => (resourceId === "res-assign" ? "assignments" : resourceId),
};

describe("Ask AI revisions", () => {
  it("puts an object type's revisions into the editor in order", () => {
    const values = {
      basic: { description: "", name: "Employee" },
      properties: [
        property("emp_no", { displayKey: true, primaryKey: true }),
        property("full_name"),
        property("dept_no"),
      ],
    };

    const next = applyObjectRevisions(values, [
      { field: "name", reason: "", value: "Staff member" },
      { field: "primary_keys", reason: "", value: ["emp_no", "dept_no"] },
      { field: "display_key", reason: "", value: "full_name" },
      { field: "data_property", reason: "", value: { comment: "Works in", name: "dept_no" } },
    ]);

    expect(next.basic).toEqual({ description: "", name: "Staff member" });
    expect(
      next.properties.map(({ displayKey, name, primaryKey }) => [name, primaryKey, displayKey]),
    ).toEqual([
      ["emp_no", true, false],
      ["full_name", false, true],
      ["dept_no", true, false],
    ]);
    // Only what the revision names changes: the display name stays.
    expect(next.properties[2]).toMatchObject({ comment: "Works in", displayName: "dept_no" });
    expect(values.properties[1].displayKey).toBeUndefined();
  });

  it("reads an object type's revision from what the editor holds, by display names", () => {
    const values = {
      basic: { description: "", name: "Ward" },
      properties: [
        property("ward_id", { displayName: "Ward ID", primaryKey: true }),
        property("bed_count"),
      ],
    };
    expect(
      objectPreview(t, values, {
        field: "primary_keys",
        reason: "",
        value: ["ward_id", "bed_count"],
      }),
    ).toEqual({
      after: "Ward IDbknProject.model.ask.preview.keySeparatorbed_count",
      before: "Ward ID",
      label: "bknProject.model.ask.field.primary_keys",
    });
    expect(
      objectPreview(t, values, {
        field: "data_property",
        reason: "",
        value: { displayName: "Beds", name: "bed_count" },
      }),
    ).toEqual({
      after: 'bknProject.model.ask.preview.displayName:{"value":"Beds"}',
      before: 'bknProject.model.ask.preview.displayName:{"value":"bed_count"}',
      label: 'bknProject.model.ask.preview.property:{"name":"bed_count"}',
    });
  });

  it("puts a relation's ends into the editor, through a link table named as the draft has it", () => {
    const values = {
      basic: { description: "", name: "works in" },
      values: relationEditorValues(undefined, { source: "staff", target: "dept" }),
    };
    const ends = {
      link: {
        resourceId: "res-assign",
        sourceMapping: [{ sourceProperty: "emp_no", targetProperty: "emp" }],
        targetMapping: [{ sourceProperty: "dept", targetProperty: "dept_no" }],
      },
      mapping: [],
      source: "staff",
      target: "dept",
    };

    const next = applyRelationRevisions(
      values,
      [
        { field: "ends", reason: "", value: ends },
        { field: "comment", reason: "", value: "Who works where." },
      ],
      [{ catalogId: "c1", name: "assignments", resourceId: "res-assign" }],
    );

    expect(next.basic.description).toBe("Who works where.");
    expect(relationSave(next.basic, next.values)).toMatchObject({ ...ends, name: "works in" });
    expect(endsText(t, names, ends)).toContain('"source":"Employee"');
    expect(endsText(t, names, ends)).toContain('\\"table\\":\\"assignments\\"');
    expect(endsText(t, names, { mapping: [], source: "", target: "" })).toBe("");
    // A relation being made, with only its source chosen: no mapping, the other end not chosen.
    expect(endsText(t, names, { mapping: [], source: "staff", target: "" })).toBe(
      'bknProject.model.ask.preview.endsOnly:{"rules":"","source":"Employee","target":"bknProject.model.ask.preview.unset"}',
    );
  });
});
