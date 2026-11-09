/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock(
  "@/modules/knowledge-network/components/object-type/data-attribute/ObjectTypeResourceSelectModal",
  () => ({
    // Picks the doctor assignment table of a new resource at once.
    ObjectTypeResourceSelectModal: ({
      onOk,
      open,
    }: {
      onOk: (resource: { id: string; name: string }) => void;
      open: boolean;
    }) =>
      open ? (
        <button onClick={() => onOk({ id: "res-new", name: "New assignments" })} type="button">
          pick new resource
        </button>
      ) : null,
  }),
);

import {
  createDefaultRelationTypeMappingValues,
  type RelationPropertyChange,
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

describe("RelationTypeMappingEditor with stored relation properties", () => {
  const relationProperties = [
    { displayName: "职务", mappedField: "title", name: "title" },
    { displayName: "任职开始", mappedField: "start_date", name: "start_date" },
  ];

  beforeEach(() => {
    mocks.listFields.mockResolvedValue([]);
  });

  function renderGuarded(
    confirm: (change: RelationPropertyChange) => Promise<boolean>,
    onChange = vi.fn(),
  ) {
    mocks.getDetail.mockResolvedValue({ dataProperties: [] });
    renderWithoutAntdStyles(
      <RelationTypeMappingEditor
        confirmRelationPropertyChange={confirm}
        networkId="n1"
        objectTypes={[]}
        onChange={onChange}
        relationProperties={relationProperties}
        value={values("resource")}
      />,
    );
    return onChange;
  }

  it("asks before making the relation direct, and keeps it indirect when cancelled", async () => {
    const confirm = vi.fn<(change: RelationPropertyChange) => Promise<boolean>>();
    confirm.mockResolvedValue(false);
    const onChange = renderGuarded(confirm);
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.relationTypeDirectMappingOption"));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith({ count: 2, kind: "toDirect" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("makes the relation direct once confirmed", async () => {
    const onChange = renderGuarded(() => Promise.resolve(true));
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.relationTypeDirectMappingOption"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mappingMode: "direct" })),
    );
  });

  it("names the relation properties whose column a new resource lacks, before changing it", async () => {
    mocks.listFields.mockResolvedValue([{ displayName: "Title", name: "title", type: "string" }]);
    const confirm = vi.fn<(change: RelationPropertyChange) => Promise<boolean>>();
    confirm.mockResolvedValue(false);
    const onChange = renderGuarded(confirm);
    fireEvent.click(screen.getByRole("button", { name: /res-items/ }));
    fireEvent.click(screen.getByText("pick new resource"));

    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        count: 2,
        kind: "resource",
        missing: [relationProperties[1]],
        resourceName: "New assignments",
      }),
    );
    expect(mocks.listFields).toHaveBeenCalledWith("n1", "res-new");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("asks nothing for a relation without relation properties", async () => {
    const confirm = vi.fn<(change: RelationPropertyChange) => Promise<boolean>>();
    const onChange = vi.fn();
    mocks.getDetail.mockResolvedValue({ dataProperties: [] });
    renderWithoutAntdStyles(
      <RelationTypeMappingEditor
        confirmRelationPropertyChange={confirm}
        networkId="n1"
        objectTypes={[]}
        onChange={onChange}
        value={values("resource")}
      />,
    );
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.relationTypeDirectMappingOption"));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
  });
});
