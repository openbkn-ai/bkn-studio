/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn() },
    runtimeConfig: { currentUser: { permissions: [] } },
  }),
}));

vi.mock("@/framework/ui/common/BusinessTreePanel", () => ({
  BusinessTree: ({ treeData }: { treeData: Array<{ children?: TreeNode[]; key: string; title: ReactNode }> }) => {
    const renderNodes = (nodes: TreeNode[]) => (
      <ul>
        {nodes.map((node) => (
          <li key={node.key}>
            {node.title}
            {node.children?.length ? renderNodes(node.children) : null}
          </li>
        ))}
      </ul>
    );
    return renderNodes(treeData);
  },
  BusinessTreePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { DepartmentNavTree } from "./DepartmentNavTree";
import styles from "./DepartmentNavTree.module.css";

type TreeNode = { children?: TreeNode[]; key: string; title: ReactNode };

describe("DepartmentNavTree", () => {
  it("keeps a deep department's three-digit member count separate from its truncatable name", () => {
    render(
      <DepartmentNavTree
        departments={[
          {
            id: "root",
            name: "TEST/500 大部门-B",
            parentId: null,
            subtreeMemberCount: 1,
            type: "department",
          },
          {
            id: "group",
            name: "TEST/500 B-业务组-1",
            parentId: "root",
            subtreeMemberCount: 12,
            type: "department",
          },
          {
            id: "leaf",
            name: "TEST/500 B-业务组-1-小组-1-名称很长",
            parentId: "group",
            subtreeMemberCount: 153,
            type: "department",
          },
        ]}
        onReparent={vi.fn()}
        onSelect={vi.fn()}
        selectedDeptId={null}
        totalUserCount={153}
      />,
    );

    const count = screen.getAllByText("153");
    expect(count).toHaveLength(2);
    expect(count.every((element) => element.classList.contains(styles.countBadge))).toBe(true);

    const name = screen.getByText("TEST/500 B-业务组-1-小组-1-名称很长");
    expect(name.classList.contains(styles.nodeName)).toBe(true);
    expect(name.parentElement?.classList.contains(styles.nodeLeading)).toBe(true);
  });
});
