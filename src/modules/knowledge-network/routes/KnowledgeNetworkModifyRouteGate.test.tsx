/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";
import { KnowledgeNetworkModifyRouteGate } from "./KnowledgeNetworkModifyRouteGate";

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetwork: vi.fn(),
}));

const mockedGetKnowledgeNetwork = vi.mocked(getKnowledgeNetwork);

function createRecord(operations?: string[]): KnowledgeNetworkRecord {
  return {
    id: "network-1",
    identifier: "network_1",
    name: "Network 1",
    description: "",
    color: "#1677ff",
    ...(operations === undefined ? {} : { operations }),
    tags: [],
    createTime: "",
    updateTime: "",
    creatorName: "",
    updaterName: "",
    statistics: {
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal: 0,
    },
  };
}

function renderGate() {
  return render(
    <MemoryRouter
      initialEntries={["/knowledge-network/workspace/network-1/object-types/create"]}
    >
      <Routes>
        <Route
          element={
            <KnowledgeNetworkModifyRouteGate>
              <div>modify form</div>
            </KnowledgeNetworkModifyRouteGate>
          }
          path="/knowledge-network/workspace/:networkId/object-types/create"
        />
        <Route
          element={<div>overview page</div>}
          path="/knowledge-network/workspace/:networkId/overview"
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("KnowledgeNetworkModifyRouteGate", () => {
  beforeEach(() => {
    mockedGetKnowledgeNetwork.mockReset();
  });

  it("renders children when modify is allowed", async () => {
    mockedGetKnowledgeNetwork.mockResolvedValue(createRecord(["modify"]));

    renderGate();

    expect(await screen.findByText("modify form")).toBeTruthy();
  });

  it("redirects to overview when modify is forbidden", async () => {
    mockedGetKnowledgeNetwork.mockResolvedValue(createRecord(["view_detail"]));

    renderGate();

    expect(await screen.findByText("overview page")).toBeTruthy();
  });

  it("redirects to overview when the backend omits operations", async () => {
    mockedGetKnowledgeNetwork.mockResolvedValue(createRecord());

    renderGate();

    expect(await screen.findByText("overview page")).toBeTruthy();
  });

  it("shows the request failure instead of redirecting on non-permission errors", async () => {
    mockedGetKnowledgeNetwork.mockRejectedValue(
      Object.assign(new Error("backend unavailable"), {
        response: { status: 500 },
      }),
    );

    renderGate();

    expect(await screen.findByText("backend unavailable")).toBeTruthy();
    expect(screen.queryByText("overview page")).toBeNull();
  });
});
