/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  OFFICIAL_SAMPLE_SOURCE,
  parseSampleCatalog,
  parseSampleInstallation,
  sampleCardAction,
  sampleCatalogName,
} from "@/modules/home/lib/sample-catalog";

const network = { displayName: "Northwind network", id: "northwind_kn" };

function item(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Northwind",
    expectedTables: 4,
    installationId: null,
    installable: true,
    knowledgeNetwork: network,
    licenseNote: "Demo data",
    message: "",
    name: "northwind",
    questions: ["Which orders are open?"],
    status: "not_installed",
    summary: "A small order sample.",
    version: "0.1.0",
    ...overrides,
  };
}

describe("sample catalog", () => {
  it("reads samples from the catalog envelope", () => {
    const catalog = parseSampleCatalog({
      samples: [item(), { name: "not a name", status: "installed", knowledgeNetwork: network }],
      sourceRepo: OFFICIAL_SAMPLE_SOURCE,
    });

    expect(catalog.sourceRejected).toBe(false);
    expect(catalog.samples).toHaveLength(1);
    expect(catalog.samples[0]?.questions).toEqual([]);
    expect(sampleCardAction(catalog.samples[0]!)).toBe("install");
    expect(sampleCatalogName("northwind")).toBe("bkn-sample-northwind");
  });

  it("keeps questions only after a successful install", () => {
    const catalog = parseSampleCatalog({
      items: [
        item({ installable: false, installedAt: "2026-09-24T03:40:00Z", status: "installed" }),
      ],
    });
    const installed = catalog.samples[0]!;

    expect(installed.questions).toEqual(["Which orders are open?"]);
    expect(installed.installedAt).toBe("2026-09-24T03:40:00Z");
    expect(sampleCardAction(installed)).toBe("open");
  });

  it("marks a non-official source as unavailable", () => {
    const catalog = parseSampleCatalog({
      samples: [item()],
      sourceRepo: "https://example.invalid/samples",
    });

    expect(catalog.sourceRejected).toBe(true);
    expect(catalog.samples[0]).toMatchObject({ installable: false, status: "unavailable" });
    expect(sampleCardAction(catalog.samples[0]!)).toBe("none");
  });

  it("keeps retry only for a failed sample", () => {
    const failed = parseSampleCatalog([
      item({ installationId: "inst-1", message: "Smoke failed", status: "failed" }),
    ]).samples[0]!;
    const conflict = parseSampleCatalog([
      item({ installable: false, message: "Catalog exists", status: "conflict" }),
    ]).samples[0]!;

    expect(sampleCardAction(failed)).toBe("retry");
    expect(sampleCardAction({ ...failed, installable: false })).toBe("retry");
    expect(sampleCardAction(conflict)).toBe("none");
  });

  it("reads an in-progress installation", () => {
    expect(
      parseSampleInstallation({
        id: "inst-1",
        sample: "northwind",
        stages: [
          { id: "database", name: "Prepare database", state: "succeeded" },
          { id: "discover", name: "Scan resources", state: "running" },
        ],
        status: "installing",
        version: "0.1.0",
      }),
    ).toMatchObject({
      id: "inst-1",
      sample: "northwind",
      status: "installing",
      stages: [{ state: "succeeded" }, { state: "running" }],
    });
  });
});
