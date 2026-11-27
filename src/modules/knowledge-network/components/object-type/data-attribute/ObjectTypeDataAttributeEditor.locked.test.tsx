/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/object-type";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const confirmMock = vi.hoisted(() => vi.fn());
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
    modal: { confirm: confirmMock },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listObjectTypeResourceFields: vi.fn(),
}));

// The drawer says what it was opened with, so the locks it is given can be read.
vi.mock("./ObjectTypeDataAttributeFormDrawer", () => ({
  ObjectTypeDataAttributeFormDrawer: ({
    open,
    primaryKeyLocked,
    typeLocked,
  }: {
    open: boolean;
    primaryKeyLocked?: boolean;
    typeLocked?: boolean;
  }) =>
    open ? (
      <div
        data-primary-key-locked={String(Boolean(primaryKeyLocked))}
        data-testid="property-drawer"
        data-type-locked={String(Boolean(typeLocked))}
      />
    ) : null,
}));

vi.mock("./ObjectTypeDataAttributePickModal", () => ({
  ObjectTypeDataAttributePickModal: () => null,
}));

vi.mock("./ObjectTypeResourceDescriptionFillModal", () => ({
  ObjectTypeResourceDescriptionFillModal: () => null,
}));

vi.mock("./ObjectTypeResourceSelectModal", () => ({
  ObjectTypeResourceSelectModal: () => null,
}));

import { ObjectTypeDataAttributeEditor } from "./ObjectTypeDataAttributeEditor";

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

const properties: ObjectTypeDataProperty[] = [
  {
    displayKey: false,
    displayName: "Customer",
    incrementalKey: false,
    mappedField: { displayName: "Customer", name: "customer_id", type: "string" },
    name: "customer_id",
    primaryKey: true,
    type: "string",
  },
  {
    displayKey: false,
    displayName: "Note",
    incrementalKey: false,
    mappedField: { displayName: "Note", name: "note", type: "string" },
    name: "note",
    primaryKey: false,
    type: "string",
  },
];

const fields = [
  { displayName: "Customer", name: "customer_id", type: "string" },
  { displayName: "Note", name: "note", type: "string" },
];

function render(locks: {
  addLocked?: boolean;
  fieldRequired?: boolean;
  lockedProperties?: string[];
  primaryKeyLocked?: boolean;
}) {
  const onChange = vi.fn();
  renderWithoutAntdStyles(
    <ObjectTypeDataAttributeEditor
      basicValue={{ color: "#1677ff", name: "Customers" }}
      dataProperties={properties}
      dataSource={{ id: "res-customers", name: "customers" }}
      networkId="network-1"
      onChange={onChange}
      readResourceFields={() => Promise.resolve(fields)}
      resourceFixed
      {...locks}
    />,
  );
  return onChange;
}

/** The property's row in the properties panel, by its display name. */
const row = (name: string) => {
  const item = screen
    .getAllByText(name)
    .map((element) => element.closest("[class*='panelItem']"))
    .find((element) => element?.querySelector("[aria-label='edit']"));
  if (!item) throw new Error(`no property row ${name}`);
  return within(item as HTMLElement);
};

describe("ObjectTypeDataAttributeEditor with locked properties", () => {
  it("keeps a locked property's mapping and removal out of reach, and the others editable", async () => {
    const onChange = render({ lockedProperties: ["customer_id"], primaryKeyLocked: true });
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));

    const locked = row("Customer");
    expect(locked.queryByLabelText("delete")).toBeNull();
    expect(locked.queryByLabelText("disconnect")).toBeNull();
    expect(locked.getByLabelText("knowledgeNetwork.objectTypePropertyLocked")).toBeInTheDocument();
    // The primary key stays: neither row offers to change it.
    expect(locked.queryByLabelText("book")).not.toBeNull();
    expect(row("Note").queryByLabelText("book")).toBeNull();

    // A property the network does not have yet is removed as before.
    fireEvent.click(row("Note").getByLabelText("delete"));
    const [[{ dataProperties }]] = onChange.mock.calls as [
      [{ dataProperties: ObjectTypeDataProperty[] }],
    ];
    expect(dataProperties.map((item) => item.name)).toEqual(["customer_id"]);

    // Its wording stays editable: the drawer opens, with its type and key locked.
    fireEvent.click(locked.getByLabelText("edit"));
    const drawer = screen.getByTestId("property-drawer");
    expect(drawer.dataset.typeLocked).toBe("true");
    expect(drawer.dataset.primaryKeyLocked).toBe("true");
  });

  it("offers everything without the locks", async () => {
    render({});
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
    expect(row("Customer").getByLabelText("delete")).toBeInTheDocument();
    expect(row("Customer").getByLabelText("disconnect")).toBeInTheDocument();
    expect(row("Note").getByLabelText("book")).toBeInTheDocument();
  });

  it("offers no way to add a property where only the wording may change", async () => {
    render({ addLocked: true });
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
    expect(screen.queryByLabelText("knowledgeNetwork.objectTypeAddDataProperty")).toBeNull();
  });

  it("offers no clearing where only the wording may change, or where every property is kept, and says why", async () => {
    for (const locks of [{ addLocked: true }, { lockedProperties: ["customer_id", "note"] }]) {
      const view = render(locks);
      await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
      fireEvent.click(screen.getByLabelText("knowledgeNetwork.objectTypeMorePropertyActions"));
      expect(
        await screen.findByText("knowledgeNetwork.objectTypeClearAllLocked"),
      ).toBeInTheDocument();
      const clear = screen.getByText("knowledgeNetwork.objectTypeClearAllProperties").closest("li");
      expect(clear).toHaveAttribute("aria-disabled", "true");
      confirmMock.mockClear();
      fireEvent.click(clear!);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(view).not.toHaveBeenCalled();
      // No row removes a property either.
      expect(row("Customer").queryByLabelText("delete")).toBeNull();
      expect(row("Note").queryByLabelText("delete")).toBeNull();
      // A row kept only because wording alone may change says only that it cannot be removed.
      if (locks.addLocked) {
        expect(
          row("Note").getByLabelText("knowledgeNetwork.objectTypePropertyKept"),
        ).toBeInTheDocument();
      }
      cleanup();
    }
  });

  it("still clears what may be removed", async () => {
    render({ lockedProperties: ["customer_id"] });
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.objectTypeMorePropertyActions"));
    const clear = (
      await screen.findByText("knowledgeNetwork.objectTypeClearAllProperties")
    ).closest("li");
    expect(clear).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("knowledgeNetwork.objectTypeClearAllLocked")).toBeNull();
    confirmMock.mockClear();
    fireEvent.click(clear!);
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it("says before adding that every field has a property, and offers no add that saving would refuse", async () => {
    render({ fieldRequired: true });
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.objectTypeAddDataProperty"));
    expect(
      await screen.findByText("knowledgeNetwork.objectTypeAllFieldsMapped"),
    ).toBeInTheDocument();
    const add = screen.getByText("knowledgeNetwork.objectTypeManualCreateProperty").closest("li");
    expect(add).toHaveAttribute("aria-disabled", "true");
  });

  it("still offers a property reading no field where one may, with no field left to sync", async () => {
    render({});
    await waitFor(() => expect(screen.getAllByText("Customer").length).toBeGreaterThan(1));
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.objectTypeAddDataProperty"));
    expect(
      await screen.findByText("knowledgeNetwork.objectTypeAllFieldsMapped"),
    ).toBeInTheDocument();
    const add = screen.getByText("knowledgeNetwork.objectTypeManualCreateProperty").closest("li");
    expect(add).not.toHaveAttribute("aria-disabled", "true");
    const sync = screen.getByText("knowledgeNetwork.objectTypeSyncResourceFields").closest("li");
    expect(sync).toHaveAttribute("aria-disabled", "true");
  });
});
