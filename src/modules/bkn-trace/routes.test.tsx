/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { consoleNavigation } from "@/app/shell/console-navigation";
import { runtimeModuleManifests } from "@/framework/runtime/module-manifests";
import { bknTraceNavigation } from "@/modules/bkn-trace/navigation";
import { bknTraceModuleManifest } from "@/modules/bkn-trace/module.manifest";
import { bknTraceRouteContribution } from "@/modules/bkn-trace/routes";

describe("bkn-trace module registration", () => {
  it("contributes a shell route and navigation item", () => {
    expect(bknTraceRouteContribution.moduleId).toBe("bkn-trace");
    expect(bknTraceRouteContribution.routes.map((route) => route.path)).toEqual(
      expect.arrayContaining([
        "observability/business-provenance",
        "observability/business-provenance/prototype",
        "observability/traces",
        "observability/logs",
        "observability/settings",
        "system/bkn-trace",
      ]),
    );
    expect(bknTraceNavigation.parentKey).toBeUndefined();
    expect(bknTraceNavigation.items[0]).toMatchObject({
      key: "observability",
      labelKey: "shell.items.observability",
    });
    expect(bknTraceNavigation.items[0].children?.map((item) => item.key)).toEqual([
      "business-provenance",
      "trace-analysis",
      "observability-logs",
      "observability-settings",
    ]);
    expect(consoleNavigation.map((item) => item.key)).toContain("observability");
    expect(bknTraceNavigation.items[0].children?.map((item) => item.key)).not.toContain("business-provenance-prototype");
  });

  it("registers permissions in runtime module manifests", () => {
    expect(runtimeModuleManifests.map((manifest) => manifest.id)).toContain("bkn-trace");
    expect(bknTraceModuleManifest.permissions).toEqual([]);
  });
});
