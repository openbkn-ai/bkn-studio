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
import { bknTraceRouteContribution } from "@/modules/bkn-trace/routes";

describe("bkn-trace module registration", () => {
  it("contributes a shell route and navigation item", () => {
    expect(bknTraceRouteContribution.moduleId).toBe("bkn-trace");
    expect(bknTraceRouteContribution.routes.map((route) => route.path)).toContain("bkn-trace");
    expect(bknTraceNavigation.items[0]).toMatchObject({
      key: "bkn-trace",
      labelKey: "shell.items.traceai",
      path: "/bkn-trace",
    });
    expect(
      consoleNavigation
        .flatMap((item) => item.children ?? [])
        .map((item) => item.key),
    ).toContain("bkn-trace");
  });

  it("registers permissions in runtime module manifests", () => {
    expect(runtimeModuleManifests.map((manifest) => manifest.id)).toContain("bkn-trace");
  });
});
