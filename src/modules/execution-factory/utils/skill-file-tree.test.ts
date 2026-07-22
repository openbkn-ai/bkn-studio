/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildSkillFileTree,
  collectSkillFileTreeKeys,
} from "@/modules/execution-factory/utils/skill-file-tree";

describe("buildSkillFileTree", () => {
  it("groups nested paths into a directory tree", () => {
    const tree = buildSkillFileTree([
      { relPath: "SKILL.md", mimeType: "text/markdown", size: 10 },
      { relPath: "bin/mysql.exe", mimeType: "application/octet-stream", size: 20 },
      { relPath: "bin/ssleay32.dll", size: 30 },
      { relPath: "datasets/catalog.json", mimeType: "application/json", size: 40 },
      { relPath: "datasets/supply-chain/data.sql", size: 50 },
    ]);

    expect(tree.map((node) => node.title)).toEqual(["bin", "datasets", "SKILL.md"]);

    const bin = tree.find((node) => node.key === "bin/");
    expect(bin?.isLeaf).toBe(false);
    expect(bin?.children?.map((child) => child.title)).toEqual(["mysql.exe", "ssleay32.dll"]);
    expect(bin?.children?.[0]?.file?.relPath).toBe("bin/mysql.exe");

    const datasets = tree.find((node) => node.key === "datasets/");
    const supplyChain = datasets?.children?.find((child) => child.key === "datasets/supply-chain/");
    expect(supplyChain?.children?.[0]?.file?.relPath).toBe("datasets/supply-chain/data.sql");

    const skillMd = tree.find((node) => node.key === "SKILL.md");
    expect(skillMd?.isLeaf).toBe(true);
    expect(skillMd?.file?.relPath).toBe("SKILL.md");
  });

  it("normalizes backslashes and ignores empty paths", () => {
    const tree = buildSkillFileTree([
      { relPath: "scripts\\dataset.js" },
      { relPath: "" },
      { relPath: "/" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.key).toBe("scripts/");
    expect(tree[0]?.children?.[0]?.file?.relPath).toBe("scripts/dataset.js");
  });

  it("collects expandable directory keys", () => {
    const tree = buildSkillFileTree([
      { relPath: "a/b/c.txt" },
      { relPath: "root.txt" },
    ]);

    expect(collectSkillFileTreeKeys(tree)).toEqual(["a/", "a/b/"]);
  });
});
