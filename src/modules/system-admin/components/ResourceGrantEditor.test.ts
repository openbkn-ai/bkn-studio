/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registryMocks = vi.hoisted(() => ({
  catalog: undefined as undefined | { resourceTypes: Array<{ id: string }> },
  catalogLoading: true,
  operationsForType: vi.fn<(type: string) => Array<{ key: string; label: string; requires: string[] }>>(
    () => [],
  ),
  resourceTypeOptions: vi.fn<() => Array<{ label: string; value: string }>>(() => []),
  retryAuthorizationRegistry: vi.fn(),
}));

vi.mock("@/modules/system-admin/hooks/use-authorization-registry", () => ({
  useAuthorizationRegistry: () => ({
    catalog: registryMocks.catalog,
    catalogError: undefined,
    catalogLoading: registryMocks.catalogLoading,
    operationsForType: registryMocks.operationsForType,
    resourceTypeOptions: registryMocks.resourceTypeOptions,
    retryAuthorizationRegistry: registryMocks.retryAuthorizationRegistry,
  }),
}));

import {
  addOperationToGrant,
  availableOperationsForGrant,
  removeOperationFromGrant,
} from "@/modules/system-admin/utils/resource-grant-operations";
import type { ResourceGrant } from "@/modules/system-admin/types/admin";
import { ResourceGrantEditor } from "./ResourceGrantEditor";

function resolveRoleGrantId(wholeType: boolean, draftId: string) {
  return wholeType ? "*" : draftId.trim();
}

const catalogGrant: ResourceGrant = {
  resource: { type: "catalog", id: "*" },
  operations: ["view_detail", "query"],
};

describe("ResourceGrantEditor operation changes", () => {
  beforeEach(() => {
    registryMocks.catalog = undefined;
    registryMocks.catalogLoading = true;
    registryMocks.operationsForType.mockReturnValue([]);
    registryMocks.resourceTypeOptions.mockReturnValue([]);
  });

  it("clears the stale wildcard when switching from all resources to a specific scope", () => {
    let draftId = "*";
    let wholeType = true;

    wholeType = false;
    draftId = "";

    expect(resolveRoleGrantId(wholeType, draftId)).toBe("");
    expect(resolveRoleGrantId(true, draftId)).toBe("*");
  });

  it("resolves a concrete resource id when all-resources scope is disabled", () => {
    const wholeType = false;
    const draftId = "  catalog-1  ";

    expect(resolveRoleGrantId(wholeType, draftId)).toBe("catalog-1");
  });

  it("adds an operation to the existing resource grant without replacing other operations", () => {
    expect(addOperationToGrant([catalogGrant], catalogGrant, "create")).toEqual([
      { ...catalogGrant, operations: ["view_detail", "query", "create"] },
    ]);
  });

  it("removes only the selected operation", () => {
    expect(removeOperationFromGrant([catalogGrant], catalogGrant, "query")).toEqual([
      { ...catalogGrant, operations: ["view_detail"] },
    ]);
  });

  it("removes the entire grant after its last operation is removed", () => {
    const singleOperationGrant = { ...catalogGrant, operations: ["query"] };

    expect(removeOperationFromGrant([singleOperationGrant], singleOperationGrant, "query")).toEqual([]);
  });

  it("locks existing grants until the authorization registry is ready", () => {
    const { container } = render(createElement(ResourceGrantEditor, {
      onChange: vi.fn(),
      value: [catalogGrant],
    }));

    expect(container.querySelector(".ant-tag-close-icon")).toBeNull();
    expect(container.querySelector(".ant-btn-dangerous")).toBeNull();
  });

  it("keeps a grant locked when its resource contract is absent", () => {
    registryMocks.catalog = { resourceTypes: [{ id: "resource" }] };
    registryMocks.catalogLoading = false;
    registryMocks.operationsForType.mockImplementation(() => []);
    registryMocks.resourceTypeOptions.mockReturnValue([{ label: "Data resource", value: "resource" }]);

    const { container } = render(createElement(ResourceGrantEditor, {
      onChange: vi.fn(),
      value: [catalogGrant],
    }));

    expect(container.querySelector(".ant-tag-close-icon")).toBeNull();
    expect(container.querySelector(".ant-btn-dangerous")).toBeNull();
  });

  function mockCatalogOperations() {
    registryMocks.catalog = { resourceTypes: [{ id: "catalog" }] };
    registryMocks.catalogLoading = false;
    registryMocks.operationsForType.mockImplementation((type) => type === "catalog"
      ? [
        { key: "view_detail", label: "View details", requires: [] },
        { key: "create", label: "Create", requires: [] },
        { key: "modify", label: "Modify", requires: ["view_detail"] },
      ]
      : []);
    registryMocks.resourceTypeOptions.mockReturnValue([{ label: "Data catalog", value: "catalog" }]);
  }

  it("uses the card-based operation picker for role grants", () => {
    mockCatalogOperations();

    const onChange = vi.fn();
    render(createElement(ResourceGrantEditor, { onChange, value: [] }));

    const viewDetails = screen.getByRole("button", { name: /view details/i });
    const modify = screen.getByRole("button", { name: /modify/i });
    expect(viewDetails).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("radio", { name: "全部资源" })).toBeChecked();

    fireEvent.click(modify);

    expect(viewDetails).toHaveAttribute("aria-pressed", "true");
    expect(modify).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("does not offer instance-only hidden operations when editing a specific grant", () => {
    mockCatalogOperations();
    const specificGrant: ResourceGrant = {
      resource: { type: "catalog", id: "catalog-1" },
      operations: ["view_detail"],
    };

    expect(availableOperationsForGrant(specificGrant, registryMocks.operationsForType("catalog")))
      .toEqual([{ key: "modify", label: "Modify", requires: ["view_detail"] }]);
  });

  it("locks an existing prerequisite while a selected operation depends on it", () => {
    mockCatalogOperations();
    const dependentGrant: ResourceGrant = {
      resource: { type: "catalog", id: "catalog-1" },
      operations: ["view_detail", "modify"],
    };

    const { container } = render(createElement(ResourceGrantEditor, {
      onChange: vi.fn(),
      value: [dependentGrant],
    }));

    const viewDetails = screen.getByText("查看详情").closest(".ant-tag");
    const modify = screen.getByText("修改").closest(".ant-tag");
    expect(viewDetails?.querySelector(".ant-tag-close-icon")).toBeNull();
    expect(modify?.querySelector(".ant-tag-close-icon")).not.toBeNull();
    expect(container.querySelectorAll(".ant-tag-close-icon")).toHaveLength(1);
  });
});
