/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatDateTime } from "@/framework/i18n/format";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import styles from "./ResourceDetailPanel.module.css";

const getCatalogResourceMock = vi.hoisted(() => vi.fn());
const updateCatalogResourceMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
const editionMock = vi.hoisted(() => ({ value: "professional" }));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => ({
    snapshot: {
      edition: editionMock.value,
      licensed: editionMock.value !== "community",
      capabilities: [],
      extensions: [],
      limits: {},
      state: "valid",
    },
  }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; formattedCount?: number | string }) =>
      key === "dataCatalog.resource.estimatedRowCount" && typeof options?.count === "number"
        ? `estimated:${options?.formattedCount}`
        : key,
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getCatalogResourceMock,
  updateCatalogResource: updateCatalogResourceMock,
}));

import { ResourceDetailPanel } from "./ResourceDetailPanel";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  operations: ["modify", "query_data", "view_detail"],
  rowCount: 1,
  estimatedRowCount: 1,
  schemaName: "public",
  schema: [
    {
      name: "id",
      originalDescription: "Source order identifier",
      originalName: "source_order_id",
      originalType: "varchar(64)",
      type: "string",
    },
  ],
  sourceIdentifier: "orders",
  sourceMetadata: {
    foreignKeyCount: 1,
    indexCount: 2,
    objectType: "table",
    originalDescription: "Orders from the source database",
    originalName: "public.orders",
    primaryKeys: ["id"],
  },
  updateTime: "2026-08-11T00:00:00Z",
  expectedUpdateTime: 0,
};

describe("ResourceDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editionMock.value = "professional";
    getCatalogResourceMock.mockResolvedValue(null);
    updateCatalogResourceMock.mockResolvedValue(undefined);
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

  it("renders the refreshed resource supplied by the workspace without another request", async () => {
    const latestResource = { ...resource, name: "Orders" };

    const { rerender } = render(
      <MemoryRouter>
        <ResourceDetailPanel active={false} canEdit={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );

    await act(async () => {});

    rerender(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={latestResource} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Orders")).toBeTruthy();
    expect(getCatalogResourceMock).not.toHaveBeenCalled();
  });

  it("does not place the tag space inside a paragraph", async () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, tags: ["index"] }}
        />
      </MemoryRouter>,
    );

    const tag = await screen.findByText("index");
    expect(tag.closest(".ant-space")?.parentElement?.tagName).not.toBe("P");
  });

  it("keeps zero estimated row counts visible and exposes copy actions for identifiers", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: null, estimatedRowCount: 0 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("estimated:0")).toHaveLength(2);
    expect(screen.queryByText(resource.updateTime)).toBeNull();
    expect(screen.getAllByRole("button", { name: "dataCatalog.resource.copyValue" })).toHaveLength(
      3,
    );
  });

  it("shows unknown collection times without substituting update_time", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("dataCatalog.resource.unknownTime")).toHaveLength(3);
    expect(screen.queryByText(resource.updateTime)).toBeNull();
  });

  it.each([undefined, 1720000001000])(
    "shows Dataset row count time %s without source discovery fields",
    (rowCountTime) => {
      render(
        <MemoryRouter>
          <ResourceDetailPanel
            active
            canEdit={false}
            catalog={null}
            resource={{ ...resource, category: "dataset", rowCount: 0, rowCountTime }}
          />
        </MemoryRouter>,
      );
      for (const field of ["discoverStatus", "resourceStatus", "statusMessage"]) {
        expect(screen.queryByText(`dataCatalog.resource.${field}`)).toBeNull();
      }
      const basicInfo = within(
        screen.getByText("dataCatalog.resource.category").parentElement!.parentElement!,
      );
      const cells = ["sourceIdentifier", "fieldCount", "rowCount", "rowCountTime"].map(
        (field) => basicInfo.getByText(`dataCatalog.resource.${field}`).parentElement!,
      );
      cells.forEach((cell, index) => {
        expect(cell).toHaveClass(styles.basicInfoQuarter);
        if (index > 0) expect(cells[index - 1].nextElementSibling).toBe(cell);
      });
      expect(within(cells[2]).getByText("0")).toBeTruthy();
      expect(
        within(cells[3]).getByText(
          rowCountTime ? formatDateTime(rowCountTime) : "dataCatalog.resource.unknownTime",
        ),
      ).toBeTruthy();
      expect(screen.queryByText("dataCatalog.resource.lastDiscoverTime")).toBeNull();
    },
  );

  it.each(["table", "index"] as const)(
    "shows separate discovery and exact count collection times for %s",
    (category) => {
      render(
        <MemoryRouter>
          <ResourceDetailPanel
            active
            canEdit={false}
            catalog={null}
            resource={{
              ...resource,
              category,
              rowCount: 0,
              lastDiscoverTime: 1720000000000,
              rowCountTime: 1720000001000,
            }}
          />
        </MemoryRouter>,
      );
      const basicInfo = within(
        screen.getByText("dataCatalog.resource.category").parentElement!.parentElement!,
      );
      for (const fields of [
        ["category", "enabledStatus", "discoverStatus", "lastDiscoverTime"],
        ["sourceIdentifier", "fieldCount", "rowCount", "rowCountTime"],
      ]) {
        const cells = fields.map(
          (field) => basicInfo.getByText(`dataCatalog.resource.${field}`).parentElement!,
        );
        cells.forEach((cell, index) => {
          expect(cell).toHaveClass(styles.basicInfoQuarter);
          if (index > 0) expect(cells[index - 1].nextElementSibling).toBe(cell);
        });
      }
      for (const field of ["discoverStatus", "resourceStatus", "statusMessage"]) {
        expect(screen.getByText(`dataCatalog.resource.${field}`)).toBeTruthy();
      }
      expect(screen.getByText("dataCatalog.resource.lastDiscoverTime")).toBeTruthy();
      expect(basicInfo.getByText("dataCatalog.resource.rowCountTime")).toBeTruthy();
      expect(screen.queryByText("dataCatalog.resource.unknownTime")).toBeNull();
    },
  );

  it("shows an exact zero row count without the estimate prefix", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: 0, estimatedRowCount: null }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.queryByText("estimated:0")).toBeNull();
  });

  it("shows an exact row count without the estimate prefix", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: 42, estimatedRowCount: 41 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("42")).toHaveLength(2);
    expect(screen.queryByText("estimated:41")).toBeNull();
  });

  it("preserves a large estimated row count and shows a placeholder when both counts are absent", () => {
    const largeCount = "9007199254740993";
    const { rerender } = render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: null, estimatedRowCount: largeCount }}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(`estimated:${largeCount}`)).toHaveLength(2);

    rerender(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, rowCount: null, estimatedRowCount: null }}
        />
      </MemoryRouter>,
    );

    const rowCountLabels = screen.getAllByText("dataCatalog.resource.rowCount");
    expect(rowCountLabels).toHaveLength(2);
    rowCountLabels.forEach((label) => {
      expect(label.parentElement?.textContent).toBe("dataCatalog.resource.rowCount-");
    });
  });

  it("shows the original source metadata for each field", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={resource} />
      </MemoryRouter>,
    );

    expect(screen.getByText("source_order_id")).toBeTruthy();
    expect(screen.getByText("varchar(64)")).toBeTruthy();
    expect(screen.getByText("Source order identifier")).toBeTruthy();
  });

  it("shows the original source metadata for the resource", () => {
    const describedResource = { ...resource, description: "A long resource description" };
    render(
      <MemoryRouter>
        <ResourceDetailPanel active canEdit={false} catalog={null} resource={describedResource} />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("A long resource description")).toBeTruthy();
    expect(screen.getByText("public.orders")).toBeTruthy();
    expect(screen.getByTitle("Orders from the source database")).toBeTruthy();
    expect(
      screen.getByText("dataCatalog.resource.schemaName").parentElement?.textContent,
    ).toContain("public");
    expect(
      screen.getByText("dataCatalog.resource.sourceIndexCount").parentElement?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("dataCatalog.resource.sourceForeignKeyCount").parentElement?.textContent,
    ).toContain("1");
  });

  it.each(["table", "index"] as const)("places the %s estimate in source metadata", (category) => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, category, estimatedRowCount: 0 }}
        />
      </MemoryRouter>,
    );
    const sourceMetadata = screen.getByText("dataCatalog.resource.sourceMetadata").parentElement!;
    const cells = [
      "fieldCount",
      "sourceIndexCount",
      "sourceForeignKeyCount",
      "estimatedRowCountLabel",
      "rowCount",
      "rowCountTime",
    ].map(
      (field) => within(sourceMetadata).getByText(`dataCatalog.resource.${field}`).parentElement!,
    );
    cells.forEach((cell, index) => {
      expect(cell).toHaveClass(styles.basicInfoItem);
      expect(cell).not.toHaveClass(styles.basicInfoQuarter);
      expect(cell).not.toHaveClass(styles.basicInfoHalf);
      expect(cell).not.toHaveClass(styles.basicInfoSpanTwo);
      if (index > 0) expect(cells[index - 1].nextElementSibling).toBe(cell);
    });
    const estimate = within(sourceMetadata).getByText(
      "dataCatalog.resource.estimatedRowCountLabel",
    ).parentElement!;
    expect(within(estimate).getByText("0")).toBeTruthy();
    const basicInfo = screen.getByText("dataCatalog.resource.category").parentElement!
      .parentElement!;
    expect(within(basicInfo).queryByText("dataCatalog.resource.estimatedRowCountLabel")).toBeNull();
  });

  it("does not show source metadata for a dataset", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, category: "dataset" }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dataCatalog.resource.sourceMetadata")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.schemaName")).toBeNull();
  });

  it("keeps a resource read-only when its parent catalog cannot modify resources", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, operations: ["view_detail"] }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "dataCatalog.resource.editFields" })).toBeNull();
  });

  it("shows logic view details without the unsupported generic edit action", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit
          catalog={null}
          resource={{ ...resource, category: "logicview", lastDiscoverStatus: "updated" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.categories.logicview")).toBeTruthy();
    expect(screen.getByText("dataCatalog.categories.logicview").parentElement?.className).toContain(
      "basicInfoHalf",
    );
    expect(
      screen.getByText("dataCatalog.resource.enabledStatus").parentElement?.className,
    ).toContain("basicInfoHalf");
    expect(screen.queryByText("dataCatalog.resource.resourceStatus")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.statusMessage")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.indexState")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.indexName")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.discoverStatus")).toBeNull();
    expect(screen.queryByText("dataCatalog.discoverStatuses.updated")).toBeNull();
    expect(screen.queryByRole("button", { name: "dataCatalog.resource.editFields" })).toBeNull();
    expect(screen.getByText("dataCatalog.resource.logicViewReadOnly")).toBeTruthy();
    const sourceMetadata = screen.getByText("dataCatalog.resource.sourceMetadata").parentElement!;
    expect(within(sourceMetadata).getByText("dataCatalog.resource.originalName")).toBeTruthy();
    expect(within(sourceMetadata).getByText("dataCatalog.resource.sourceObjectType")).toBeTruthy();
    for (const label of [
      "originalDescription",
      "schemaName",
      "sourcePrimaryKeys",
      "fieldCount",
      "rowCount",
      "sourceIndexCount",
      "sourceForeignKeyCount",
    ]) {
      expect(within(sourceMetadata).queryByText(`dataCatalog.resource.${label}`)).toBeNull();
    }
  });

  it("places a derived view source in source metadata and its filter after fields", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit
          catalog={null}
          resource={{
            ...resource,
            category: "logicview",
            logicType: "derived",
            logicDefinition: {
              sourceResourceId: "source-orders",
              filterCondition: {
                operation: "and",
                sub_conditions: [
                  { field: "amount", operation: ">", value: 1000 },
                  {
                    operation: "or",
                    sub_conditions: [
                      { field: "id", operation: "==", value: 1 },
                      { field: "id", operation: "==", value: 2 },
                    ],
                  },
                ],
              },
            },
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("dataCatalog.resource.viewDefinition")).toBeNull();
    expect(screen.getByRole("button", { name: "dataCatalog.viewEditor.edit" })).toBeTruthy();
    const sourceMetadata = screen.getByText("dataCatalog.resource.sourceMetadata").parentElement!;
    expect(within(sourceMetadata).getByText("dataCatalog.resource.viewSource")).toBeTruthy();
    expect(within(sourceMetadata).getByRole("button", { name: "source-orders" })).toBeTruthy();
    const filterHeading = screen.getByText("dataCatalog.resource.viewFixedFilter");
    const fieldsHeading = screen.getByText("dataCatalog.resource.schemaSection");
    expect(filterHeading.parentElement).not.toBe(fieldsHeading.parentElement);
    expect(
      fieldsHeading.compareDocumentPosition(filterHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const filterCard = within(filterHeading.parentElement!);
    expect(filterCard.getByText("dataCatalog.filter.and")).toBeTruthy();
    expect(filterCard.getByText("dataCatalog.filter.or")).toBeTruthy();
    expect(filterCard.getAllByText("amount")).toHaveLength(2);
    expect(filterCard.getByText(">")).toBeTruthy();
    expect(filterCard.getByText("1000")).toBeTruthy();
    expect(filterCard.queryByRole("textbox")).toBeNull();
    expect(filterCard.queryByRole("button")).toBeNull();
  });

  it("uses source schema labels for fixed filters on hidden source fields", async () => {
    getCatalogResourceMock.mockResolvedValue({
      ...resource,
      id: "source-orders",
      schema: [{ name: "internal_score", displayName: "Source Score", type: "integer" }],
    });
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{
            ...resource,
            category: "logicview",
            logicType: "derived",
            schema: [{ name: "score_alias", displayName: "Output Score", type: "string" }],
            logicDefinition: {
              sourceResourceId: "source-orders",
              filterCondition: { field: "internal_score", operation: ">", value: 10 },
            },
          }}
        />
      </MemoryRouter>,
    );
    const filterCard = screen.getByText("dataCatalog.resource.viewFixedFilter").parentElement!;
    expect(await within(filterCard).findByText("Source Score")).toBeTruthy();
    expect(within(filterCard).getByText("internal_score")).toBeTruthy();
    expect(within(filterCard).queryByText("Output Score")).toBeNull();
  });

  it("keeps discovery status visible for a table", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{ ...resource, lastDiscoverStatus: "updated" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("dataCatalog.resource.discoverStatus")).toBeTruthy();
    expect(screen.getByText("dataCatalog.discoverStatuses.updated")).toBeTruthy();
  });

  it("refreshes the resource version after an update conflict", async () => {
    const latestResource = {
      ...resource,
      description: "server description",
      expectedUpdateTime: 200,
    };
    const onResourceRefreshed = vi.fn();
    updateCatalogResourceMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    getCatalogResourceMock.mockResolvedValue(latestResource);

    const { container } = render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit
          catalog={null}
          onResourceRefreshed={onResourceRefreshed}
          resource={{ ...resource, expectedUpdateTime: 100 }}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.resource.editFields" }));
    const descriptionInput = container.querySelector("textarea");
    if (!descriptionInput) {
      throw new Error("resource description input not found");
    }
    fireEvent.change(descriptionInput, {
      target: { value: "local description" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(onResourceRefreshed).toHaveBeenCalledWith(latestResource);
    });
    expect(getCatalogResourceMock).toHaveBeenCalledWith(resource.id);
    expect(await screen.findByText("server description")).toBeTruthy();
  });

  it("places logic view statistics and their update time in four equal columns", () => {
    render(
      <MemoryRouter>
        <ResourceDetailPanel
          active
          canEdit={false}
          catalog={null}
          resource={{
            ...resource,
            category: "logicview",
            rowCount: 7,
            rowCountTime: 1720000001000,
          }}
        />
      </MemoryRouter>,
    );
    const cells = ["sourceIdentifier", "fieldCount", "rowCount", "rowCountTime"].map(
      (field) => screen.getByText(`dataCatalog.resource.${field}`).parentElement!,
    );
    for (const cell of cells) {
      expect(cell).toHaveClass(styles.basicInfoQuarter);
    }
    expect(cells[0].nextElementSibling).toBe(cells[1]);
    expect(cells[1].nextElementSibling).toBe(cells[2]);
    expect(cells[2].nextElementSibling).toBe(cells[3]);
    expect(screen.queryByText("dataCatalog.resource.lastDiscoverTime")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.estimatedRowCountLabel")).toBeNull();
    expect(screen.queryByText("dataCatalog.resource.unknownTime")).toBeNull();
  });
});
