/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { post: postMock },
}));

const declarationsRefusal = {
  response: {
    data: {
      description: "The overwrite would clear declarations",
      error_code: "BknBackend.ObjectType.DeclarationsWouldBeCleared",
      error_details: {
        cleared: [{ fields: ["semantic"], object_type_id: "lab_order", property: "ordered_at" }],
        confirm_with: "confirm_clear_declarations=true",
      },
    },
    status: 409,
  },
};

describe("importKnowledgeNetworkConceptGroup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    postMock.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends what it always has until the user confirms clearing declarations", async () => {
    const { importKnowledgeNetworkConceptGroup } =
      await import("@/modules/knowledge-network/services/concept-group.service");

    await importKnowledgeNetworkConceptGroup("kn-1", { id: "cg-1" }, "overwrite");
    await importKnowledgeNetworkConceptGroup("kn-1", { id: "cg-1" }, "overwrite", true);

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/bkn-backend/v1/knowledge-networks/kn-1/concept-groups",
      { id: "cg-1", validate_dependency: false },
      {
        params: { import_mode: "overwrite", validate_dependency: false },
        skipErrorToast: true,
      },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/bkn-backend/v1/knowledge-networks/kn-1/concept-groups",
      { id: "cg-1", validate_dependency: false },
      {
        params: {
          confirm_clear_declarations: true,
          import_mode: "overwrite",
          validate_dependency: false,
        },
        skipErrorToast: true,
      },
    );
  });

  // Regression: this refusal used to read as an ID conflict, whose "overwrite" resent the same
  // request and got the same refusal, so the import could never finish.
  it("reads DeclarationsWouldBeCleared as the list to confirm, not as a conflict", async () => {
    postMock.mockRejectedValue(declarationsRefusal);
    const { importKnowledgeNetworkConceptGroup } =
      await import("@/modules/knowledge-network/services/concept-group.service");
    const { DeclarationsWouldBeClearedError } =
      await import("@/modules/knowledge-network/services/shared/declaration-errors");

    const error = await importKnowledgeNetworkConceptGroup(
      "kn-1",
      { id: "cg-1" },
      "overwrite",
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(DeclarationsWouldBeClearedError);
    expect(error).not.toHaveProperty("isConflict");
    expect(error).toMatchObject({
      cleared: [
        { fields: ["semantic"], id: "lab_order", kind: "object_type", property: "ordered_at" },
      ],
    });
  });

  it.each([
    "BknBackend.ConceptGroup.ConceptGroupIDExisted",
    "BknBackend.ConceptGroup.ConceptGroupNameExisted",
    "BknBackend.ObjectType.ObjectTypeIDExisted",
    "BknBackend.RelationType.RelationTypeIDExisted",
    "BknBackend.ActionType.ActionTypeNameExisted",
    "OntologyManager.ConceptGroup.ConceptGroupIDExisted",
  ])("still offers overwrite or ignore for %s", async (errorCode) => {
    postMock.mockRejectedValue({
      response: { data: { description: "Already exists", error_code: errorCode } },
    });
    const { importKnowledgeNetworkConceptGroup } =
      await import("@/modules/knowledge-network/services/concept-group.service");

    await expect(importKnowledgeNetworkConceptGroup("kn-1", { id: "cg-1" })).rejects.toMatchObject({
      isConflict: true,
      message: "Already exists",
    });
  });

  it.each([
    "BknBackend.ConceptGroup.InvalidParameter",
    "BknBackend.ConceptGroup.ConceptGroupRelationExisted",
  ])("rethrows %s as it came, as a resend could not fix it", async (errorCode) => {
    const failure = { response: { data: { description: "Refused", error_code: errorCode } } };
    postMock.mockRejectedValue(failure);
    const { importKnowledgeNetworkConceptGroup } =
      await import("@/modules/knowledge-network/services/concept-group.service");

    await expect(importKnowledgeNetworkConceptGroup("kn-1", { id: "cg-1" })).rejects.toBe(failure);
  });
});
