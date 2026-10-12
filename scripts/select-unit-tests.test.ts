/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanModuleDependencies, selectUnitTestScope } from "./select-unit-tests.mjs";

describe("selectUnitTestScope", () => {
  it("runs complete changed modules, including for styles and locale changes", () => {
    expect(
      selectUnitTestScope([
        "src/modules/data-connect/components/DataConnectConfigForm.module.css",
        "src/modules/data-catalog/locales/en-US.ts",
      ]),
    ).toEqual({
      scope: "modules",
      paths: ["src/app", "src/framework", "src/modules/data-catalog", "src/modules/data-connect"],
    });
  });

  it("includes shared catalog tests and every catalog consumer module", () => {
    expect(
      selectUnitTestScope(
        [
          "src/shared/catalog/catalog-mock.ts",
          "src/modules/data-connect/services/data-connect.service.ts",
        ],
        { catalogConsumers: ["knowledge-network", "data-catalog", "data-connect"] },
      ),
    ).toEqual({
      scope: "modules",
      paths: [
        "src/app",
        "src/framework",
        "src/modules/data-catalog",
        "src/modules/data-connect",
        "src/modules/knowledge-network",
        "src/shared/catalog",
      ],
    });
  });

  it("runs direct module consumers without recursively selecting the whole graph", () => {
    expect(
      selectUnitTestScope(["src/modules/data-connect/services/data-connect.service.ts"], {
        moduleDependencies: {
          "knowledge-network": ["data-connect"],
          "bkn-trace": ["knowledge-network"],
        },
      }),
    ).toEqual({
      scope: "modules",
      paths: [
        "src/app",
        "src/framework",
        "src/modules/data-connect",
        "src/modules/knowledge-network",
      ],
    });
  });

  it("includes hourly-cron consumers and the catalog tests that depend on it", () => {
    expect(
      selectUnitTestScope(["src/shared/hourly-cron.ts"], {
        catalogConsumers: ["data-catalog", "data-connect", "knowledge-network"],
        catalogUsesHourlyCron: true,
        hourlyCronConsumers: ["data-connect"],
      }),
    ).toEqual({
      scope: "modules",
      paths: [
        "src/app",
        "src/framework",
        "src/modules/data-catalog",
        "src/modules/data-connect",
        "src/modules/knowledge-network",
        "src/shared/catalog",
      ],
    });
  });

  it("discovers the current shared-code consumers from source imports", () => {
    const dependencies = scanModuleDependencies(
      path.resolve("src/modules"),
      path.resolve("src/shared/catalog"),
    );

    expect(dependencies.catalogConsumers).toEqual(
      expect.arrayContaining(["data-catalog", "data-connect", "knowledge-network"]),
    );
    expect(dependencies.hourlyCronConsumers).toContain("data-connect");
    expect(dependencies.catalogUsesHourlyCron).toBe(true);
    expect(dependencies.moduleDependencies["knowledge-network"]).toContain("data-connect");
  });

  it.each([
    "src/test/setup.ts",
    "vite.config.ts",
    "package.json",
    ".github/workflows/ci-quality.yml",
    "src/modules/Unrecognized/file.ts",
  ])("keeps the full suite for globally scoped or unknown changes: %s", (file) => {
    expect(selectUnitTestScope(["src/modules/data-connect/a.ts", file])).toEqual({
      scope: "full",
      paths: [],
    });
  });

  it("fails safe when catalog consumers cannot be determined", () => {
    expect(selectUnitTestScope(["src/shared/catalog/catalog-mock.ts"])).toEqual({
      scope: "full",
      paths: [],
    });
  });

  it("fails safe when hourly-cron consumers cannot be determined", () => {
    expect(selectUnitTestScope(["src/shared/hourly-cron.ts"])).toEqual({
      scope: "full",
      paths: [],
    });
  });

  it("fails safe when a discovered consumer is not a valid module path", () => {
    expect(
      selectUnitTestScope(["src/modules/data-connect/a.ts"], {
        moduleDependencies: { "bad module": ["data-connect"] },
      }),
    ).toEqual({ scope: "full", paths: [] });
  });

  it("falls back to the full suite when a changed module was removed", () => {
    expect(selectUnitTestScope(["src/modules/removed/routes.tsx"], {}, () => false)).toEqual({
      scope: "full",
      paths: [],
    });
  });

  it("does not run unit tests for documentation-only changes", () => {
    expect(selectUnitTestScope(["README.md", "docs/guide.mdx"])).toEqual({
      scope: "none",
      paths: [],
    });
  });
});
