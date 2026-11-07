/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import type { ObjectTypeDataProperty } from "@/modules/knowledge-network/types/knowledge-network";

const mocks = vi.hoisted(() => ({
  drawer: vi.fn(),
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
  listObjectTypeResourceFields: () => Promise.resolve([]),
}));

vi.mock("./ObjectTypeDataAttributeFormDrawer", () => ({
  ObjectTypeDataAttributeFormDrawer: (props: { open: boolean; property?: { name: string } }) => {
    mocks.drawer(props);
    return props.open ? <div data-testid="property-drawer">{props.property?.name}</div> : null;
  },
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

import {
  ObjectTypeDataAttributeEditor,
  type ObjectTypeDataAttributeEditorHandle,
  type ObjectTypeDeclarationEditing,
} from "./ObjectTypeDataAttributeEditor";
import type { PropertyDeclarationContext } from "./PropertyDeclarationsSection";

const PREFIX = "knowledgeNetwork.propertyDeclarations";

const property = (
  name: string,
  overrides: Partial<ObjectTypeDataProperty> = {},
): ObjectTypeDataProperty => ({
  displayKey: false,
  displayName: name,
  incrementalKey: false,
  name,
  primaryKey: false,
  type: "keyword",
  ...overrides,
});

const properties = [
  property("order_no", { displayKey: true, primaryKey: true, type: "string" }),
  property("status", { declarations: { semantic: "status" } }),
  property("state", { declarations: { semantic: "status" } }),
];

const editing: ObjectTypeDeclarationEditing = {
  canModifyValueTypes: true,
  networkId: "kn-1",
  reloadValueTypes: () => Promise.resolve([]),
  valueTypes: [],
};

function renderEditor(
  dataProperties: ObjectTypeDataProperty[],
  declarations?: ObjectTypeDeclarationEditing,
) {
  const ref = createRef<ObjectTypeDataAttributeEditorHandle>();
  renderWithoutAntdStyles(
    <ObjectTypeDataAttributeEditor
      basicValue={{ color: "#1677ff", name: "Lab order" }}
      dataProperties={dataProperties}
      declarations={declarations}
      networkId="kn-1"
      onChange={vi.fn()}
      ref={ref}
    />,
  );
  return ref;
}

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

beforeEach(() => {
  mocks.drawer.mockReset();
});

describe("ObjectTypeDataAttributeEditor declarations", () => {
  it("refuses properties whose declarations break a rule across them, and names the one to fix", async () => {
    const ref = renderEditor(properties, editing);

    let outcome: unknown;
    await act(async () => {
      outcome = await ref.current!.validateFields().catch((error: unknown) => error);
    });

    expect(outcome).toBeInstanceOf(Error);
    expect(screen.getByText(`${PREFIX}.issuesTitle`)).toBeInTheDocument();
    expect(screen.getByText(`${PREFIX}.issue.semanticTaken`)).toBeInTheDocument();

    fireEvent.click(screen.getByText(`${PREFIX}.editProperty`));

    expect(await screen.findByTestId("property-drawer")).toHaveTextContent("state");
    const context = (
      mocks.drawer.mock.lastCall?.[0] as { declarationContext?: PropertyDeclarationContext }
    ).declarationContext;
    expect(context?.otherProperties.map((item) => item.name)).toEqual(["order_no", "status"]);
  });

  it("checks no declarations where the caller does not edit them", async () => {
    const ref = renderEditor(properties);

    let outcome: unknown;
    await act(async () => {
      outcome = await ref.current!.validateFields();
    });

    expect(outcome).toMatchObject({ dataProperties: properties });
    expect(screen.queryByText(`${PREFIX}.issuesTitle`)).toBeNull();
    expect(mocks.drawer.mock.lastCall?.[0]).toMatchObject({ declarationContext: undefined });
  });

  it("shows a backend refusal and opens the property it names", async () => {
    renderEditor(properties.slice(0, 2), {
      ...editing,
      refusal: {
        description: "Invalid declarations",
        details: 'data property "status": semantic status needs type string',
        property: "status",
      },
    });

    expect(screen.getByText(`${PREFIX}.refusalTitle`)).toBeInTheDocument();
    expect(
      screen.getByText('data property "status": semantic status needs type string'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(`${PREFIX}.editProperty`));

    expect(await screen.findByTestId("property-drawer")).toHaveTextContent("status");
  });
});
