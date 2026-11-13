/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render as renderInPage, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getExistingIndexMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key} ${JSON.stringify(values)}` : key,
  }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", () => ({
  getExistingIndex: getExistingIndexMock,
}));

import { ExistingIndexes } from "./ExistingIndexes";

const render = (element: ReactElement) => renderInPage(<MemoryRouter>{element}</MemoryRouter>);

const item = (id: string, state: string) => ({
  build: null,
  fullRebuildOnly: false,
  id,
  missing: [],
  name: `Name ${id}`,
  state,
  table: { catalogId: "c1", name: `table_${id}`, resourceId: `t_${id}` },
  task: null,
  updateField: { candidates: [], pending: false, property: "" },
});

// Ant Design's tables read media queries, which jsdom lacks.
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

describe("ExistingIndexes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the network's indexes, marked and read only", async () => {
    getExistingIndexMock.mockResolvedValue({
      counts: { not_built: 1, ready: 1 },
      objectTypes: [item("regions", "ready"), item("orders", "not_built")],
      tasksVisible: true,
    });

    render(<ExistingIndexes networkId="kn1" projectId="p1" />);

    expect(await screen.findByText("Name regions")).toBeInTheDocument();
    expect(getExistingIndexMock).toHaveBeenCalledWith("p1");
    expect(screen.getByText("table_orders")).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.networkExisting.index.summary {"ready":1,"total":2}'),
    ).toBeInTheDocument();
    // A dot for the title and one for each row; nothing here builds.
    expect(screen.getAllByTestId("network-existing-dot")).toHaveLength(3);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says an index the network has not built in business words, with where it is built", async () => {
    getExistingIndexMock.mockResolvedValue({
      counts: { not_built: 1, not_configured: 1, ready: 1 },
      objectTypes: [
        item("regions", "ready"),
        item("orders", "not_configured"),
        item("items", "not_built"),
      ],
      tasksVisible: true,
    });

    render(<ExistingIndexes networkId="kn1" projectId="p1" />);

    expect(await screen.findByText("Name orders")).toBeInTheDocument();
    expect(screen.getAllByText("bknProject.networkExisting.index.notIndexed")).toHaveLength(2);
    expect(screen.queryByText("bknProject.release.index.state.not_configured")).toBeNull();
    expect(screen.queryByText("bknProject.release.index.state.not_built")).toBeNull();
    const links = screen.getAllByRole("link", { name: "bknProject.networkExisting.index.open" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/knowledge-network/workspace/kn1/object-types/orders/detail",
      "/knowledge-network/workspace/kn1/object-types/items/detail",
    ]);
    expect(screen.getByText("bknProject.release.index.state.ready")).toBeInTheDocument();
  });

  it("shows nothing on a new network", async () => {
    getExistingIndexMock.mockResolvedValue({ counts: {}, objectTypes: [], tasksVisible: true });

    const { container } = render(<ExistingIndexes networkId="kn1" projectId="p1" />);

    await waitFor(() => expect(getExistingIndexMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the indexes cannot be read", async () => {
    getExistingIndexMock.mockRejectedValue(new Error("boom"));

    const { container } = render(<ExistingIndexes networkId="kn1" projectId="p1" />);

    await waitFor(() => expect(getExistingIndexMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
