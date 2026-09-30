/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

const getCatalogMock = vi.hoisted(() => vi.fn());
const getResourceMock = vi.hoisted(() => vi.fn());
const listResourcesMock = vi.hoisted(() => vi.fn());
const createViewMock = vi.hoisted(() => vi.fn());
const updateViewMock = vi.hoisted(() => vi.fn());
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
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { success: vi.fn() },
    modal: { confirm: ({ onOk }: { onOk: () => void }) => onOk() },
  }),
}));

vi.mock("@/shared/catalog", () => ({
  getCatalog: getCatalogMock,
  hasCatalogOperation: (catalog: CatalogRecord | null, operation: string) =>
    catalog?.operations.includes(operation) ?? false,
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  getCatalogResource: getResourceMock,
  listCatalogResourcePage: listResourcesMock,
  createDerivedView: createViewMock,
  updateDerivedView: updateViewMock,
}));

import { ViewEditorScene } from "./ViewEditorScene";

const catalog = {
  id: "cat-1",
  name: "Orders",
  builtin: false,
  enabled: true,
  status: "enabled",
  operations: ["resource_manage"],
} as CatalogRecord;

const source = {
  id: "source-1",
  catalogId: "cat-1",
  category: "table",
  enabled: true,
  name: "orders",
  sourceIdentifier: "public.orders",
  sourceMetadata: { originalName: "legacy_orders" },
  operations: ["query_data"],
  status: "active",
  schema: [
    {
      name: "id",
      originalName: "id",
      displayName: "Order ID",
      type: "integer",
      features: [{ featureType: "keyword", name: "keyword" }],
    },
  ],
} as CatalogResource;

function renderEditor(props: { catalogId?: string; resourceId?: string }) {
  return render(
    <MemoryRouter>
      <ViewEditorScene {...props} />
    </MemoryRouter>,
  );
}

describe("ViewEditorScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editionMock.value = "professional";
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
    getCatalogMock.mockResolvedValue(catalog);
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "source-1" ? source : null),
    );
    listResourcesMock.mockImplementation(({ category }: { category: string }) =>
      Promise.resolve({
        items: category === "table" ? [{ ...source, schema: [], sourceMetadata: undefined }] : [],
        total: category === "table" ? 1 : 0,
      }),
    );
    createViewMock.mockResolvedValue({ id: "view-1" });
    updateViewMock.mockResolvedValue({ id: "view-1" });
  });

  it("shows the view wizard and searchable source and field identities", async () => {
    renderEditor({ catalogId: "cat-1" });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "dataCatalog.viewEditor.titleCreate",
      }),
    ).toBeTruthy();
    expect(screen.getByText("dataCatalog.viewEditor.subtitleCreate")).toBeTruthy();
    expect(screen.getByText("Orders").closest("header")).toBeNull();
    expect(
      screen
        .getByRole("heading", { name: "dataCatalog.viewEditor.typeTitle" })
        .parentElement?.parentElement?.contains(screen.getByText("Orders")),
    ).toBe(true);
    expect(
      screen.getByRole("heading", { name: "dataCatalog.viewEditor.typeTitle" }).closest("form")
        ?.parentElement?.className,
    ).toContain("typePanel");
    expect(screen.queryByLabelText("dataCatalog.viewEditor.name")).toBeNull();
    const next = screen.getByRole("button", { name: "common.next" });
    expect(next).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /dataCatalog.viewEditor.compositeType/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    const configHeading = screen.getByRole("heading", {
      name: "dataCatalog.viewEditor.configTitle",
    });
    expect(configHeading.parentElement?.parentElement?.contains(screen.getByText("Orders"))).toBe(
      true,
    );
    expect(configHeading.closest("form")?.parentElement?.className).toContain("configPanel");
    expect(configHeading.closest("form")?.firstElementChild?.className).toContain("configWrapper");
    expect(
      Array.from(configHeading.closest("form")?.querySelectorAll("section > h2") ?? []).map(
        (heading) => heading.textContent,
      ),
    ).toEqual([
      "dataCatalog.viewEditor.basic",
      "dataCatalog.viewEditor.source",
      "dataCatalog.viewEditor.fields",
      "dataCatalog.viewEditor.fixedFilter",
    ]);
    for (const title of [
      "dataCatalog.viewEditor.source",
      "dataCatalog.viewEditor.fields",
      "dataCatalog.viewEditor.fixedFilter",
    ]) {
      expect(screen.getByRole("heading", { name: title }).closest("section")?.className).toContain(
        "configGroup",
      );
    }
    expect(screen.getByLabelText("dataCatalog.viewEditor.name")).toBeRequired();
    const sourcePicker = screen.getByRole("combobox", {
      name: "dataCatalog.viewEditor.sourceSearch",
    });
    fireEvent.mouseDown(sourcePicker);
    fireEvent.change(sourcePicker, { target: { value: "ord" } });
    await waitFor(() =>
      expect(listResourcesMock).toHaveBeenCalledWith(expect.objectContaining({ keyword: "ord" })),
    );
    const sourceIdentifier = await screen.findByText("public.orders");
    const sourceIdentity = sourceIdentifier.parentElement as HTMLElement;
    expect(sourceIdentity.querySelector("strong")?.textContent).toBe("orders");
    expect(sourceIdentity.querySelector("small")?.textContent).toBe("public.orders");
    fireEvent.click(sourceIdentifier);
    const selectedSource = document.querySelector(".ant-select-selection-item") as HTMLElement;
    expect(within(selectedSource).getByText("orders")).toBeTruthy();
    expect(within(selectedSource).getByText("public.orders")).toBeTruthy();
    expect(within(selectedSource).getByText("dataCatalog.categories.table")).toBeTruthy();
    await screen.findByLabelText("dataCatalog.viewEditor.outputName 1");
    expect(within(selectedSource).getByText("public.orders")).toBeTruthy();
    expect(within(selectedSource).queryByText("legacy_orders")).toBeNull();
    const outputFieldsTable = screen
      .getByRole("columnheader", { name: "dataCatalog.viewEditor.sourceField" })
      .closest("table") as HTMLElement;
    const sourceCell = outputFieldsTable.querySelector("tbody tr td") as HTMLElement;
    expect(within(sourceCell).getByText("int")).toBeTruthy();
    const sourceNames = within(sourceCell).getByText("Order ID").parentElement;
    expect(sourceNames?.className).toContain("namesInline");
    expect(sourceNames?.querySelector("small")?.textContent).toBe("id");
    expect(screen.queryByText("dataCatalog.viewEditor.features")).toBeNull();
    expect(screen.queryByLabelText("dataCatalog.viewEditor.features 1")).toBeNull();
    const fieldPicker = screen.getByRole("combobox", {
      name: "dataCatalog.viewEditor.sourceField",
    });
    fireEvent.mouseDown(fieldPicker);
    fireEvent.change(fieldPicker, { target: { value: "Order ID" } });
    const fieldDropdown = document.querySelector(
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
    ) as HTMLElement;
    expect(within(fieldDropdown).getByText("int")).toBeTruthy();
    const optionNames = within(fieldDropdown).getByText("Order ID").parentElement;
    expect(optionNames?.className).toContain("namesInline");
    expect(optionNames?.querySelector("small")?.textContent).toBe("id");
    fireEvent.click(within(fieldDropdown).getByText("Order ID"));
    expect(
      within(fieldPicker.closest(".ant-select") as HTMLElement).getByText("Order ID"),
    ).toBeTruthy();
  });

  it("stops at five view tags and reports an attempted sixth tag", async () => {
    renderEditor({ catalogId: "cat-1" });
    await screen.findByRole("heading", { name: "dataCatalog.viewEditor.typeTitle" });
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    const tagsField = screen.getByText("dataCatalog.viewEditor.tagsHint").closest("label");
    const input = tagsField?.querySelector(".ant-select input");
    expect(input).not.toBeNull();
    if (!input) return;

    for (const tag of ["one", "two", "three", "four", "five", "six"]) {
      fireEvent.change(input, { target: { value: tag } });
      fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
    }

    expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(5);
    expect(screen.getByRole("alert").textContent).toBe("dataCatalog.viewEditor.tagErrors.count");
    fireEvent.click(tagsField?.querySelector(".ant-select-selection-item-remove") as HTMLElement);
    for (const [tag, error] of [
      ["bad/tag", "characters"],
      ["😀".repeat(41), "length"],
      ["   ", "empty"],
    ]) {
      fireEvent.change(input, { target: { value: tag } });
      fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
      expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(4);
      expect(screen.getByRole("alert").textContent).toBe(
        `dataCatalog.viewEditor.tagErrors.${error}`,
      );
    }
    fireEvent.change(input, { target: { value: `  ${"😀".repeat(40)}  ` } });
    fireEvent.keyDown(input, { code: "Enter", key: "Enter", keyCode: 13, which: 13 });
    expect(tagsField?.querySelectorAll(".ant-select-selection-item")).toHaveLength(5);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("creates a view with an editable display name and source fields", async () => {
    renderEditor({ catalogId: "cat-1" });
    await screen.findByRole("heading", { name: "dataCatalog.viewEditor.typeTitle" });
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" }),
    );
    fireEvent.click(await screen.findByText("public.orders"));
    await screen.findByLabelText("dataCatalog.viewEditor.outputName 1");

    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.name"), {
      target: { value: "orders_view" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "common.status" }));
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.displayName 1"), {
      target: { value: "Order Number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.create" }));

    await waitFor(() =>
      expect(createViewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          catalogId: "cat-1",
          name: "orders_view",
          enabled: false,
          sourceResourceId: "source-1",
          schema: [
            expect.objectContaining({
              name: "id",
              originalName: "id",
              displayName: "Order Number",
            }),
          ],
        }),
      ),
    );
    const createPayload = createViewMock.mock.calls[0]?.[0] as {
      schema: Array<Record<string, unknown>>;
    };
    expect(createPayload.schema[0]).not.toHaveProperty("features");
  }, 20_000);

  it("returns to type selection without losing the draft", async () => {
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.name"), {
      target: { value: "draft_view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.previous" }));
    expect(screen.queryByLabelText("dataCatalog.viewEditor.name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    expect(screen.getByLabelText("dataCatalog.viewEditor.name")).toHaveValue("draft_view");
  });

  it("loads more view sources inside the dropdown", async () => {
    listResourcesMock.mockImplementation(({ category }: { category: string }) =>
      Promise.resolve({
        items:
          category === "table"
            ? [{ ...source, schema: [], sourceMetadata: { originalName: "orders" } }]
            : [],
        total: category === "table" ? 31 : 0,
      }),
    );
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    const sourcePicker = screen.getByRole("combobox", {
      name: "dataCatalog.viewEditor.sourceSearch",
    });
    fireEvent.mouseDown(sourcePicker);
    const sourceName = await screen.findByText("orders");
    expect(sourceName.tagName).toBe("STRONG");
    expect(await screen.findByText("public.orders")).toBeTruthy();
    fireEvent.change(sourcePicker, { target: { value: "public." } });
    await waitFor(() =>
      expect(listResourcesMock).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: "public." }),
      ),
    );
    expect(await screen.findByText("public.orders")).toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: "dataCatalog.viewEditor.sourceMore" }),
    );
    await waitFor(() =>
      expect(listResourcesMock).toHaveBeenCalledWith(expect.objectContaining({ offset: 30 })),
    );
  }, 20_000);

  it("only offers sources from the current Catalog", async () => {
    listResourcesMock.mockImplementation(({ category }: { category: string }) =>
      Promise.resolve({
        items:
          category === "table"
            ? [
                { ...source, schema: [] },
                {
                  ...source,
                  id: "source-other",
                  catalogId: "cat-other",
                  name: "other_orders",
                  schema: [],
                },
              ]
            : [],
        total: category === "table" ? 2 : 0,
      }),
    );
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    await waitFor(() =>
      expect(listResourcesMock).toHaveBeenCalledWith(
        expect.objectContaining({ catalogId: "cat-1", category: "table" }),
      ),
    );
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" }),
    );
    expect(await screen.findByText("public.orders")).toBeTruthy();
    expect(screen.queryByText("other_orders")).toBeNull();
  });

  it("keeps the latest source when detail requests finish out of order", async () => {
    let finishFirst!: (value: CatalogResource) => void;
    let finishSecond!: (value: CatalogResource) => void;
    const first = new Promise<CatalogResource>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<CatalogResource>((resolve) => {
      finishSecond = resolve;
    });
    const alpha = { ...source, id: "source-a", name: "Alpha", sourceIdentifier: "public.alpha" };
    const beta = { ...source, id: "source-b", name: "Beta", sourceIdentifier: "public.beta" };
    listResourcesMock.mockImplementation(({ category }: { category: string }) =>
      Promise.resolve({
        items: category === "table" ? [alpha, beta] : [],
        total: category === "table" ? 2 : 0,
      }),
    );
    getResourceMock.mockImplementation((id: string) =>
      id === "source-a" ? first : id === "source-b" ? second : Promise.resolve(null),
    );
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    const picker = screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" });
    fireEvent.mouseDown(picker);
    fireEvent.click(await screen.findByText("public.alpha"));
    fireEvent.mouseDown(picker);
    fireEvent.click(await screen.findByText("public.beta"));
    finishSecond(beta);
    await waitFor(() =>
      expect(document.querySelector(".ant-select-selection-item")?.textContent).toContain("Beta"),
    );
    finishFirst(alpha);
    await act(async () => {});
    expect(document.querySelector(".ant-select-selection-item")?.textContent).toContain("Beta");
  });

  it("rejects duplicate output display names before creating a view", async () => {
    const sourceWithTwoFields = {
      ...source,
      schema: [
        ...source.schema,
        { name: "order_no", originalName: "order_no", displayName: "Order Number", type: "string" },
      ],
    };
    getResourceMock.mockResolvedValue(sourceWithTwoFields);
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.name"), {
      target: { value: "orders_view" },
    });
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" }),
    );
    fireEvent.click(await screen.findByText("public.orders"));
    await screen.findByLabelText("dataCatalog.viewEditor.displayName 2");
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.displayName 2"), {
      target: { value: " Order ID " },
    });

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.create" }));
    expect(await screen.findByText("dataCatalog.viewEditor.invalidFields")).toBeTruthy();
    expect(createViewMock).not.toHaveBeenCalled();
  });

  it("limits output names by Unicode characters rather than UTF-16 units", async () => {
    renderEditor({ catalogId: "cat-1" });
    await screen.findByText("dataCatalog.viewEditor.typeTitle");
    fireEvent.click(screen.getByRole("button", { name: /dataCatalog.viewEditor.derivedType/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.name"), {
      target: { value: "orders_view" },
    });
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" }),
    );
    fireEvent.click(await screen.findByText("public.orders"));
    const outputName = await screen.findByLabelText("dataCatalog.viewEditor.outputName 1");
    fireEvent.change(outputName, { target: { value: "a".repeat(256) } });
    expect(outputName).toHaveValue("a".repeat(255));
    fireEvent.change(outputName, { target: { value: "😀".repeat(255) } });
    expect(outputName).toHaveValue("😀".repeat(255));
    fireEvent.change(outputName, { target: { value: "😀".repeat(256) } });
    expect(outputName).toHaveValue("😀".repeat(255));
    const displayName = screen.getByLabelText("dataCatalog.viewEditor.displayName 1");
    fireEvent.change(displayName, { target: { value: "😀".repeat(255) } });
    expect(displayName).toHaveValue("😀".repeat(255));
    fireEvent.change(displayName, { target: { value: "😀".repeat(256) } });
    expect(displayName).toHaveValue("😀".repeat(255));
    const viewName = screen.getByLabelText("dataCatalog.viewEditor.name");
    fireEvent.change(viewName, { target: { value: "😀".repeat(255) } });
    expect(viewName).toHaveValue("😀".repeat(255));
    fireEvent.change(viewName, { target: { value: "😀".repeat(256) } });
    expect(viewName).toHaveValue("😀".repeat(255));
    const description = screen.getByLabelText("dataCatalog.viewEditor.description");
    fireEvent.change(description, { target: { value: "😀".repeat(1000) } });
    expect(description).toHaveValue("😀".repeat(1000));
    fireEvent.change(description, { target: { value: "😀".repeat(1001) } });
    expect(description).toHaveValue("😀".repeat(1000));
  });

  it.each([
    ["name", { name: "n".repeat(256) }, "nameLengthLimit"],
    ["description", { description: "d".repeat(1001) }, "descriptionLengthLimit"],
    ["tag content", { tags: ["bad/tag"] }, "tagErrors.characters"],
  ])("rejects a persisted view with invalid %s before saving", async (_, fields, errorKey) => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: { sourceResourceId: "source-1" },
      ...fields,
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : source),
    );
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue(view.name);

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText(`dataCatalog.viewEditor.${errorKey}`)).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("rejects a persisted output name above the backend limit on save", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      schema: [{ ...source.schema[0], name: "a".repeat(256) }],
      logicDefinition: { sourceResourceId: "source-1" },
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : source),
    );
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.viewEditor.invalidFields")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("rejects a source moved out of the view Catalog before saving", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: { sourceResourceId: "source-1" },
    } as CatalogResource;
    let sourceReads = 0;
    getResourceMock.mockImplementation((id: string) => {
      if (id === "view-1") return Promise.resolve(view);
      sourceReads += 1;
      return Promise.resolve(sourceReads === 1 ? source : { ...source, catalogId: "cat-other" });
    });
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.viewEditor.invalidSource")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("refreshes source fields and blocks a stale output binding before saving", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: { sourceResourceId: "source-1" },
    } as CatalogResource;
    let sourceReads = 0;
    getResourceMock.mockImplementation((id: string) => {
      if (id === "view-1") return Promise.resolve(view);
      sourceReads += 1;
      return Promise.resolve(
        sourceReads === 1
          ? source
          : { ...source, schema: [{ ...source.schema[0], type: "string" }] },
      );
    });
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.viewEditor.sourceSchemaChanged")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("rejects editing a view whose saved source belongs to another Catalog", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: { sourceResourceId: "source-1" },
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : { ...source, catalogId: "cat-other" }),
    );
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.viewEditor.invalidSource")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("blocks creation in a built-in Catalog even when it has resource_manage", async () => {
    getCatalogMock.mockResolvedValue({ ...catalog, builtin: true });
    renderEditor({ catalogId: "cat-1" });
    expect(await screen.findByText("dataCatalog.viewEditor.noAccess")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "dataCatalog.viewEditor.create" })).toBeNull();
  });

  it("loads and saves an existing editable fixed filter", async () => {
    const filter = {
      operation: "or",
      sub_conditions: [
        { field: "id", operation: "==", value: 1 },
        { field: "id", operation: "==", value: 2 },
      ],
    };
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      enabled: false,
      name: "orders_view",
      tags: ["orders"],
      expectedUpdateTime: 42,
      schema: [{ ...source.schema[0], features: [] }],
      logicDefinition: { sourceResourceId: "source-1", filterCondition: filter },
    } as CatalogResource;
    const sourceWithoutDistinctDisplayName = {
      ...source,
      schema: [{ ...source.schema[0], displayName: "id" }],
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : sourceWithoutDistinctDisplayName),
    );
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");
    await waitFor(() =>
      expect(listResourcesMock).toHaveBeenCalledWith(
        expect.objectContaining({ catalogId: "cat-1", category: "table" }),
      ),
    );

    expect(
      screen.getByRole("heading", { name: "dataCatalog.viewEditor.editConfigTitle" }),
    ).toBeTruthy();
    expect(screen.getByText("dataCatalog.viewEditor.fixedFilter")).toBeTruthy();
    expect(screen.queryByText("dataCatalog.viewEditor.features")).toBeNull();
    expect(screen.getByRole("switch", { name: "common.status" })).toBeDisabled();
    const selectedSource = screen
      .getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" })
      .closest(".ant-select") as HTMLElement;
    expect(within(selectedSource).getByText("orders")).toBeTruthy();
    expect(within(selectedSource).getByText("public.orders")).toBeTruthy();
    expect(within(selectedSource).getByText("dataCatalog.categories.table")).toBeTruthy();
    const sourceCell = screen
      .getByRole("columnheader", { name: "dataCatalog.viewEditor.sourceField" })
      .closest("table")
      ?.querySelector("tbody tr td") as HTMLElement;
    expect(within(sourceCell).getByText("int")).toBeTruthy();
    expect(within(sourceCell).getAllByText("id")).toHaveLength(2);
    expect(sourceCell.querySelector("small")?.textContent).toBe("id");
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.displayName 1"), {
      target: { value: "Order Number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));

    await waitFor(() =>
      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        expect.objectContaining({
          expectedUpdateTime: 42,
          enabled: false,
          filterCondition: filter,
          schema: [expect.objectContaining({ displayName: "Order Number" })],
        }),
      ),
    );
    const updatePayload = updateViewMock.mock.calls[0]?.[1] as {
      schema: Array<Record<string, unknown>>;
    };
    expect(updatePayload.schema[0]).not.toHaveProperty("features");
  });

  it("shows specific validation instead of a source compatibility warning while editing a filter", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      logicDefinition: {
        sourceResourceId: "source-1",
        filterCondition: { field: "id", operation: "==", value: 1 },
      },
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : source),
    );
    renderEditor({ resourceId: "view-1" });
    const value = await screen.findByRole("textbox", { name: "dataCatalog.filter.value" });

    fireEvent.change(value, { target: { value: "" } });
    expect(screen.queryByText("dataCatalog.viewEditor.filterNeedsReview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.filter.errors.missingValue")).toBeTruthy();

    fireEvent.change(value, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.addRule" }));
    expect(screen.queryByText("dataCatalog.viewEditor.filterNeedsReview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.filter.errors.invalidField")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();
  });

  it("fills a missing display name from the output field name when editing", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      schema: [{ ...source.schema[0], displayName: undefined, features: [] }],
      logicDefinition: { sourceResourceId: "source-1" },
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : source),
    );
    renderEditor({ resourceId: "view-1" });
    expect(await screen.findByLabelText("dataCatalog.viewEditor.displayName 1")).toHaveValue("id");
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    await waitFor(() =>
      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        expect.objectContaining({ schema: [expect.objectContaining({ displayName: "id" })] }),
      ),
    );
  });

  it("blocks the direct View editor route without a professional license", async () => {
    editionMock.value = "community";
    renderEditor({ catalogId: "cat-1" });
    expect(await screen.findByText("dataCatalog.viewEditor.noAccess")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dataCatalog.viewEditor.derivedType/ })).toBeNull();
  });

  it("preserves an unsupported existing filter while editing display names", async () => {
    const filter = { field: "id", operation: "in", value: [1, 2] };
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: { sourceResourceId: "source-1", filterCondition: filter },
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : source),
    );
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");
    expect(screen.getByText("dataCatalog.viewEditor.unsupportedFilter")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("dataCatalog.viewEditor.displayName 1"), {
      target: { value: "Order Number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    await waitFor(() =>
      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        expect.objectContaining({
          filterCondition: filter,
        }),
      ),
    );
  });

  it("lets an existing view repair a Text filter after its table gains an index", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      schema: [{ name: "notes", originalName: "notes", type: "text", displayName: "Notes" }],
      logicDefinition: {
        sourceResourceId: "source-1",
        filterCondition: { field: "notes", operation: "==", value: "open" },
      },
    } as CatalogResource;
    const indexedSource = {
      ...source,
      localIndexName: "idx_orders",
      localIndexStatus: "available",
      schema: [{ name: "notes", originalName: "notes", type: "text", displayName: "Notes" }],
    } as CatalogResource;
    getResourceMock.mockImplementation((id: string) =>
      Promise.resolve(id === "view-1" ? view : indexedSource),
    );
    renderEditor({ resourceId: "view-1" });
    expect(await screen.findByText("dataCatalog.viewEditor.filterNeedsReview")).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "dataCatalog.viewEditor.sourceSearch" }),
    ).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    expect(await screen.findByText("dataCatalog.filter.errors.invalidField")).toBeTruthy();
    expect(updateViewMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.filter.removeRule" }));
    expect(screen.queryByText("dataCatalog.viewEditor.filterNeedsReview")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "dataCatalog.viewEditor.save" }));
    await waitFor(() =>
      expect(updateViewMock).toHaveBeenCalledWith(
        "view-1",
        expect.objectContaining({ filterCondition: null }),
      ),
    );
  });

  it("keeps an unsupported filter blocked after its source schema changes", async () => {
    const view = {
      ...source,
      id: "view-1",
      category: "logicview",
      logicType: "derived",
      name: "orders_view",
      expectedUpdateTime: 42,
      logicDefinition: {
        sourceResourceId: "source-1",
        filterCondition: { field: "id", operation: "in", value: [1, 2] },
      },
    } as CatalogResource;
    let sourceReads = 0;
    getResourceMock.mockImplementation((id: string) => {
      if (id === "view-1") return Promise.resolve(view);
      sourceReads += 1;
      return Promise.resolve(sourceReads === 1 ? source : { ...source, schema: [] });
    });
    renderEditor({ resourceId: "view-1" });
    await screen.findByDisplayValue("orders_view");

    const saveButton = screen.getByRole("button", { name: "dataCatalog.viewEditor.save" });
    fireEvent.click(saveButton);
    expect(await screen.findByText("dataCatalog.viewEditor.sourceSchemaChanged")).toBeTruthy();
    fireEvent.click(saveButton);
    await waitFor(() => expect(sourceReads).toBe(3));
    expect(updateViewMock).not.toHaveBeenCalled();
  });
});
