/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const networkAuthorize = vi.hoisted(() => ({ current: true }));

vi.mock("react-router-dom", () => ({ useParams: () => ({ networkId: "network-1" }) }));
vi.mock("@/modules/knowledge-network/hooks/useKnowledgeNetworkCanModify", () => ({
  useKnowledgeNetworkCanOperate: () => networkAuthorize.current,
}));

import { KnowledgeNetworkResourceDetailActions } from "./KnowledgeNetworkResourceDetailActions";

describe("KnowledgeNetworkResourceDetailActions", () => {
  const createActions = () => [
    {
      key: "edit",
      label: "Edit",
      onClick: vi.fn(),
      operation: "modify",
      type: "primary" as const,
    },
    {
      danger: true,
      key: "delete",
      label: "Delete",
      onClick: vi.fn(),
      operation: "delete",
    },
  ];

  it("renders and runs only actions granted by the record", () => {
    const actions = createActions();

    render(
      <KnowledgeNetworkResourceDetailActions
        actions={actions}
        record={{ operations: ["modify"] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(actions[0].onClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("renders no buttons without matching operations", () => {
    const { container } = render(
      <KnowledgeNetworkResourceDetailActions actions={createActions()} record={{ operations: [] }} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("supports wildcard access", () => {
    render(
      <KnowledgeNetworkResourceDetailActions
        actions={createActions()}
        record={{ operations: ["*"] }}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("uses network authorize plus child view instead of child authorize", () => {
    const action = {
      key: "authorize",
      label: "Authorize",
      onClick: vi.fn(),
      operation: "authorize",
    };
    const { rerender } = render(
      <KnowledgeNetworkResourceDetailActions
        actions={[action]}
        record={{ operations: ["view_detail"] }}
      />,
    );
    expect(screen.getByRole("button", { name: /Authorize/ })).not.toBeNull();
    expect(screen.getByText("common.entitlement.editionsShort.professional")).not.toBeNull();

    networkAuthorize.current = false;
    rerender(
      <KnowledgeNetworkResourceDetailActions
        actions={[action]}
        record={{ operations: ["view_detail", "authorize"] }}
      />,
    );
    expect(screen.queryByRole("button", { name: /Authorize/ })).toBeNull();
    networkAuthorize.current = true;
  });
});
