/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const existingMock = vi.hoisted(() => vi.fn());
const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/modules/bkn-project/services/draft.service", () => ({
  getExistingDefinitions: existingMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ExistingDefinitions } from "./ExistingDefinitions";

const existing = {
  objectTypes: [
    {
      aliases: [],
      description: "",
      id: "material",
      name: "物料",
      primaryKeys: ["material_code"],
      propertyCount: 15,
      tableId: "t1",
    },
    {
      aliases: [],
      description: "",
      id: "supplier",
      name: "供应商",
      primaryKeys: [],
      propertyCount: 5,
      tableId: "t2",
    },
  ],
  relationTypes: [
    {
      aliases: [],
      id: "po_supplier",
      name: "采购订单关联供应商",
      source: "po",
      target: "supplier",
    },
  ],
};

function renderPanel(skippedTables: string[] = []) {
  return renderWithoutAntdStyles(
    <MemoryRouter>
      <ExistingDefinitions networkId="kn1" projectId="p1" skippedTables={skippedTables} />
    </MemoryRouter>,
  );
}

describe("ExistingDefinitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ant Design's responsive table observes media queries; jsdom has none.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  it("lists what the network has, marked, read only, opened in the network", async () => {
    existingMock.mockResolvedValue(existing);
    renderPanel(["erp_material"]);

    expect(await screen.findByText("物料")).toBeInTheDocument();
    expect(existingMock).toHaveBeenCalledWith("p1");
    expect(screen.getByText("material_code")).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "bknProject.model.existing.mark" }).length,
    ).toBeGreaterThan(2);
    const links = screen.getAllByText("bknProject.model.existing.open");
    expect(links[0].closest("a")).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/kn1/object-types/material/detail",
    );
    expect(screen.getByText(/bknProject.model.existing.skipped/)).toHaveTextContent("erp_material");

    fireEvent.click(screen.getByText(/bknProject.model.existing.relations/));
    expect(await screen.findByText("采购订单关联供应商")).toBeInTheDocument();
    // An end the network names is shown by its name, one it does not by its id.
    expect(screen.getByText(/bknProject.model.existing.ends/)).toHaveTextContent(
      '"source":"po","target":"供应商"',
    );
  });

  it("shows nothing for a new network or when the list cannot be read", async () => {
    existingMock.mockResolvedValue({ objectTypes: [], relationTypes: [] });
    const { container } = renderPanel();
    await waitFor(() => expect(existingMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();

    existingMock.mockRejectedValue(new Error("down"));
    const second = renderPanel();
    await waitFor(() => expect(existingMock).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
  });
});
