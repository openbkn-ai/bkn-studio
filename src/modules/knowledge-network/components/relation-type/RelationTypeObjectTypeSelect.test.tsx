/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkObjectTypeRecord } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  listObjectTypePage: vi.fn(),
}));

vi.mock("antd", () => ({
  Select: ({
    onSearch,
    options,
  }: {
    onSearch: (value: string) => void;
    options: Array<{ label: string }>;
  }) => (
    <div>
      <input aria-label="object type" onChange={(event) => onSearch(event.target.value)} />
      {options.map((option) => (
        <span key={option.label}>{option.label}</span>
      ))}
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/components/shared/ResourceIconSelect", () => ({
  renderResourceIcon: () => null,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectType: vi.fn(),
  listKnowledgeNetworkObjectTypePage: mocks.listObjectTypePage,
}));

import { RelationTypeObjectTypeSelect } from "./RelationTypeObjectTypeSelect";

function objectType(id: string, name: string, color = "#2f54eb"): KnowledgeNetworkObjectTypeRecord {
  return {
    color,
    conceptGroupIds: [],
    conceptGroupNames: [],
    description: "",
    hasIndex: false,
    id,
    name,
    tags: [],
    updateTime: "",
    updaterName: "",
  };
}

describe("RelationTypeObjectTypeSelect", () => {
  it("replaces stale options with remote search results while preserving the selected option", async () => {
    mocks.listObjectTypePage.mockResolvedValue({
      entries: [{ color: "#222222", id: "target", name: "Target object" }],
      totalCount: 1,
    });

    render(
      <RelationTypeObjectTypeSelect
        networkId="network-1"
        objectTypes={[
          objectType("selected", "Selected object", "#111111"),
          objectType("stale", "Stale object", "#333333"),
        ]}
        value="selected"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "object type" }), {
      target: { value: "Target" },
    });

    await waitFor(() => expect(screen.getByText("Target object")).not.toBeNull());
    expect(screen.getByText("Selected object")).not.toBeNull();
    expect(screen.queryByText("Stale object")).toBeNull();
    expect(mocks.listObjectTypePage).toHaveBeenCalledWith("network-1", {
      direction: "asc",
      limit: 20,
      namePattern: "Target",
      offset: 0,
      sort: "name",
    });
  });

  it("filters remotely resolved options before rendering them", async () => {
    mocks.listObjectTypePage.mockResolvedValue({
      entries: [
        { color: "#222222", id: "allowed", name: "Allowed object" },
        { color: "#333333", id: "denied", name: "Denied object" },
      ],
      totalCount: 2,
    });

    render(
      <RelationTypeObjectTypeSelect
        filterResolvedOptions={(items) => items.filter((item) => item.id === "allowed")}
        networkId="network-1"
        objectTypes={[]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "object type" }), {
      target: { value: "object" },
    });

    await waitFor(() => expect(screen.getByText("Allowed object")).not.toBeNull());
    expect(screen.queryByText("Denied object")).toBeNull();
  });
});
