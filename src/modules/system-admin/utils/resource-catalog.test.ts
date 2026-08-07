/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  operationLabel,
  operationsForType,
  resourceTypeLabel,
} from "@/modules/system-admin/utils/resource-catalog";

describe("resource-catalog", () => {
  it("resolves resource and operation labels from the active locale", async () => {
    await i18n.changeLanguage("en-US");

    expect(resourceTypeLabel("knowledge_network")).toBe("Knowledge network");
    expect(operationLabel("knowledge_network", "data_query")).toBe("Data query");
    expect(operationsForType("catalog").map((item) => item.label)).toContain("View details");
  });

  it("falls back to raw keys for unknown resource and operation keys", () => {
    expect(resourceTypeLabel("unknown_resource")).toBe("unknown_resource");
    expect(operationLabel("unknown_resource", "unknown_op")).toBe("unknown_op");
  });
});
