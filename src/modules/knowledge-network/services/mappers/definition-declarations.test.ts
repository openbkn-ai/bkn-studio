/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildBackendObjectTypePayload,
  mapActionType,
  mapObjectType,
  mapObjectTypeDetail,
} from "@/modules/knowledge-network/services/mappers";
import {
  mapActionTypeDetail,
  toBackendActionTypeUpdatePayload,
} from "@/modules/knowledge-network/services/mappers/action-type.mapper";
import { definitionDeclarationPatch } from "@/modules/knowledge-network/services/mappers/declarations";
import type {
  DefinitionDeclarations,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkObjectTypeMutationPayload,
} from "@/modules/knowledge-network/types/knowledge-network";

// Definitions of the clinic-lab sample, as the backend returns them: it leaves out what a
// definition does not declare, and never returns lifecycle status active.
const patient = {
  aliases: ["病人", "就诊人"],
  data_properties: [],
  id: "patient",
  name: "患者",
};
const revokeLabOrder = {
  action_type: "modify" as const,
  aliases: ["作废检验单", "退单"],
  id: "revoke_lab_order",
  name: "撤销检验申请",
  object_type_id: "lab_order",
};
const legacyDoctor = {
  id: "legacy_doctor",
  lifecycle: { reason: "旧工号停用", replaced_by: "doctor", status: "deprecated" },
  name: "医生（旧工号）",
};

const objectSave = (
  overrides: Partial<KnowledgeNetworkObjectTypeMutationPayload> = {},
): KnowledgeNetworkObjectTypeMutationPayload => ({
  color: "#1d4ed8",
  conceptGroupIds: [],
  dataProperties: [],
  description: "",
  name: "患者",
  tags: [],
  ...overrides,
});

const actionSave = (
  overrides: Partial<KnowledgeNetworkActionTypeMutationPayload> = {},
): KnowledgeNetworkActionTypeMutationPayload => ({
  actionKind: "update",
  color: "#16a34a",
  description: "",
  name: "撤销检验申请",
  objectTypeId: "lab_order",
  tags: [],
  ...overrides,
});

describe("reading aliases and lifecycle", () => {
  it("reads the aliases of an object type and an action type", () => {
    expect(mapObjectType(patient).declarations).toEqual({ aliases: ["病人", "就诊人"] });
    expect(mapObjectTypeDetail(patient).declarations).toEqual({ aliases: ["病人", "就诊人"] });
    expect(mapActionType(revokeLabOrder).declarations).toEqual({
      aliases: ["作废检验单", "退单"],
    });
    expect(mapActionTypeDetail(revokeLabOrder).declarations).toEqual({
      aliases: ["作废检验单", "退单"],
    });
  });

  it("reads a deprecated definition with its reason and replacement", () => {
    expect(mapObjectType(legacyDoctor).declarations).toEqual({
      lifecycle: { reason: "旧工号停用", replacedBy: "doctor", status: "deprecated" },
    });
  });

  it("gives a definition that declares nothing no declarations", () => {
    expect(
      mapObjectType({ aliases: [], id: "x", lifecycle: { status: "active" }, name: "X" })
        .declarations,
    ).toBeUndefined();
    expect(
      mapActionType({ aliases: null, id: "y", lifecycle: null, name: "Y" }).declarations,
    ).toBeUndefined();
  });
});

describe("definitionDeclarationPatch", () => {
  const stored: DefinitionDeclarations = { aliases: ["病人", "就诊人"] };

  it("sends nothing when the aliases and lifecycle did not change", () => {
    expect(definitionDeclarationPatch({ aliases: ["病人", "就诊人"] }, stored)).toEqual({});
    expect(definitionDeclarationPatch(undefined, undefined)).toEqual({});
  });

  it("sends the aliases whole when one changes, and null when all are cleared", () => {
    expect(definitionDeclarationPatch({ aliases: ["病人"] }, stored)).toEqual({
      aliases: ["病人"],
    });
    expect(definitionDeclarationPatch(undefined, stored)).toEqual({ aliases: null });
  });

  it("sends the lifecycle when deprecating, and null when set back to active", () => {
    const deprecated: DefinitionDeclarations = {
      ...stored,
      lifecycle: { reason: "改用就诊人", replacedBy: "visitor", status: "deprecated" },
    };
    expect(definitionDeclarationPatch(deprecated, stored)).toEqual({
      lifecycle: { reason: "改用就诊人", replaced_by: "visitor", status: "deprecated" },
    });
    expect(definitionDeclarationPatch(stored, deprecated)).toEqual({ lifecycle: null });
    expect(
      definitionDeclarationPatch(
        { lifecycle: { reason: "改用就诊人", status: "deprecated" } },
        undefined,
      ),
    ).toEqual({ lifecycle: { reason: "改用就诊人", status: "deprecated" } });
  });
});

describe("object type and action type saves", () => {
  it("send the same body as before for a definition without aliases or lifecycle", () => {
    const before = buildBackendObjectTypePayload(objectSave(), []);
    expect(
      buildBackendObjectTypePayload(objectSave({ definitionDeclarationEdit: {} }), []),
    ).toEqual(before);
    expect(before).not.toHaveProperty("aliases");
    expect(before).not.toHaveProperty("lifecycle");

    const actionBefore = toBackendActionTypeUpdatePayload(actionSave());
    expect(toBackendActionTypeUpdatePayload(actionSave({ definitionDeclarationEdit: {} }))).toEqual(
      actionBefore,
    );
  });

  it("send no declaration field for a definition saved unchanged", () => {
    const baseline = mapActionTypeDetail(revokeLabOrder).declarations;
    expect(
      toBackendActionTypeUpdatePayload(
        actionSave({ definitionDeclarationEdit: { baseline, current: baseline } }),
      ),
    ).toEqual(toBackendActionTypeUpdatePayload(actionSave()));

    const objectBaseline = mapObjectType(patient).declarations;
    expect(
      buildBackendObjectTypePayload(
        objectSave({
          definitionDeclarationEdit: { baseline: objectBaseline, current: objectBaseline },
        }),
        [],
      ),
    ).toEqual(buildBackendObjectTypePayload(objectSave(), []));
  });

  it("send the declarations that changed", () => {
    expect(
      buildBackendObjectTypePayload(
        objectSave({
          definitionDeclarationEdit: {
            baseline: { aliases: ["病人"] },
            current: { aliases: ["病人", "就诊人"] },
          },
        }),
        [],
      ),
    ).toMatchObject({ aliases: ["病人", "就诊人"] });
  });
});
