/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { knowledgeNetworkEnUS } from "@/modules/knowledge-network/locales/en-US";
import { knowledgeNetworkZhCN } from "@/modules/knowledge-network/locales/zh-CN";

import { capabilitySkipReasonKey, capabilitySkipTypeKey } from "./capability-import-skip";

const lookup = (resources: unknown, key: string) =>
  key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], resources);

describe("capability import skips", () => {
  it("words every reason bkn-backend reports, in both languages", () => {
    for (const reason of [
      "ambiguous_name",
      "execution_factory_unreachable",
      "knowledge_base_service_unreachable",
      "not_found",
      "not_supported",
      "not_usable",
      "a_reason_from_a_later_release",
    ]) {
      const key = capabilitySkipReasonKey(reason);
      expect(typeof lookup(knowledgeNetworkZhCN, key)).toBe("string");
      expect(typeof lookup(knowledgeNetworkEnUS, key)).toBe("string");
    }
  });

  it("reads an unknown reason or type as other, never as the raw value", () => {
    expect(capabilitySkipReasonKey("a_reason_from_a_later_release")).toBe(
      "knowledgeNetwork.packageImport.reason.other",
    );
    expect(capabilitySkipTypeKey("workflow")).toBe("knowledgeNetwork.packageImport.type.other");
    expect(capabilitySkipTypeKey("knowledge_base")).toBe(
      "knowledgeNetwork.packageImport.type.knowledge_base",
    );
  });
});
