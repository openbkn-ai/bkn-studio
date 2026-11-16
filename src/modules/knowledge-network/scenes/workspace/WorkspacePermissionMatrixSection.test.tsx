/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionSourceDecision } from "@/modules/system-admin/services/authz.service";

import { WorkspacePermissionMatrixSection } from "./WorkspacePermissionMatrixSection";

const mocks = vi.hoisted(() => ({
  effective: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown>[]>>(),
  roles: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  users: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  objectTypes: vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  row: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  property: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  sources: vi.fn<(...args: unknown[]) => Promise<PermissionSourceDecision[]>>(),
  metrics: vi.fn<(...args: unknown[]) => Promise<{ entries: []; total_count: number }>>(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));
vi.mock("@/modules/system-admin/services/authz.service", () => ({
  listGrantableRolesForObject: (...args: unknown[]) => mocks.roles(...args),
  listGrantableUsersForObject: (...args: unknown[]) => mocks.users(...args),
  projectNetworkPermissions: (...args: unknown[]) => mocks.effective(...args),
  getNetworkPermissionSources: (...args: unknown[]) => mocks.sources(...args),
}));
vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: ({
    objName,
    objId,
    objectAuthorized,
  }: {
    objName: string;
    objId: string;
    objectAuthorized: boolean;
  }) => (
    <div data-testid="authorization-target">
      {objName}|{objId}|{String(objectAuthorized)}
    </div>
  ),
}));
vi.mock("@/modules/system-admin/services/authorization-registry.service", () => ({
  getAuthorizationRegistry: () => Promise.resolve({ resourceTypes: [] }),
}));
vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypes: (...args: unknown[]) => mocks.objectTypes(...args),
}));
vi.mock("@/modules/knowledge-network/services/relation-type.service", () => ({
  listKnowledgeNetworkRelationTypes: () => Promise.resolve([]),
}));
vi.mock("@/modules/knowledge-network/services/action-type.service", () => ({
  listKnowledgeNetworkActionTypes: () => Promise.resolve([]),
}));
vi.mock("@/modules/knowledge-network/services/concept-group.service", () => ({
  listKnowledgeNetworkConceptGroups: () => Promise.resolve([]),
}));
vi.mock("@/modules/knowledge-network/services/object-metric.service", () => ({
  listObjectMetricsV1: (...args: unknown[]) => mocks.metrics(...args),
}));
vi.mock("@/modules/knowledge-network/services/row-filter-authorization.service", () => ({
  explainRowFilter: async (...args: unknown[]) => ({
    snapshot: await mocks.row(...args),
    rolePolicies: [],
  }),
}));
vi.mock("@/modules/knowledge-network/services/property-authorization.service", () => ({
  getEffectivePropertySnapshot: (...args: unknown[]) => mocks.property(...args),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.sources.mockResolvedValue([]);
  mocks.metrics.mockResolvedValue({ entries: [], total_count: 0 });
  mocks.roles.mockResolvedValue([{ id: "sales", name: "Sales", description: "" }]);
  mocks.users.mockResolvedValue([{ id: "user-1", name: "Awei Zhu", account: "awei" }]);
  mocks.objectTypes.mockResolvedValue([
    { id: "orders", name: "Orders", operations: ["view_detail"] },
    { id: "stock", name: "Stock", operations: ["view_detail"] },
  ]);
  mocks.effective.mockResolvedValue([
    {
      accessorId: "sales",
      accessorType: "role",
      objId: "network-1/orders",
      objType: "object_type",
      objName: "Orders",
      operations: ["view_detail"],
      deniedOperations: [],
      effectiveDecisions: [
        { operation: "view_detail", decision: "allow", basis: "inherited", requires: [] },
      ],
      grants: [
        {
          active: true,
          accessorId: "sales",
          authoritySource: "admin_authz",
          effect: "allow",
          grantId: "grant-1",
          inherited: true,
          operation: "view_detail",
          policySource: "role_permission",
        },
      ],
    },
  ]);
  mocks.row.mockResolvedValue({
    revision: "1",
    availableFields: [{ name: "status", displayName: "Order status", type: "string" }],
    policy: {
      relation: "and",
      conditions: [{ propertyName: "status", operator: "in", values: ["active"] }],
    },
  });
  mocks.property.mockResolvedValue({
    entries: [{ propertyName: "customer_id", level: "masked", source: "manual" }],
  });
});

function renderMatrix(
  fineGrainedAvailable = true,
  fineGrainedStatus?: "not-licensed" | "not-installed" | "unknown",
  metricsAvailable = true,
) {
  render(
    <WorkspacePermissionMatrixSection
      networkId="network-1"
      networkName="Network"
      canAuthorize
      fineGrainedAvailable={fineGrainedAvailable}
      fineGrainedStatus={fineGrainedStatus}
      metricsAvailable={metricsAvailable}
    />,
  );
}
async function selectRole() {
  fireEvent.click(screen.getByText("knowledgeNetwork.permissionMatrix.subjectTypes.role"));
  fireEvent.click(await screen.findByText("Sales"));
}

describe("WorkspacePermissionMatrixSection", () => {
  it("does not request or display metrics when the capability is unavailable", async () => {
    renderMatrix(true, undefined, false);
    await selectRole();
    expect(mocks.metrics).not.toHaveBeenCalled();
    expect(screen.queryByRole("tab", { name: /metricsTabBase/ })).not.toBeInTheDocument();
  });
  it.each(["network-1", "missing-network"])(
    "manages the actual parent source, or hides unknown targets (%s)",
    async (resourceId) => {
      mocks.objectTypes.mockResolvedValue([{ id: "orders", name: "Orders", operations: [] }]);
      mocks.sources.mockResolvedValue([
        {
          operation: "view_detail",
          decision: "allow",
          basis: "inherited",
          steps: [
            {
              resource_type: "knowledge_network",
              resource_id: resourceId,
              matched_grants: [
                {
                  grant_id: "parent-grant",
                  subject_id: "sales",
                  subject_kind: "role",
                  subject_name: "Sales",
                  effect: "allow",
                  operation: "view_detail",
                  object: `knowledge_network:${resourceId}`,
                  management: {
                    kind: "object_grants",
                    can_manage: true,
                    resource_type: "knowledge_network",
                    resource_id: resourceId,
                  },
                },
              ],
            },
          ],
        },
      ]);
      renderMatrix();
      await selectRole();
      fireEvent.click(
        (await screen.findAllByText("knowledgeNetwork.permissionMatrix.viewSources"))[0],
      );
      await waitFor(() => expect(mocks.sources).toHaveBeenCalled());
      if (resourceId === "network-1") {
        fireEvent.click(await screen.findByText("knowledgeNetwork.permissionMatrix.manageSource"));
        expect(await screen.findByTestId("authorization-target")).toHaveTextContent(
          "Network|network-1|true",
        );
      } else {
        expect(
          screen.queryByText("knowledgeNetwork.permissionMatrix.manageSource"),
        ).not.toBeInTheDocument();
      }
    },
  );
  it.each(["not-licensed", "not-installed"] as const)(
    "labels unavailable fine-grained permissions as Enterprise features (%s)",
    async (status) => {
      renderMatrix(false, status);
      await selectRole();
      expect(
        (await screen.findAllByText("knowledgeNetwork.permissionMatrix.enterpriseCapability"))
          .length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByText("knowledgeNetwork.permissionMatrix.viewDetails"),
      ).not.toBeInTheDocument();
      expect(mocks.row).not.toHaveBeenCalled();
      expect(mocks.property).not.toHaveBeenCalled();
    },
  );
  it("stops showing loading text after row detail fails and allows retry", async () => {
    mocks.row.mockRejectedValueOnce(new Error("bad request"));
    renderMatrix();
    await selectRole();
    fireEvent.click(
      (await screen.findAllByText("knowledgeNetwork.permissionMatrix.viewDetails"))[0],
    );
    await screen.findAllByText("knowledgeNetwork.permissionMatrix.detailFailed");
    expect(
      screen.queryByText("knowledgeNetwork.permissionMatrix.detailLoading"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "knowledgeNetwork.permissionMatrix.retry",
      }),
    );
    expect(await screen.findByText("Order status")).toBeInTheDocument();
  });
  it("loads effective fields independently of row rules and displays business names", async () => {
    mocks.row.mockImplementation(() => new Promise(() => {}));
    mocks.property.mockResolvedValue({
      entries: [],
      decisions: [
        {
          name: "phone",
          displayName: "Contact phone",
          level: "masked",
          source: "property",
        },
      ],
    });
    renderMatrix();
    await selectRole();
    fireEvent.click(
      (await screen.findAllByText("knowledgeNetwork.permissionMatrix.viewDetails"))[1],
    );
    expect(await screen.findByText("Contact phone")).toBeInTheDocument();
    expect(mocks.row).not.toHaveBeenCalled();
    expect(mocks.property).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sales", type: "role" }),
      "network-1/orders",
      expect.objectContaining({ skipErrorToast: true }),
    );
  });
  it("shows page configuration counts without fetching full row or field details", async () => {
    const [grant] = await mocks.effective();
    mocks.effective.mockResolvedValue([
      {
        ...grant,
        configurationSummary: {
          row_policies: 1,
          row_conditions: 2,
          field_rules: 3,
          masked_rules: 1,
          hidden_rules: 2,
        },
      },
    ]);
    renderMatrix();
    await selectRole();
    expect(await screen.findByText(/permissionMatrix.rowRuleCount.*"count":2/)).toBeInTheDocument();
    expect(
      await screen.findByText(/permissionMatrix.fieldSummary.*"masked":1/),
    ).toBeInTheDocument();
    expect(mocks.row).not.toHaveBeenCalled();
    expect(mocks.property).not.toHaveBeenCalled();
  });
  it("keeps row and field columns visible when the capability is unavailable", async () => {
    renderMatrix(false);
    await selectRole();
    expect(
      screen.getByRole("columnheader", { name: "knowledgeNetwork.permissionMatrix.rowScope" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "knowledgeNetwork.permissionMatrix.fieldScope" }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText("knowledgeNetwork.permissionMatrix.capabilityUnavailable"))
        .length,
    ).toBeGreaterThan(0);
    expect(mocks.row).not.toHaveBeenCalled();
  });
  it("bounds projection to ten resources and aborts it when switching tabs", async () => {
    mocks.objectTypes.mockResolvedValue(
      Array.from({ length: 21 }, (_value, index) => ({
        id: `object-${index}`,
        name: `Object ${index}`,
        operations: ["view_detail"],
      })),
    );
    renderMatrix();
    await selectRole();
    await waitFor(() => expect(mocks.effective).toHaveBeenCalled());
    const call = mocks.effective.mock.calls.at(-1)!;
    expect(call[2]).toHaveLength(10);
    expect(mocks.row).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: /networkTab/ }));
    await waitFor(() => expect((call[3] as AbortSignal).aborted).toBe(true));
  });
  it("shows object operations, row scope and field scope in one object-permission table", async () => {
    renderMatrix();
    await selectRole();
    expect(await screen.findByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Stock")).toBeInTheDocument();
    expect(mocks.row).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByText("knowledgeNetwork.permissionMatrix.viewDetails")[0]);
    expect(await screen.findByText("Order status")).toBeInTheDocument();
    expect(await screen.findByText("active")).toBeInTheDocument();
  });
  it("uses the selected subject to request server-computed effective permissions", async () => {
    renderMatrix();
    await selectRole();
    await waitFor(() =>
      expect(mocks.effective).toHaveBeenCalledWith(
        "network-1",
        expect.objectContaining({ id: "sales", type: "role" }),
        [
          { type: "object_type", id: "network-1/orders" },
          { type: "object_type", id: "network-1/stock" },
        ],
        expect.any(AbortSignal),
      ),
    );
  });
  it("keeps network, action type, and metric permissions in separate resource tabs", () => {
    renderMatrix();
    expect(screen.getByRole("tab", { name: /networkTabBase/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /actionsTabBase/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /metricsTabBase/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /rowsTab/ })).not.toBeInTheDocument();
  });
});
