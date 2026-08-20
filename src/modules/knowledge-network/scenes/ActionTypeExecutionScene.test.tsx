/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ActionTypeActionSource,
  ActionTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

const translate = vi.hoisted(
  () => (key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}`,
);

const mocks = vi.hoisted(() => ({
  accessState: {
    current: {
      access: { modify: false, task_manage: true },
      isLoading: false,
    },
  },
  getDetail: vi.fn(),
  needsResolution: vi.fn(),
  permissions: { current: [] as string[] },
  resolveDisplay: vi.fn(),
  search: { current: "" },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
  useParams: () => ({ actionTypeId: "action-1", networkId: "network-1" }),
  useSearchParams: () => [new URLSearchParams(mocks.search.current), vi.fn()],
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
    runtimeConfig: {
      currentUser: { permissions: mocks.permissions.current },
    },
  }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkOperationAccessState: () => mocks.accessState.current,
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  needsActionTypeActionSourceDisplayResolution: mocks.needsResolution,
  resolveActionTypeActionSourceDisplayWithTimeout: mocks.resolveDisplay,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  executeKnowledgeNetworkActionTypeNow: vi.fn(),
  getKnowledgeNetworkActionTypeDetail: mocks.getDetail,
  updateKnowledgeNetworkActionType: vi.fn(),
}));

vi.mock(
  "@/modules/knowledge-network/components/action-type/ActionTypeExecuteModal",
  () => ({ ActionTypeExecuteModal: () => null }),
);

vi.mock(
  "@/modules/knowledge-network/components/action-type/ActionTypeTaskManagementPanel",
  () => ({ ActionTypeTaskManagementPanel: () => null }),
);

vi.mock(
  "@/modules/knowledge-network/components/shared/KnowledgeNetworkResourceConfigShell",
  () => ({
    KnowledgeNetworkResourceConfigShell: ({
      actions,
      children,
      title,
    }: PropsWithChildren<{ actions?: ReactNode; title: ReactNode }>) => (
      <div>
        <div data-testid="execution-header-actions">{actions}</div>
        <div>{title}</div>
        {children}
      </div>
    ),
  }),
);

import { ActionTypeExecutionScene } from "./ActionTypeExecutionScene";

function createDetail(actionSource: ActionTypeActionSource): ActionTypeDetail {
  return {
    actionKind: "update",
    color: "#1677ff",
    description: "Update an order",
    executionConfig: {
      actionSource,
      parameters: [],
      sourceName: "box-1/tool-1",
      sourceType: actionSource.type,
    },
    id: "action-1",
    name: "Update order",
    objectTypeId: "object-1",
    objectTypeName: "Order",
    tags: [],
    updateTime: "2026-08-20 10:00:00",
    updaterName: "admin",
  };
}

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});
beforeEach(() => {
  mocks.accessState.current = {
    access: { modify: false, task_manage: true },
    isLoading: false,
  };
  mocks.permissions.current = [];
  mocks.search.current = "";
  mocks.getDetail.mockReset();
  mocks.needsResolution.mockReset();
  mocks.resolveDisplay.mockReset();
  mocks.needsResolution.mockImplementation(
    (source?: ActionTypeActionSource) =>
      Boolean(
        source?.type === "tool" &&
          source.boxId &&
          (!source.boxName || (source.toolId && !source.toolName)),
      ),
  );
});

afterEach(() => {
  cleanup();
});

describe("ActionTypeExecutionScene review regressions", () => {
  it("does not expose internal action-source ids without toolbox view access", async () => {
    mocks.getDetail.mockResolvedValue(
      createDetail({ boxId: "box-1", toolId: "tool-1", type: "tool" }),
    );

    render(<ActionTypeExecutionScene />);

    expect(await screen.findByText("Update order")).not.toBeNull();
    await waitFor(() => {
      expect(
        screen.getAllByText("knowledgeNetwork.actionTypeEmptyValue").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText("box-1/tool-1")).toBeNull();
    expect(screen.queryByText("box-1")).toBeNull();
    expect(screen.queryByText("tool-1")).toBeNull();
    expect(mocks.resolveDisplay).not.toHaveBeenCalled();
  });

  it("resolves a readable action-source name when toolbox view is allowed", async () => {
    mocks.permissions.current = ["execution-factory:toolbox:view"];
    mocks.getDetail.mockResolvedValue(
      createDetail({ boxId: "box-1", toolId: "tool-1", type: "tool" }),
    );
    mocks.resolveDisplay.mockResolvedValue({
      boxId: "box-1",
      boxName: "Orders",
      toolId: "tool-1",
      toolName: "Update order",
      type: "tool",
    });

    render(<ActionTypeExecutionScene />);

    expect(await screen.findByText("Orders/Update order")).not.toBeNull();
    expect(screen.queryByText("box-1/tool-1")).toBeNull();
  });

  it("does not flash the readonly warning while modify access is loading", async () => {
    mocks.search.current = "tab=config";
    mocks.accessState.current = {
      access: { modify: false, task_manage: false },
      isLoading: true,
    };
    mocks.getDetail.mockResolvedValue(createDetail({ type: "manual" }));

    render(<ActionTypeExecutionScene />);

    expect(await screen.findByText("Update order")).not.toBeNull();
    expect(
      screen.queryByText("knowledgeNetwork.actionTypeExecutionConfigReadonly"),
    ).toBeNull();
    expect(screen.getByTestId("execution-header-actions").childElementCount).toBe(0);
  });
});
