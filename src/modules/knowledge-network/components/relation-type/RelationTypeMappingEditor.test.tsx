/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({
  getDetail: vi.fn(),
  listFields: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock(
  "@/modules/knowledge-network/services/knowledge-network.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/knowledge-network/services/knowledge-network.service")
    >()),
    getKnowledgeNetworkObjectTypeDetail: mocks.getDetail,
    listObjectTypeResourceFields: mocks.listFields,
  }),
);

import {
  createDefaultRelationTypeMappingValues,
  RelationTypeMappingEditor,
} from "./RelationTypeMappingEditor";

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

function values(mode: "direct" | "resource") {
  const start = createDefaultRelationTypeMappingValues(mode);
  return {
    ...start,
    mappingRules: {
      ...start.mappingRules,
      backingDataSourceId: mode === "resource" ? "res-items" : "",
      sourceObjectTypeId: "orders",
      targetObjectTypeId: "customers",
    },
  };
}

describe("RelationTypeMappingEditor with readers", () => {
  it("reads the ends' properties and the link table's fields from the caller, not the network", async () => {
    const readers = {
      readObjectTypeProperties: vi.fn().mockResolvedValue([]),
      readResourceFields: vi.fn().mockResolvedValue([]),
    };
    renderWithoutAntdStyles(
      <RelationTypeMappingEditor
        networkId="n1"
        objectTypes={[]}
        onChange={vi.fn()}
        readers={readers}
        value={values("resource")}
      />,
    );

    await waitFor(() => expect(readers.readObjectTypeProperties).toHaveBeenCalledWith("orders"));
    expect(readers.readObjectTypeProperties).toHaveBeenCalledWith("customers");
    expect(readers.readResourceFields).toHaveBeenCalledWith("res-items");
    expect(mocks.getDetail).not.toHaveBeenCalled();
    expect(mocks.listFields).not.toHaveBeenCalled();
  });

  it("reads the network's without them", async () => {
    mocks.getDetail.mockResolvedValue({ dataProperties: [] });
    renderWithoutAntdStyles(
      <RelationTypeMappingEditor
        networkId="n1"
        objectTypes={[]}
        onChange={vi.fn()}
        value={values("direct")}
      />,
    );
    await waitFor(() => expect(mocks.getDetail).toHaveBeenCalledWith("n1", "orders"));
  });
});
