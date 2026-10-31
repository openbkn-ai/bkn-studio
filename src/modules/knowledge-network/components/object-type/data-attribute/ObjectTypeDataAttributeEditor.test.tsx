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
  listObjectTypeResourceFields: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: vi.fn() },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listObjectTypeResourceFields: mocks.listObjectTypeResourceFields,
}));

vi.mock("./ObjectTypeDataAttributeFormDrawer", () => ({
  ObjectTypeDataAttributeFormDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid="property-drawer" /> : null,
}));

vi.mock("./ObjectTypeDataAttributePickModal", () => ({
  ObjectTypeDataAttributePickModal: () => null,
}));

vi.mock("./ObjectTypeResourceDescriptionFillModal", () => ({
  ObjectTypeResourceDescriptionFillModal: () => null,
}));

// Stands in for choosing another resource: a button that picks "res-other".
vi.mock("./ObjectTypeResourceSelectModal", () => ({
  ObjectTypeResourceSelectModal: ({
    onOk,
  }: {
    onOk: (view: { id: string; name: string }) => void;
  }) => (
    <button onClick={() => onOk({ id: "res-other", name: "Other table" })} type="button">
      pick another resource
    </button>
  ),
}));

import { ObjectTypeDataAttributeEditor } from "./ObjectTypeDataAttributeEditor";

const sourceTitle = "来源资源标题_".repeat(12);
const sourceDisplayName = "来源字段显示名_".repeat(12);
const sourceTechName = "source_campaign_id_".repeat(10);
const propertyTitle = "对象类型标题_".repeat(12);
const propertyDisplayName = "目标属性显示名_".repeat(12);
const propertyTechName = "target_campaign_id_".repeat(10);

const originalMatchMedia = window.matchMedia;

function setTextDimensions(element: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: clientWidth },
    scrollWidth: { configurable: true, value: scrollWidth },
  });
}

async function expectFullTextTooltip(text: string, occurrence = 0) {
  const elements = (await screen.findAllByText(text)).filter(
    (element) => !element.closest('[role="tooltip"]'),
  );
  const element = elements[occurrence];
  if (!element) {
    throw new Error(`Could not find text occurrence ${occurrence}: ${text}`);
  }
  setTextDimensions(element, 120, 360);
  fireEvent.mouseEnter(element);
  await waitFor(() =>
    expect(screen.getAllByRole("tooltip").some((tooltip) => tooltip.textContent === text)).toBe(
      true,
    ),
  );
}

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

beforeEach(() => {
  mocks.listObjectTypeResourceFields.mockReset();
  mocks.listObjectTypeResourceFields.mockResolvedValue([
    { displayName: sourceDisplayName, name: sourceTechName, type: "string" },
  ]);
});

describe("ObjectTypeDataAttributeEditor overflowing labels", () => {
  it("shows the full titles and field labels only when their rendered text overflows", async () => {
    renderWithoutAntdStyles(
      <ObjectTypeDataAttributeEditor
        basicValue={{ color: "#1677ff", name: propertyTitle }}
        dataProperties={[
          {
            displayKey: false,
            displayName: propertyDisplayName,
            incrementalKey: false,
            name: propertyTechName,
            primaryKey: false,
            type: "string",
          },
          {
            displayKey: false,
            displayName: "短显示名",
            incrementalKey: false,
            name: "short_name",
            primaryKey: false,
            type: "string",
          },
        ]}
        dataSource={{ id: "resource-1", name: sourceTitle }}
        networkId="network-1"
        onChange={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(mocks.listObjectTypeResourceFields).toHaveBeenCalledWith("network-1", "resource-1"),
    );

    const shortName = screen.getByText("短显示名");
    setTextDimensions(shortName, 120, 80);
    fireEvent.mouseEnter(shortName);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    expect(screen.queryByRole("tooltip")).toBeNull();

    for (const text of [
      sourceTitle,
      sourceDisplayName,
      sourceTechName,
      propertyDisplayName,
      propertyTechName,
    ]) {
      await expectFullTextTooltip(text);
    }
    await expectFullTextTooltip(propertyTitle, 1);

    fireEvent.click(screen.getAllByLabelText("edit")[0]);
    expect(screen.getByTestId("property-drawer")).toBeInTheDocument();
  });
});

describe("ObjectTypeDataAttributeEditor with a given resource", () => {
  it("reads the fields with the caller's reader and offers no other resource", async () => {
    const readResourceFields = vi
      .fn()
      .mockResolvedValue([{ displayName: "Customer", name: "customer_id", type: "string" }]);
    const { rerender } = renderWithoutAntdStyles(
      <ObjectTypeDataAttributeEditor
        basicValue={{ color: "#1677ff", name: "Customers" }}
        dataProperties={[]}
        dataSource={{ id: "res-customers", name: "customers" }}
        networkId="network-1"
        onChange={vi.fn()}
        readResourceFields={readResourceFields}
        resourceFixed
      />,
    );

    expect(await screen.findByText("Customer")).toBeInTheDocument();
    expect(readResourceFields).toHaveBeenCalledWith("res-customers");
    expect(mocks.listObjectTypeResourceFields).not.toHaveBeenCalled();
    // Neither replacing nor clearing the resource is on offer: the only menu is the properties'.
    expect(document.querySelectorAll(".anticon-ellipsis")).toHaveLength(1);
    rerender(
      <ObjectTypeDataAttributeEditor
        basicValue={{ color: "#1677ff", name: "Customers" }}
        dataProperties={[]}
        dataSource={{ id: "res-customers", name: "customers" }}
        networkId="network-1"
        onChange={vi.fn()}
        readResourceFields={readResourceFields}
      />,
    );
    expect(document.querySelectorAll(".anticon-ellipsis")).toHaveLength(2);
  });
});

describe("ObjectTypeDataAttributeEditor when the fields cannot be read", () => {
  it("says so with a retry, and gives no mapped count until they are read", async () => {
    const readResourceFields = vi
      .fn()
      .mockRejectedValueOnce(new Error("401"))
      .mockResolvedValue([{ displayName: "Customer", name: "customer_id", type: "string" }]);
    renderWithoutAntdStyles(
      <ObjectTypeDataAttributeEditor
        basicValue={{ color: "#1677ff", name: "Customers" }}
        dataProperties={[
          {
            displayKey: false,
            displayName: "Customer",
            incrementalKey: false,
            mappedField: { displayName: "Customer", name: "customer_id", type: "string" },
            name: "customer_id",
            primaryKey: true,
            type: "string",
          },
        ]}
        dataSource={{ id: "res-customers", name: "customers" }}
        networkId="network-1"
        onChange={vi.fn()}
        readResourceFields={readResourceFields}
        resourceFixed
      />,
    );

    expect(
      await screen.findByText("knowledgeNetwork.objectTypeResourceFieldsFailed"),
    ).toBeInTheDocument();
    expect(screen.queryByText("knowledgeNetwork.objectTypeMappingSummary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    await waitFor(() => expect(readResourceFields).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("knowledgeNetwork.objectTypeResourceFieldsFailed")).toBeNull(),
    );
    expect(screen.getByText("knowledgeNetwork.objectTypeMappingSummary")).toBeInTheDocument();
  });
});

describe("ObjectTypeDataAttributeEditor when another resource's fields cannot be read", () => {
  it("keeps the resource, its fields and mappings, and says it was not changed", async () => {
    const readResourceFields = vi.fn((id: string) =>
      id === "res-customers"
        ? Promise.resolve([{ displayName: "Customer", name: "customer_id", type: "string" }])
        : Promise.reject(new Error("401")),
    );
    const onChange = vi.fn();
    renderWithoutAntdStyles(
      <ObjectTypeDataAttributeEditor
        basicValue={{ color: "#1677ff", name: "Customers" }}
        dataProperties={[]}
        dataSource={{ id: "res-customers", name: "customers" }}
        networkId="network-1"
        onChange={onChange}
        readResourceFields={readResourceFields}
      />,
    );
    expect(await screen.findByText("Customer")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "pick another resource" }));
    expect(
      await screen.findByText("knowledgeNetwork.objectTypeReplaceResourceFieldsFailed"),
    ).toBeInTheDocument();
    expect(readResourceFields).toHaveBeenCalledWith("res-other");
    // The bound table's fields stay, nothing is rebound, and there is no retry for the old table.
    expect(screen.getByText("Customer")).toBeInTheDocument();
    const bound = (onChange.mock.calls as [{ dataSource?: { id: string } }][]).map(
      ([value]) => value.dataSource?.id,
    );
    expect(bound).not.toContain("res-other");
    expect(screen.queryByText("knowledgeNetwork.objectTypeResourceFieldsFailed")).toBeNull();
  });
});
