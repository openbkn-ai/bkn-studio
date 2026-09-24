/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogImport = /["']@\/shared\/catalog(?:\/[^"']*)?["']/;
const hourlyCronImport = /["']@\/shared\/hourly-cron["']/;
const moduleImport = /["']@\/modules\/([a-z0-9-]+)(?:\/|["'])/g;

export function scanModuleDependencies(modulesRoot, catalogRoot) {
  const catalogConsumers = [];
  const hourlyCronConsumers = [];
  const moduleDependencies = {};

  function scan(directory, dependencies) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(entryPath, dependencies);
      }
      if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        const source = readFileSync(entryPath, "utf8");
        if (catalogImport.test(source)) {
          dependencies.add("shared/catalog");
        }
        if (hourlyCronImport.test(source)) {
          dependencies.add("shared/hourly-cron");
        }
        for (const match of source.matchAll(moduleImport)) {
          dependencies.add(match[1]);
        }
      }
    }
  }

  for (const entry of readdirSync(modulesRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const dependencies = new Set();
      scan(path.join(modulesRoot, entry.name), dependencies);
      dependencies.delete(entry.name);
      if (dependencies.delete("shared/catalog")) {
        catalogConsumers.push(entry.name);
      }
      if (dependencies.delete("shared/hourly-cron")) {
        hourlyCronConsumers.push(entry.name);
      }
      moduleDependencies[entry.name] = [...dependencies];
    }
  }
  const catalogDependencies = new Set();
  scan(catalogRoot, catalogDependencies);
  return {
    catalogConsumers,
    catalogUsesHourlyCron: catalogDependencies.has("shared/hourly-cron"),
    hourlyCronConsumers,
    moduleDependencies,
  };
}

export function selectUnitTestScope(
  changedFiles,
  {
    catalogConsumers = [],
    catalogUsesHourlyCron = false,
    hourlyCronConsumers = [],
    moduleDependencies = {},
  } = {},
  moduleExists = () => true,
) {
  const paths = new Set();
  const selectedModules = new Set();
  const changedModules = new Set();

  for (const file of changedFiles) {
    if (/\.(md|mdx)$/i.test(file) || file.startsWith("docs/")) {
      continue;
    }

    const moduleMatch = /^src\/modules\/([a-z0-9-]+)\//.exec(file);
    if (moduleMatch) {
      changedModules.add(moduleMatch[1]);
      selectedModules.add(moduleMatch[1]);
      continue;
    }

    if (file.startsWith("src/shared/catalog/")) {
      if (catalogConsumers.length === 0) {
        return { scope: "full", paths: [] };
      }
      paths.add("src/shared/catalog");
      for (const moduleName of catalogConsumers) {
        if (!/^[a-z0-9-]+$/.test(moduleName)) {
          return { scope: "full", paths: [] };
        }
        selectedModules.add(moduleName);
      }
      continue;
    }

    if (file === "src/shared/hourly-cron.ts") {
      if (hourlyCronConsumers.length === 0 && !catalogUsesHourlyCron) {
        return { scope: "full", paths: [] };
      }
      if (catalogUsesHourlyCron) {
        if (catalogConsumers.length === 0) {
          return { scope: "full", paths: [] };
        }
        paths.add("src/shared/catalog");
        for (const moduleName of catalogConsumers) {
          selectedModules.add(moduleName);
        }
      }
      for (const moduleName of hourlyCronConsumers) {
        selectedModules.add(moduleName);
      }
      continue;
    }

    // Global setup, other shared packages, tooling, and unknown paths can
    // affect tests outside any one module. Keep the complete regression gate.
    return { scope: "full", paths: [] };
  }

  // Run direct consumers of changed modules. Recursively expanding the
  // existing cross-module import graph pulls almost the entire repository in.
  for (const [consumer, dependencies] of Object.entries(moduleDependencies)) {
    if (dependencies.some((name) => changedModules.has(name))) {
      selectedModules.add(consumer);
    }
  }

  for (const moduleName of selectedModules) {
    if (!/^[a-z0-9-]+$/.test(moduleName) || !moduleExists(moduleName)) {
      return { scope: "full", paths: [] };
    }
    paths.add(`src/modules/${moduleName}`);
  }
  if (selectedModules.size > 0) {
    // Shell, routing, permissions, and runtime tests consume module exports.
    paths.add("src/app");
    paths.add("src/framework");
  }

  return paths.size === 0
    ? { scope: "none", paths: [] }
    : { scope: "modules", paths: [...paths].sort() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base) {
    throw new Error("Usage: node scripts/select-unit-tests.mjs <base-commit>");
  }

  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", "-z", base, "HEAD"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
  const dependencies = scanModuleDependencies(
    path.join(repositoryRoot, "src/modules"),
    path.join(repositoryRoot, "src/shared/catalog"),
  );
  const selection = selectUnitTestScope(changedFiles, dependencies, (moduleName) =>
    existsSync(path.join(repositoryRoot, "src/modules", moduleName)),
  );

  process.stdout.write(`scope=${selection.scope}\n`);
  if (selection.scope === "modules") {
    process.stdout.write(`test_paths=${selection.paths.join(" ")}\n`);
  }
}
