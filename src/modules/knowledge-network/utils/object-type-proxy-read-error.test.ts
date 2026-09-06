/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  classifyObjectTypeProxyReadFailure,
  getObjectTypeProxyReadFailureTranslationKeys,
} from "./object-type-proxy-read-error";

function createAxiosLikeError(status: number, errorCode?: string) {
  return {
    isAxiosError: true,
    response: {
      data: {
        description: "internal backend description",
        error_code: errorCode,
        error_details: "managed-proxy-1 cannot read resource-1",
      },
      status,
    },
  };
}

describe("classifyObjectTypeProxyReadFailure", () => {
  it("keeps a forbidden proxy read separate from dependency failures", () => {
    expect(classifyObjectTypeProxyReadFailure(createAxiosLikeError(403))).toEqual({
      code: undefined,
      kind: "caller-forbidden",
    });
  });

  it.each([
    ["OntologyQuery.Proxy.BindingInvalid", "binding-invalid"],
    ["OntologyQuery.Proxy.Disabled", "proxy-disabled"],
    ["OntologyQuery.Proxy.MappingNotFound", "mapping-missing"],
    ["OntologyQuery.Proxy.PermissionDenied", "proxy-permission-denied"],
    ["OntologyQuery.Proxy.SyncFailed", "sync-failed"],
    ["OntologyQuery.Proxy.SyncPending", "sync-pending"],
  ] as const)("maps stable proxy error %s", (code, kind) => {
    expect(classifyObjectTypeProxyReadFailure(createAxiosLikeError(503, code))).toEqual({ code, kind });
  });

  it("classifies the current ontology-query proxy dependency error without exposing details", () => {
    const failure = classifyObjectTypeProxyReadFailure(
      createAxiosLikeError(503, "OntologyQuery.InternalError.CheckPermissionFailed"),
    );

    expect(failure).toEqual({
      code: "OntologyQuery.InternalError.CheckPermissionFailed",
      kind: "dependency-unavailable",
    });
    expect(failure).not.toHaveProperty("description");
    expect(failure).not.toHaveProperty("details");
  });

  it("preserves the readable backend description for unknown non-proxy failures", () => {
    expect(
      classifyObjectTypeProxyReadFailure(createAxiosLikeError(500, "DataView.QueryFailed")),
    ).toEqual({
      code: "DataView.QueryFailed",
      description: "internal backend description",
      kind: "unknown",
    });
  });

  it("keeps the original description and local title for unknown frontend failures", () => {
    const failure = classifyObjectTypeProxyReadFailure(new Error("resource-1 leaked"));

    expect(failure).toEqual({
      code: undefined,
      description: "resource-1 leaked",
      kind: "unknown",
    });
    expect(getObjectTypeProxyReadFailureTranslationKeys(failure)).toEqual({
      description: "knowledgeNetwork.objectTypeProxyReadUnknownDescription",
      message: "knowledgeNetwork.objectTypeProxyReadUnknown",
    });
  });
});
