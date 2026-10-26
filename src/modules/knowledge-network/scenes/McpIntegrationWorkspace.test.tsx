/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { McpIntegrationWorkspace } from "./McpIntegrationWorkspace";

const mocks = vi.hoisted(() => ({
  listKnowledgeNetworks: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("antd", () => ({
  Select: ({
    disabled,
    onChange,
    options,
    placeholder,
    value,
  }: {
    disabled?: boolean;
    onChange: (value?: string) => void;
    options: Array<{ label: string; value: string }>;
    placeholder?: string;
    value?: string;
  }) => (
    <select
      aria-label="knowledgeNetwork.integration.mcpWorkspace.networkLabel"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value || undefined)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/modules/knowledge-network/services/network.service", () => ({
  listKnowledgeNetworks: mocks.listKnowledgeNetworks,
}));

vi.mock("@/modules/knowledge-network/scenes/ExperienceScene", () => ({
  ExperienceScene: ({
    network,
    showMcpConnect,
  }: {
    network?: { slug: string };
    showMcpConnect?: boolean;
  }) => (
    <div data-testid="experience-scene">
      {showMcpConnect ? "connect" : `debug:${network?.slug ?? "missing"}`}
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderWorkspace(path = "/knowledge-network/integration") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <McpIntegrationWorkspace />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function network(id: string, identifier: string, name: string) {
  return {
    color: "#126ee3",
    createTime: "",
    creatorName: "",
    description: "",
    id,
    identifier,
    name,
    operations: ["query_data"],
    statistics: {
      actionTypesTotal: 0,
      apisTotal: 0,
      conceptGroupsTotal: 0,
      functionsTotal: 0,
      mcpToolsTotal: 0,
      metricsTotal: 0,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      skillsTotal: 0,
    },
    tags: [],
    updateTime: "",
    updaterName: "",
  };
}

describe("McpIntegrationWorkspace", () => {
  beforeEach(() => {
    mocks.listKnowledgeNetworks.mockReset();
  });

  it("keeps client setup platform-scoped without loading knowledge networks", () => {
    renderWorkspace();

    expect(screen.getByTestId("experience-scene")).toHaveTextContent("connect");
    expect(mocks.listKnowledgeNetworks).not.toHaveBeenCalled();
  });

  it("requires an explicit network and writes the selected network to the URL", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("network-1", "sales_kn", "Sales")],
      total: 1,
    });
    renderWorkspace("/knowledge-network/integration?tab=mcp&mcpView=debug");

    expect(await screen.findByRole("combobox")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Sales (sales_kn)" })).toBeTruthy();
    });
    expect(screen.queryByTestId("experience-scene")).toBeNull();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "network-1" } });

    expect(await screen.findByTestId("experience-scene")).toHaveTextContent("debug:sales_kn");
    expect(
      screen.getByRole("link", {
        name: /knowledgeNetwork\.integration\.mcpWorkspace\.openNetwork/,
      }),
    ).toHaveAttribute("href", "/knowledge-network/workspace/network-1/overview");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/knowledge-network/integration?tab=mcp&mcpView=debug&networkId=network-1",
    );
  });

  it("preserves the selected network while viewing client setup", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("network-1", "sales_kn", "Sales")],
      total: 1,
    });
    renderWorkspace("/knowledge-network/integration?tab=mcp&mcpView=debug&networkId=network-1");

    expect(await screen.findByTestId("experience-scene")).toHaveTextContent("debug:sales_kn");

    fireEvent.click(
      screen.getByRole("tab", {
        name: "knowledgeNetwork.integration.mcpWorkspace.tabs.connect",
      }),
    );

    expect(screen.getByTestId("experience-scene")).toHaveTextContent("connect");
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/knowledge-network/integration?tab=mcp&mcpView=connect&networkId=network-1",
    );
  });

  it("does not silently replace an unavailable network from a legacy link", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("network-1", "sales_kn", "Sales")],
      total: 1,
    });
    renderWorkspace(
      "/knowledge-network/integration?tab=mcp&mcpView=debug&networkId=missing-network",
    );

    expect(
      await screen.findByText("knowledgeNetwork.integration.mcpWorkspace.networkUnavailableTitle"),
    ).toBeTruthy();
    expect(screen.queryByTestId("experience-scene")).toBeNull();
  });
});
