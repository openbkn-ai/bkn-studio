/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { expect, it } from "vitest";
import { defaultCaseFilters, readCaseFilters, writeCaseFilters } from "./eval-case-navigation";

it("round-trips exact result, scope, resource and status filters without losing unrelated URL context", () => {
  const filters = {
    ...defaultCaseFilters,
    search: "采购订单 & / 字段",
    status: "enabled" as const,
    result: "no_result" as const,
    participation: "participating" as const,
    resource: "物料",
    resourceType: "objectType" as const,
  };
  const params = writeCaseFilters(new URLSearchParams("tab=cases&context=keep"), filters);
  expect(readCaseFilters(params.toString())).toEqual(filters);
  expect(params.get("context")).toBe("keep");
  expect(params.get("tab")).toBe("cases");
});
it("clears all Case filters without dropping unrelated URL parameters", () => {
  const current = writeCaseFilters(new URLSearchParams("tab=cases&context=keep"), {
    ...defaultCaseFilters,
    result: "failed",
    participation: "participating",
    status: "enabled",
  });
  expect(writeCaseFilters(current, defaultCaseFilters).toString()).toBe("tab=cases&context=keep");
});
it("rejects unsupported filter values and bounds restored searches", () => {
  expect(
    readCaseFilters("?case_result=bad&case_scope=bad&case_status=bad&case_type=bad&case_view=bad"),
  ).toEqual(defaultCaseFilters);
  expect(readCaseFilters("?case_q=" + "x".repeat(200)).search).toHaveLength(128);
  expect(readCaseFilters("?case_view=suites").view).toBe("suites");
});
