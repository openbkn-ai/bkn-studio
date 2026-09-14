/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActionTypeDetail } from "@/modules/knowledge-network/types/knowledge-network";

import { ActionTypeExecutionConfigTable } from "./ActionTypeExecutionConfigTable";

const getKnowledgeNetworkObjectTypeDetail = vi.hoisted(() => vi.fn());
const needsActionTypeActionSourceDisplayResolution = vi.hoisted(() => vi.fn());
const resolveActionTypeActionSourceDisplayWithTimeout = vi.hoisted(() => vi.fn());
const resolveActionTypeToolInputSchema = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectTypeDetail,
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
  resolveActionTypeToolInputSchema,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    writable: true,
  });
});

beforeEach(() => {
  getKnowledgeNetworkObjectTypeDetail.mockReset();
  needsActionTypeActionSourceDisplayResolution.mockReset();
  needsActionTypeActionSourceDisplayResolution.mockReturnValue(false);
  resolveActionTypeActionSourceDisplayWithTimeout.mockReset();
  resolveActionTypeActionSourceDisplayWithTimeout.mockImplementation((source) =>
    Promise.resolve(source),
  );
  resolveActionTypeToolInputSchema.mockReset();
});

function createDetail(parameters: ActionTypeDetail["executionConfig"]["parameters"]) {
  return {
    actionKind: "update",
    color: "#16a34a",
    description: "",
    executionConfig: {
      actionSource: {
        boxId: "box-1",
        boxName: "Order tools",
        toolId: "tool-1",
        toolName: "Update order",
        type: "tool",
      },
      parameters,
      sourceName: "Order tools/Update order",
      sourceType: "tool",
    },
    id: "action-1",
    name: "Update order",
    objectTypeId: "order",
    objectTypeName: "Order",
    tags: [],
    updateTime: "",
    updaterName: "",
  } satisfies ActionTypeDetail;
}

describe("ActionTypeExecutionConfigTable", () => {
  it("shows property, dynamic input, and constant parameters in detail view", async () => {
    getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({
      dataProperties: [{ name: "order_id", type: "string" }],
    });
    resolveActionTypeToolInputSchema.mockResolvedValue([
      {
        key: "path_order_id",
        name: "path_order_id",
        source: "Path",
        type: "string",
      },
      {
        key: "body_reason",
        name: "body_reason",
        source: "Body",
        type: "string",
      },
      {
        key: "query_notify",
        name: "query_notify",
        source: "Query",
        type: "boolean",
      },
    ]);

    render(
      <ActionTypeExecutionConfigTable
        canResolveActionSource
        detail={createDetail([
          {
            name: "path_order_id",
            sourcePropertyName: "order_id",
            value: "order_id",
            valueFrom: "property",
          },
          {
            name: "body_reason",
            valueFrom: "input",
          },
          {
            name: "query_notify",
            value: "true",
            valueFrom: "const",
          },
          {
            name: "   ",
            source: "Body",
            type: "string",
            valueFrom: "input",
          },
        ])}
        networkId="network-1"
      />,
    );

    expect(screen.getByText("path_order_id")).toBeTruthy();
    expect(screen.getByText("body_reason")).toBeTruthy();
    expect(screen.getByText("query_notify")).toBeTruthy();
    expect(screen.queryByText("   ")).toBeNull();
    expect(await screen.findByText("Path")).toBeTruthy();
    expect(await screen.findByText("Body")).toBeTruthy();
    expect(await screen.findByText("Query")).toBeTruthy();
    expect(screen.getByText("boolean")).toBeTruthy();
    expect(screen.getByText("order_id")).toBeTruthy();
    expect(screen.getByText("true")).toBeTruthy();
    expect(
      screen.getAllByText("knowledgeNetwork.actionTypeExecutionValueFromInput").length,
    ).toBeGreaterThan(0);
  });

  it("keeps the empty state only when no named parameters are saved", () => {
    getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
    resolveActionTypeToolInputSchema.mockResolvedValue([]);

    render(
      <ActionTypeExecutionConfigTable
        canResolveActionSource
        detail={createDetail([{ name: " ", valueFrom: "input" }])}
        networkId="network-1"
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.actionTypeExecutionParameterEmpty"),
    ).toBeTruthy();
  });

  it("does not expose source ids without toolbox access", () => {
    needsActionTypeActionSourceDisplayResolution.mockReturnValue(true);

    render(
      <ActionTypeExecutionConfigTable
        canResolveActionSource={false}
        detail={createDetail([{ name: "body_reason", valueFrom: "input" }])}
        networkId="network-1"
      />,
    );

    expect(resolveActionTypeActionSourceDisplayWithTimeout).not.toHaveBeenCalled();
    expect(resolveActionTypeToolInputSchema).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("knowledgeNetwork.actionTypeEmptyValue").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/box-1|tool-1/)).toBeNull();
  });
});
