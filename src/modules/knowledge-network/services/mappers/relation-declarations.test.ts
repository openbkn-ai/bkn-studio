/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  mapRelationType,
  mapRelationTypeDetail,
} from "@/modules/knowledge-network/services/mappers";
import type { BackendRelationType } from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  mapRelationDeclarations,
  relationDeclarationPatch,
} from "@/modules/knowledge-network/services/mappers/declarations";
import { toBackendRelationTypeUpdatePayload } from "@/modules/knowledge-network/services/mappers/relation-type.mapper";
import type {
  KnowledgeNetworkRelationTypeMutationPayload,
  RelationDeclarations,
} from "@/modules/knowledge-network/types/knowledge-network";

// Relation types of the clinic-lab sample, as the backend returns them: it leaves out what a
// relation does not declare, and never returns importance "primary".
const byIdCard: BackendRelationType = {
  cardinality: "many_to_one",
  fallback_for: "order_for_patient",
  id: "order_for_patient_by_id_card",
  importance: "secondary",
  mapping_rules: [
    {
      source_property: { name: "patient_id_card" },
      target_property: { name: "id_card" },
    },
  ],
  name: "检验对象（按身份证号）",
  reverse_name: "检验申请（按身份证号）",
  source_object_type_id: "lab_order",
  target_object_type_id: "patient",
  type: "direct",
  verification: "unconfirmed",
};

const departmentUnder: BackendRelationType = {
  cardinality: "many_to_one",
  constraints: { characteristics: ["transitive"] },
  id: "department_under",
  mapping_rules: [
    { source_property: { name: "parent_dept_id" }, target_property: { name: "dept_id" } },
  ],
  name: "隶属于",
  reverse_name: "下辖",
  source_object_type_id: "department",
  target_object_type_id: "department",
  type: "direct",
};

const doctorInDepartment: BackendRelationType = {
  cardinality: "many_to_many",
  id: "doctor_in_department",
  mapping_rules: {
    backing_data_source: { id: "res_doctor_assignment", type: "resource" },
    properties: [
      { display_name: "职务", mapped_field: { name: "title" }, name: "title" },
      { display_name: "任职开始", mapped_field: { name: "start_date" }, name: "start_date" },
      { display_name: "任职结束", mapped_field: { name: "end_date" }, name: "end_date" },
    ],
    source_mapping_rules: [
      { source_property: { name: "doctor_id" }, target_property: { name: "doctor_id" } },
    ],
    target_mapping_rules: [
      { source_property: { name: "dept_code" }, target_property: { name: "dept_id" } },
    ],
  },
  name: "任职于",
  reverse_name: "在职医生",
  source_object_type_id: "doctor",
  target_object_type_id: "department",
  type: "indirect",
};

const save = (
  overrides: Partial<KnowledgeNetworkRelationTypeMutationPayload> = {},
): KnowledgeNetworkRelationTypeMutationPayload => ({
  color: "#7c3aed",
  description: "",
  mappingMode: "resource",
  mappingRules: {
    backingDataSourceId: "res_doctor_assignment",
    propertyMappings: [],
    resourceMappings: [
      {
        resourceSourcePropertyName: "doctor_id",
        resourceTargetPropertyName: "dept_code",
        sourceObjectPropertyName: "doctor_id",
        targetObjectPropertyName: "dept_id",
      },
    ],
    sourceObjectTypeId: "doctor",
    targetObjectTypeId: "department",
  },
  name: "任职于",
  sourceObjectTypeId: "doctor",
  tags: [],
  targetObjectTypeId: "department",
  ...overrides,
});

describe("mapRelationDeclarations", () => {
  it("reads the declarations of the clinic-lab relations", () => {
    expect(mapRelationType(byIdCard).declarations).toEqual({
      cardinality: "many_to_one",
      fallbackFor: "order_for_patient",
      importance: "secondary",
      reverseName: "检验申请（按身份证号）",
      verification: "unconfirmed",
    });
    expect(mapRelationType(departmentUnder).declarations).toEqual({
      cardinality: "many_to_one",
      characteristics: ["transitive"],
      reverseName: "下辖",
    });
  });

  it("gives a relation that declares nothing no declarations", () => {
    expect(
      mapRelationType({ id: "plain", importance: "primary", name: "Plain", constraints: {} })
        .declarations,
    ).toBeUndefined();
  });

  it("keeps a constraint key it does not know, to write it back", () => {
    expect(
      mapRelationDeclarations({ constraints: { acyclic: true, required: ["target", "source"] } }),
    ).toEqual({ constraintsPassthrough: { acyclic: true }, requiredEnds: ["source", "target"] });
  });

  it("reads a deprecated relation as deprecated", () => {
    expect(
      mapRelationType({
        id: "order_by_legacy_doctor",
        lifecycle: { reason: "Old codes", status: "deprecated" },
        name: "开单医生（旧编码）",
      }).deprecated,
    ).toBe(true);
  });

  it("reads the relation properties an indirect relation stores, by name", () => {
    expect(mapRelationTypeDetail(doctorInDepartment).relationProperties).toEqual([
      { displayName: "职务", mappedField: "title", name: "title" },
      { displayName: "任职开始", mappedField: "start_date", name: "start_date" },
      { displayName: "任职结束", mappedField: "end_date", name: "end_date" },
    ]);
    expect(mapRelationTypeDetail(byIdCard).relationProperties).toBeUndefined();
  });
});

describe("relationDeclarationPatch", () => {
  const stored = mapRelationDeclarations(byIdCard);

  it("sends nothing for declarations the user left alone", () => {
    expect(relationDeclarationPatch({ ...stored }, stored)).toEqual({});
  });

  it("sends a changed field, and only that field", () => {
    expect(relationDeclarationPatch({ ...stored, verification: "confirmed" }, stored)).toEqual({
      verification: "confirmed",
    });
  });

  it("sends null for each field the user cleared", () => {
    const primary: RelationDeclarations = {
      cardinality: "many_to_one",
      reverseName: "检验申请（按身份证号）",
    };
    expect(relationDeclarationPatch(primary, stored)).toEqual({
      fallback_for: null,
      importance: null,
      verification: null,
    });
  });

  it("sends constraints whole when the required ends or the characteristics change", () => {
    const before = mapRelationDeclarations(departmentUnder);
    expect(relationDeclarationPatch({ ...before, requiredEnds: ["source"] }, before)).toEqual({
      constraints: { characteristics: ["transitive"], required: ["source"] },
    });
    expect(relationDeclarationPatch({ ...before, characteristics: undefined }, before)).toEqual({
      constraints: null,
    });
  });

  it("writes back the constraint keys it does not know", () => {
    const before: RelationDeclarations = { constraintsPassthrough: { acyclic: true } };
    expect(relationDeclarationPatch({ ...before, requiredEnds: ["target"] }, before)).toEqual({
      constraints: { acyclic: true, required: ["target"] },
    });
  });

  it("sends only what a new relation declares", () => {
    expect(
      relationDeclarationPatch({ cardinality: "one_to_one", reverseName: " " }, undefined),
    ).toEqual({ cardinality: "one_to_one" });
  });
});

describe("relation type save", () => {
  const baseline = mapRelationDeclarations(doctorInDepartment);

  it("sends the same body as before for a relation without declarations", () => {
    const before = toBackendRelationTypeUpdatePayload(save());
    expect(toBackendRelationTypeUpdatePayload(save({ declarationEdit: {} }))).toEqual(before);
    expect(Object.keys(before).sort()).toEqual([
      "branch",
      "color",
      "comment",
      "id",
      "mapping_mode",
      "mapping_rules",
      "name",
      "source_object_type_id",
      "tags",
      "target_object_type_id",
      "type",
    ]);
  });

  it("sends no declaration field for a relation saved unchanged", () => {
    expect(
      toBackendRelationTypeUpdatePayload(
        save({ declarationEdit: { baseline, current: baseline } }),
      ),
    ).toEqual(toBackendRelationTypeUpdatePayload(save()));
  });

  it("sends no declaration field from a save that does not edit them, as the mapping page's", () => {
    expect(toBackendRelationTypeUpdatePayload(save())).not.toHaveProperty("reverse_name");
  });

  it("sends the declarations that changed", () => {
    expect(
      toBackendRelationTypeUpdatePayload(
        save({ declarationEdit: { baseline, current: { ...baseline, reverseName: "医生" } } }),
      ),
    ).toMatchObject({ reverse_name: "医生" });
  });

  it("never sends the relation properties, so the backend keeps them", () => {
    const body = toBackendRelationTypeUpdatePayload(
      save({ declarationEdit: { baseline, current: { cardinality: "one_to_many" } } }),
    );
    expect(body.mapping_rules).not.toHaveProperty("properties");
  });
});
