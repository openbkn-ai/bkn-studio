/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  error: vi.fn(),
  list: vi.fn(),
  success: vi.fn(),
  update: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: mocks.error, success: mocks.success },
    modal: { confirm: mocks.confirm },
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  listKnowledgeNetworkTags: () => Promise.resolve([]),
}));

vi.mock("@/modules/knowledge-network/services/value-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/value-type.service")
  >()),
  createKnowledgeNetworkValueType: mocks.create,
  deleteKnowledgeNetworkValueType: mocks.delete,
  listKnowledgeNetworkValueTypes: mocks.list,
  updateKnowledgeNetworkValueType: mocks.update,
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
        <section aria-label={typeof title === "string" ? title : undefined}>
          <h1>{title}</h1>
          {children}
          {footer}
        </section>
      ) : null,
  };
});

import { ValueTypeReferencedError } from "@/modules/knowledge-network/services/value-type.service";
import type { ValueType } from "@/modules/knowledge-network/types/knowledge-network";

import { ValueTypeFormDrawer } from "./ValueTypeFormDrawer";
import { ValueTypeListDrawer } from "./ValueTypeListDrawer";

const PREFIX = "knowledgeNetwork.valueTypes";

const status: ValueType = {
  baseType: "keyword",
  description: "",
  enum: [
    { display: "Applied", value: "applied" },
    { deprecated: true, display: "Paid", value: "paid" },
  ],
  id: "lis_apply_status",
  name: "Lab order status",
  tags: [],
  updateTime: "-",
  updaterName: "-",
};

const amount: ValueType = {
  baseType: "decimal",
  color: "#1677ff",
  description: "",
  id: "amount_cny",
  name: "Amount",
  range: { min: 0 },
  tags: [],
  unit: "CNY",
  updateTime: "-",
  updaterName: "-",
};

const references = [
  {
    objectTypeId: "lab_order",
    objectTypeName: "Lab order",
    property: "fee",
    propertyType: "decimal",
  },
];

const formItem = (label: string) =>
  screen.getByText(label).closest(".ant-form-item") as HTMLElement;

const input = (label: string) => formItem(label).querySelector("input")!;

function choose(label: string, option: string) {
  fireEvent.mouseDown(formItem(label).querySelector(".ant-select-selector")!);
  fireEvent.click(document.querySelector(`.ant-select-item-option[title='${option}']`)!);
}

function renderForm(props: Partial<Parameters<typeof ValueTypeFormDrawer>[0]> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <ValueTypeFormDrawer networkId="kn-1" onClose={onClose} onSaved={onSaved} open {...props} />
    </MemoryRouter>,
  );
  return { onClose, onSaved };
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "common.save" }));

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
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  cleanup();
});

describe("ValueTypeFormDrawer", () => {
  it("creates an enum value type and reports its ID", async () => {
    mocks.create.mockResolvedValue("lis_apply_status");
    const { onClose, onSaved } = renderForm({ defaultBaseType: "keyword" });

    fireEvent.change(input(`${PREFIX}.form.name`), { target: { value: " Lab order status " } });
    fireEvent.change(input(`${PREFIX}.form.id`), { target: { value: "lis_apply_status" } });
    fireEvent.click(screen.getByRole("radio", { name: `${PREFIX}.form.ruleEnum` }));
    fireEvent.click(
      await screen.findByRole("button", { name: new RegExp(`${PREFIX}.form.enumAdd`) }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: `${PREFIX}.enumColumn.value` }), {
      target: { value: "applied" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: `${PREFIX}.enumColumn.display` }), {
      target: { value: "Applied" },
    });
    save();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("lis_apply_status"));
    expect(mocks.create).toHaveBeenCalledWith("kn-1", {
      baseType: "keyword",
      color: undefined,
      description: "",
      enum: [{ display: "Applied", value: "applied" }],
      icon: undefined,
      id: "lis_apply_status",
      name: "Lab order status",
      tags: [],
      unit: undefined,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses an enum without codes", async () => {
    renderForm({ defaultBaseType: "keyword" });

    fireEvent.change(input(`${PREFIX}.form.name`), { target: { value: "Status" } });
    fireEvent.click(screen.getByRole("radio", { name: `${PREFIX}.form.ruleEnum` }));
    save();

    expect(await screen.findByText(`${PREFIX}.form.enumEmpty`)).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses a code that is not a value of the base type, and a repeated code", async () => {
    renderForm({
      valueType: {
        ...status,
        baseType: "integer",
        enum: [
          { display: "One", value: "1" },
          { display: "Also one", value: "01" },
          { display: "A", value: "a" },
        ],
      },
    });

    save();

    expect(await screen.findAllByText(`${PREFIX}.form.enumDuplicate`)).toHaveLength(2);
    expect(screen.getByText(`${PREFIX}.form.enumValueInvalid`)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("offers the rules of the base type, and drops them when it changes", async () => {
    renderForm({ valueType: amount });

    expect(screen.getByText(`${PREFIX}.rules.rangeMin`)).toBeInTheDocument();
    expect(screen.getByText(`${PREFIX}.rules.unit`)).toBeInTheDocument();
    expect(screen.queryByText(`${PREFIX}.rules.pattern`)).toBeNull();

    choose(`${PREFIX}.form.baseType`, "string");
    await waitFor(() => expect(screen.getByText(`${PREFIX}.rules.pattern`)).toBeInTheDocument());
    expect(screen.queryByText(`${PREFIX}.rules.unit`)).toBeNull();
    save();

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    // The ID stays out of the input; the service puts the one in the path into the body.
    expect(mocks.update).toHaveBeenCalledWith("kn-1", "amount_cny", {
      baseType: "string",
      color: "#1677ff",
      description: "",
      icon: undefined,
      length: undefined,
      name: "Amount",
      pattern: undefined,
      range: undefined,
      tags: [],
      unit: undefined,
    });
  });

  it("refuses a range whose lower bound is above the upper one", async () => {
    renderForm({ valueType: { ...amount, range: { max: 1, min: 5 } } });

    save();

    expect(await screen.findByText(`${PREFIX}.rules.rangeReversed`)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("names the properties that hold a base type change back", async () => {
    mocks.update.mockRejectedValue(
      new ValueTypeReferencedError("BknBackend.ValueType.Referenced", references),
    );
    const { onSaved } = renderForm({ valueType: amount });

    choose(`${PREFIX}.form.baseType`, "integer");
    save();

    expect(await screen.findByText(`${PREFIX}.referenced.updateTitle`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lab order" })).toHaveAttribute(
      "href",
      "/knowledge-network/workspace/kn-1/object-types/lab_order/detail",
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("shows a value type without a way to change it", () => {
    renderForm({ readOnly: true, valueType: status });

    expect(screen.getByText(`${PREFIX}.form.viewTitle`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.save" })).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(`${PREFIX}.form.enumAdd`) })).toBeNull();
    expect(input(`${PREFIX}.form.name`)).toBeDisabled();
  });
});

describe("ValueTypeListDrawer", () => {
  function renderList(canModify = true) {
    render(
      <MemoryRouter>
        <ValueTypeListDrawer canModify={canModify} networkId="kn-1" onClose={vi.fn()} open />
      </MemoryRouter>,
    );
  }

  it("lists the value types of the network and finds them by name or ID", async () => {
    mocks.list.mockResolvedValue([amount, status]);
    renderList();

    expect(await screen.findByText("Amount")).toBeInTheDocument();
    expect(screen.getByText(`${PREFIX}.drawerTitle`)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(`${PREFIX}.create`) }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(`${PREFIX}.searchPlaceholder`), {
      target: { value: "LIS_" },
    });

    expect(screen.queryByText("Amount")).toBeNull();
    expect(screen.getByText("Lab order status")).toBeInTheDocument();
  });

  it("says when the list does not load", async () => {
    mocks.list.mockRejectedValue(new Error("Boom"));
    renderList();

    expect(await screen.findByText(`${PREFIX}.loadFailed`)).toBeInTheDocument();
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("offers no change to a user who cannot modify the network", async () => {
    mocks.list.mockResolvedValue([amount]);
    renderList(false);

    expect(await screen.findByText("Amount")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(`${PREFIX}.create`) })).toBeNull();
    expect(screen.queryByText(`${PREFIX}.delete`)).toBeNull();
  });

  it("names the properties that still use a value type it could not delete", async () => {
    mocks.list.mockResolvedValue([amount]);
    mocks.confirm.mockImplementation((config: { onOk: () => Promise<void> }) => {
      void config.onOk();
    });
    mocks.delete.mockRejectedValue(
      new ValueTypeReferencedError("BknBackend.ValueType.Referenced", references),
    );
    renderList();

    const row = (await screen.findByText("Amount")).closest("tr")!;
    fireEvent.click(within(row).getByText(`${PREFIX}.delete`));

    expect(await screen.findByText(`${PREFIX}.referenced.deleteTitle`)).toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith("kn-1", "amount_cny");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("reads the list again after a delete", async () => {
    mocks.list.mockResolvedValueOnce([amount]).mockResolvedValueOnce([]);
    mocks.confirm.mockImplementation((config: { onOk: () => Promise<void> }) => {
      void config.onOk();
    });
    mocks.delete.mockResolvedValue(undefined);
    renderList();

    const row = (await screen.findByText("Amount")).closest("tr")!;
    fireEvent.click(within(row).getByText(`${PREFIX}.delete`));

    await waitFor(() => expect(screen.queryByText("Amount")).toBeNull());
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith(`${PREFIX}.deleted`);
  });
});
