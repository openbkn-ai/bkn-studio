/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

// Keys only, except that a value type a message names is shown after its key.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, params?: { valueType?: unknown }) =>
      params?.valueType === undefined ? key : `${key} ${JSON.stringify(params.valueType)}`,
  }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => "available",
  useEntitlementContext: () => ({ snapshot: null }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() } }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Drawer: ({
      children,
      footer,
      open,
      title,
    }: {
      children?: ReactNode;
      footer?: ReactNode;
      open?: boolean;
      title?: ReactNode;
    }) =>
      open ? (
        <div>
          <h1>{title}</h1>
          {children}
          {footer}
        </div>
      ) : null,
  };
});

import type {
  ObjectTypeDataProperty,
  ValueType,
} from "@/modules/knowledge-network/types/knowledge-network";

import { ObjectTypeDataAttributeFormDrawer } from "./ObjectTypeDataAttributeFormDrawer";
import type { PropertyDeclarationContext } from "./PropertyDeclarationsSection";

const PREFIX = "knowledgeNetwork.propertyDeclarations";

const amount: ValueType = {
  baseType: "decimal",
  description: "",
  id: "amount_cny",
  name: "Amount",
  range: { min: 0 },
  tags: [],
  unit: "CNY",
  updateTime: "-",
  updaterName: "-",
};

const property = (overrides: Partial<ObjectTypeDataProperty> = {}): ObjectTypeDataProperty => ({
  displayKey: false,
  displayName: "Fee",
  incrementalKey: false,
  name: "fee",
  primaryKey: false,
  type: "decimal",
  ...overrides,
});

const context = (
  overrides: Partial<PropertyDeclarationContext> = {},
): PropertyDeclarationContext => ({
  canModifyValueTypes: true,
  networkId: "kn-1",
  otherProperties: [],
  reloadValueTypes: vi.fn().mockResolvedValue([amount]),
  valueTypes: [amount],
  ...overrides,
});

function renderDrawer(value: ObjectTypeDataProperty, declarationContext = context()) {
  const onSubmit = vi.fn();
  renderWithoutAntdStyles(
    <ObjectTypeDataAttributeFormDrawer
      declarationContext={declarationContext}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      open
      property={value}
    />,
  );
  return onSubmit;
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

const panel = () =>
  screen.getByText(`${PREFIX}.title`).closest(".ant-collapse-item") as HTMLElement;

const formItem = (label: string) =>
  screen.getByText(label).closest(".ant-form-item") as HTMLElement;

function openSelect(label: string) {
  fireEvent.mouseDown(formItem(label).querySelector(".ant-select-selector")!);
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

afterEach(() => {
  cleanup();
});

describe("PropertyDeclarationsSection", () => {
  it("folds the section of an undeclared property and marks it undeclared", () => {
    renderDrawer(property());

    expect(panel()).not.toHaveClass("ant-collapse-item-active");
    expect(within(panel()).getByText(`${PREFIX}.undeclared`)).toBeInTheDocument();
  });

  it("is absent where the drawer edits a mask rule", () => {
    renderWithoutAntdStyles(
      <ObjectTypeDataAttributeFormDrawer
        declarationContext={context()}
        mode="mask-rule"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
        property={property({ type: "string" })}
      />,
    );

    expect(screen.queryByText(`${PREFIX}.title`)).toBeNull();
  });

  it("opens the section of a declared property and submits its declarations unchanged", async () => {
    const declarations = {
      aliases: ["Lab fee"],
      constraints: { passthrough: { future: { level: 2 } }, range: { min: 0 }, unique: true },
    };
    const onSubmit = renderDrawer(property({ declarations }));

    expect(panel()).toHaveClass("ant-collapse-item-active");
    expect(within(panel()).queryByText(`${PREFIX}.undeclared`)).toBeNull();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ declarations }));
  });

  it("submits no declarations once the last one is cleared", async () => {
    const onSubmit = renderDrawer(property({ declarations: { required: true } }));

    fireEvent.click(screen.getByRole("checkbox", { name: `${PREFIX}.requiredLabel` }));
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty("declarations");
  });

  it("shows a primary key as required, with nothing to change", () => {
    renderDrawer(property({ primaryKey: true }));
    fireEvent.click(within(panel()).getByText(`${PREFIX}.title`));

    const checkbox = screen.getByRole("checkbox", { name: `${PREFIX}.requiredPrimaryKey` });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.queryByRole("checkbox", { name: `${PREFIX}.requiredLabel` })).toBeNull();
  });

  it("refuses an alias that names another property and opens the folded section", async () => {
    const onSubmit = renderDrawer(
      property(),
      context({ otherProperties: [property({ displayName: "Total", name: "total" })] }),
    );

    fireEvent.change(formItem(`${PREFIX}.aliases`).querySelector("input")!, {
      target: { value: "Total," },
    });
    submit();

    expect(await screen.findByText(`${PREFIX}.aliasProblem.otherProperty`)).toBeInTheDocument();
    await waitFor(() => expect(panel()).toHaveClass("ant-collapse-item-active"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers only the semantics of the type, and not one another property declares", () => {
    renderDrawer(
      property({ name: "status", type: "keyword" }),
      context({
        otherProperties: [property({ declarations: { semantic: "status" }, name: "state" })],
      }),
    );

    openSelect(`${PREFIX}.semantic`);

    const options = document.querySelectorAll(".ant-select-item-option");
    expect([...options].map((option) => option.textContent)).toEqual([
      `${PREFIX}.semanticTaken`,
      `${PREFIX}.semanticValue.severity`,
    ]);
    expect(options[0]).toHaveClass("ant-select-item-option-disabled");
  });

  it("hides the inline value rules once a value type is named, and drops them", async () => {
    const onSubmit = renderDrawer(
      property({ declarations: { constraints: { range: { min: 1 }, unique: true, unit: "USD" } } }),
    );
    expect(screen.getByText("knowledgeNetwork.valueTypes.rules.rangeMin")).toBeInTheDocument();

    openSelect(`${PREFIX}.valueType`);
    fireEvent.click(document.querySelector(".ant-select-item-option[title='Amount']")!);

    await waitFor(() =>
      expect(screen.queryByText("knowledgeNetwork.valueTypes.rules.rangeMin")).toBeNull(),
    );
    expect(screen.queryByText("knowledgeNetwork.valueTypes.rules.unit")).toBeNull();
    expect(screen.getByText(`${PREFIX}.valueTypeView`)).toBeInTheDocument();
    // The property's own range and unit went with it, which the section says.
    expect(screen.getByText(`${PREFIX}.clearedByValueType "Amount"`)).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        declarations: { constraints: { unique: true, valueType: "amount_cny" } },
      }),
    );
  });

  it("says nothing is cleared when a property without its own rules names a value type", async () => {
    renderDrawer(property({ declarations: { constraints: { unique: true } } }));

    openSelect(`${PREFIX}.valueType`);
    fireEvent.click(document.querySelector(".ant-select-item-option[title='Amount']")!);

    await waitFor(() => expect(screen.getByText(`${PREFIX}.valueTypeView`)).toBeInTheDocument());
    expect(screen.queryByText(/clearedByValueType/)).toBeNull();
  });

  it("says a value type the list does not hold is missing, and keeps it", async () => {
    const onSubmit = renderDrawer(
      property({ declarations: { constraints: { valueType: "gone" } } }),
    );

    expect(screen.getByText(`${PREFIX}.valueTypeMissing`)).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ declarations: { constraints: { valueType: "gone" } } }),
    );
  });

  it("clears what a new type cannot declare and says so", async () => {
    const onSubmit = renderDrawer(
      property({
        declarations: {
          aliases: ["Applied at"],
          constraints: { timezone: "Asia/Shanghai" },
          semantic: "event_time",
        },
        name: "ordered_at",
        type: "datetime",
      }),
    );

    openSelect("knowledgeNetwork.objectTypePropertyType");
    fireEvent.click(document.querySelector(".ant-select-item-option[title='string']")!);

    expect(await screen.findByText(`${PREFIX}.cleared`)).toBeInTheDocument();
    submit();

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ declarations: { aliases: ["Applied at"] }, type: "string" }),
    );
  });

  it("refuses a time zone that is not an IANA name", async () => {
    const onSubmit = renderDrawer(
      property({ declarations: { constraints: { timezone: "Local" } }, type: "datetime" }),
    );

    submit();

    expect(await screen.findByText(`${PREFIX}.timezoneInvalid`)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
