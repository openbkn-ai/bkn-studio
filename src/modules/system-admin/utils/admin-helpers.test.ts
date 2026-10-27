/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { AdminDepartment } from "@/modules/system-admin/types/admin";

import { buildDeptTree, computeSubtreeMemberCounts, departmentSubtreeIds } from "./admin-helpers";

const dept = (id: string, parentId: string | null = null): AdminDepartment => ({
  id,
  name: id,
  parentId,
  type: "department",
});

describe("department hierarchy", () => {
  it("excludes the moving department and all descendants while retaining other branches", () => {
    const departments = [
      dept("Root"),
      dept("Child", "Root"),
      dept("Alt", "Child"),
      dept("Leaf", "Alt"),
      dept("Sibling", "Root"),
    ];
    expect([...departmentSubtreeIds(departments, "Child")]).toEqual(["Child", "Alt", "Leaf"]);
    expect(buildDeptTree(departments).map(({ dept: item, depth }) => [item.id, depth])).toEqual([
      ["Root", 0],
      ["Child", 1],
      ["Alt", 2],
      ["Leaf", 3],
      ["Sibling", 1],
    ]);
  });

  it.each([1, 2, 3])("terminates and deduplicates members in a %i-node legacy cycle", (size) => {
    const departments = Array.from({ length: size }, (_, i) =>
      dept(`Department ${i}`, `Department ${(i + 1) % size}`),
    );
    const ids = departments.map((item) => item.id);
    const counts = computeSubtreeMemberCounts(
      [...departments, dept("Healthy")],
      [
        { id: "Alice", departmentIds: ids },
        { id: "Bob", departmentIds: [ids[0]] },
      ],
    );
    for (const id of ids) {
      expect(departmentSubtreeIds(departments, id).size).toBe(size);
      expect(counts.get(id)).toBe(2);
    }
    expect(counts.get("Healthy")).toBe(0);
  });

  it("counts normal subtrees without duplicating users across memberships", () => {
    expect(
      computeSubtreeMemberCounts(
        [dept("Root"), dept("Child", "Root"), dept("Other")],
        [
          { id: "Alice", departmentIds: ["Root", "Child"] },
          { id: "Bob", departmentIds: ["Child"] },
          { id: "Carol", departmentIds: ["Other"] },
        ],
      ),
    ).toEqual(
      new Map([
        ["Root", 2],
        ["Child", 2],
        ["Other", 1],
      ]),
    );
  });

  it("flattens and walks deep trees without recursive calls", () => {
    const departments = Array.from({ length: 20000 }, (_, i) =>
      dept(`Department ${i}`, i ? `Department ${i - 1}` : null),
    );
    const tree = buildDeptTree(departments);
    expect(tree).toHaveLength(20000);
    expect(tree.at(-1)?.depth).toBe(19999);
    expect(departmentSubtreeIds(departments, "Department 0").size).toBe(20000);
  });
});
