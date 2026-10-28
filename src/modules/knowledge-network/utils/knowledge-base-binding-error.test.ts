/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";

import { knowledgeBaseBindingFailure } from "./knowledge-base-binding-error";

function refusal(status: number, code?: string) {
  return new AxiosError(String(status), "ERR_BAD_RESPONSE", undefined, undefined, {
    data: code ? { description: "described", error_code: code } : {},
    status,
  } as AxiosResponse);
}

describe("knowledgeBaseBindingFailure", () => {
  it("reads bkn-backend's refusals of a knowledge-base mount", () => {
    expect(
      knowledgeBaseBindingFailure(refusal(400, "BknBackend.CapabilityBinding.TargetNotFound")),
    ).toBe("gone");
    expect(
      knowledgeBaseBindingFailure(
        refusal(400, "BknBackend.CapabilityBinding.KnowledgeBaseNotSupported"),
      ),
    ).toBe("notSupported");
    expect(
      knowledgeBaseBindingFailure(
        refusal(502, "BknBackend.CapabilityBinding.KnowledgeBaseServiceUnavailable"),
      ),
    ).toBe("unavailable");
    expect(
      knowledgeBaseBindingFailure(
        refusal(403, "BknBackend.KnowledgeNetwork.Proxy.PermissionMissing"),
      ),
    ).toBe("noPermission");
  });

  it("reads kb-api's own refusals by status", () => {
    expect(knowledgeBaseBindingFailure(refusal(403))).toBe("noPermission");
    expect(knowledgeBaseBindingFailure(refusal(503))).toBe("unavailable");
  });

  it("calls anything else other, never one of the known kinds", () => {
    expect(knowledgeBaseBindingFailure(refusal(400, "BknBackend.Common.InvalidParameter"))).toBe(
      "other",
    );
    expect(knowledgeBaseBindingFailure(new Error("network down"))).toBe("other");
  });
});
