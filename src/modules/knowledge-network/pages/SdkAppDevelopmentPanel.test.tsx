/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SdkAppDevelopmentPanel } from "./SdkAppDevelopmentPanel";

const mocks = vi.hoisted(() => ({ listKnowledgeNetworks: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

vi.mock("@/modules/knowledge-network/services/network.service", () => ({
  listKnowledgeNetworks: mocks.listKnowledgeNetworks,
}));

function network(id: string, name: string) {
  return { id, name, identifier: `${id}-identifier` };
}

function renderPanel() {
  render(
    <MemoryRouter>
      <SdkAppDevelopmentPanel />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.listKnowledgeNetworks.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SdkAppDevelopmentPanel", () => {
  it("links each network to its App development page", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("kn-1", "Supply chain"), network("kn-2", "Sales")],
      total: 2,
    });
    renderPanel();

    const link = await screen.findByRole("link", { name: /Supply chain/ });
    expect(link).toHaveAttribute("href", "/knowledge-network/workspace/kn-1/develop");
    expect(screen.getByRole("link", { name: /Sales/ })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/kn-2/develop",
    );
    expect(mocks.listKnowledgeNetworks).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: "", page: 1, sortBy: "name" }),
    );
    expect(screen.queryByText(/knowledgeNetwork\.integration\.sdk\.more/)).toBeNull();
  });

  it("says how many more networks a search would reach", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("kn-1", "Supply chain")],
      total: 51,
    });
    renderPanel();

    expect(await screen.findByText("knowledgeNetwork.integration.sdk.more:50")).toBeTruthy();
  });

  it("searches by name and says when nothing matches", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValueOnce({
      items: [network("kn-1", "Supply chain")],
      total: 1,
    });
    mocks.listKnowledgeNetworks.mockResolvedValue({ items: [], total: 0 });
    renderPanel();
    await screen.findByRole("link", { name: /Supply chain/ });

    fireEvent.change(
      screen.getByRole("textbox", { name: "knowledgeNetwork.integration.sdk.searchPlaceholder" }),
      { target: { value: " orders " } },
    );

    expect(await screen.findByText("knowledgeNetwork.integration.sdk.noMatch")).toBeTruthy();
    expect(mocks.listKnowledgeNetworks).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "orders" }),
    );
  });

  it("says when there are no networks at all", async () => {
    mocks.listKnowledgeNetworks.mockResolvedValue({ items: [], total: 0 });
    renderPanel();

    expect(await screen.findByText("knowledgeNetwork.integration.sdk.noNetworks")).toBeTruthy();
  });

  it("offers a retry when the networks cannot be loaded", async () => {
    mocks.listKnowledgeNetworks.mockRejectedValueOnce(new Error("503"));
    mocks.listKnowledgeNetworks.mockResolvedValue({
      items: [network("kn-1", "Supply chain")],
      total: 1,
    });
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "knowledgeNetwork.integration.sdk.loadFailed",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /knowledgeNetwork\.integration\.sdk\.retry/ }),
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Supply chain/ })).toBeTruthy();
    });
  });
});
