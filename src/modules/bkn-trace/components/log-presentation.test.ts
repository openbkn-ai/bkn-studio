/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { presentLogActor } from "@/modules/bkn-trace/components/log-presentation";
import type { LogRecord } from "@/modules/bkn-trace/services/observability.service";

vi.mock("@/framework/runtime/config", () => ({
  getRuntimeConfig: () => ({
    currentUser: {
      id: "266c6a42-6131-4d62-8f39-853e7093701c",
      name: "Administrator",
    },
  }),
}));

const translate = (key: string) => key;

describe("log presentation", () => {
  it("uses the current authenticated username when an old event only contains its user id", () => {
    const record = {
      actor: {
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "266c6a42-6131-4d62-8f39-853e7093701c",
        type: "user",
      },
      authMethod: "unknown",
    } as LogRecord;

    expect(presentLogActor(record, translate, new Map()).primary).toBe("Administrator");
  });
});
