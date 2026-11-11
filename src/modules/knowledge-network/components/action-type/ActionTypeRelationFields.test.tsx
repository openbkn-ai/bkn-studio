/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Form } from "antd";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import { ActionTypeRelationFields } from "./ActionTypeRelationFields";

const mocks = vi.hoisted(() => ({ getRelation: vi.fn(), listRelations: vi.fn() }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../../services/relation-type.service", () => ({
  getKnowledgeNetworkRelationTypeDetail: mocks.getRelation,
  listKnowledgeNetworkRelationTypePage: mocks.listRelations,
}));
vi.mock("antd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("antd")>()),
  Select: ({
    id,
    onChange,
    options,
    value,
    disabled,
  }: {
    id?: string;
    onChange?: (value: string) => void;
    options?: { label: string; value: string }[];
    value?: string;
    disabled?: boolean;
  }) => (
    <select
      id={id}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      value={value || ""}
    >
      <option value="" />
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const orderSupplier = {
  id: "order_supplier",
  name: "Supplied by",
  sourceObjectTypeId: "orders",
  sourceObjectTypeName: "Order",
  targetObjectTypeId: "suppliers",
  targetObjectTypeName: "Supplier",
};

describe("object-scoped relationship configuration", () => {
  it("waits for an object type before querying or enabling relationship selection", () => {
    renderWithoutAntdStyles(
      <Form>
        <ActionTypeRelationFields networkId="kn-1" objectTypeId="" onRelationChange={vi.fn()} />
      </Form>,
    );
    expect(screen.getByLabelText("knowledgeNetwork.actionRelationType")).toBeDisabled();
    expect(mocks.listRelations).not.toHaveBeenCalled();
    expect(mocks.getRelation).not.toHaveBeenCalled();
  });

  it("scopes both directions to the selected object and infers its target role", async () => {
    mocks.getRelation.mockResolvedValue(orderSupplier);
    mocks.listRelations.mockResolvedValue({
      entries: [
        orderSupplier,
        {
          id: "unrelated",
          name: "Unrelated",
          sourceObjectTypeId: "projects",
          targetObjectTypeId: "people",
        },
      ],
      totalCount: 2,
    });
    const onRelationChange = vi.fn();
    const onFinish = vi.fn();
    renderWithoutAntdStyles(
      <Form initialValues={{ relationTypeId: "order_supplier" }} onFinish={onFinish}>
        <ActionTypeRelationFields
          networkId="kn-1"
          objectTypeId="suppliers"
          onRelationChange={onRelationChange}
        />
        <button type="submit">save</button>
      </Form>,
    );
    await waitFor(() => expect(onRelationChange).toHaveBeenCalledWith(orderSupplier));
    await waitFor(() =>
      expect(mocks.listRelations).toHaveBeenCalledWith(
        "kn-1",
        expect.objectContaining({ boundObjectTypeId: "suppliers" }),
      ),
    );
    expect(screen.queryByRole("option", { name: "Unrelated" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({
        relationTypeId: "order_supplier",
        relationAnchor: "target",
      }),
    );
  });

  it("accepts a filtered dropdown choice before its detail request finishes", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [orderSupplier], totalCount: 1 });
    mocks.getRelation.mockImplementation(() => new Promise(() => undefined));
    const onValid = vi.fn();

    function TestForm() {
      const [form] = Form.useForm();
      return (
        <Form form={form}>
          <ActionTypeRelationFields
            networkId="kn-1"
            objectTypeId="orders"
            onRelationChange={vi.fn()}
          />
          <button
            onClick={() => {
              void form.validateFields(["relationTypeId"]).then(onValid, () => undefined);
            }}
            type="button"
          >
            validate relation
          </button>
        </Form>
      );
    }

    renderWithoutAntdStyles(<TestForm />);
    await screen.findByRole("option", { name: "Supplied by" });
    fireEvent.change(screen.getByLabelText("knowledgeNetwork.actionRelationType"), {
      target: { value: "order_supplier" },
    });
    fireEvent.click(screen.getByRole("button", { name: "validate relation" }));

    await waitFor(() => expect(onValid).toHaveBeenCalled());
    expect(screen.queryByText("knowledgeNetwork.actionRelationBoundRequired")).toBeNull();
  });

  it("clears a pending detail validation error once the selected relation loads", async () => {
    mocks.listRelations.mockResolvedValue({ entries: [], totalCount: 0 });
    let resolveDetail!: (value: typeof orderSupplier) => void;
    mocks.getRelation.mockReturnValue(
      new Promise<typeof orderSupplier>((resolve) => {
        resolveDetail = resolve;
      }),
    );

    function TestForm() {
      const [form] = Form.useForm();
      return (
        <Form form={form} initialValues={{ relationTypeId: "order_supplier" }}>
          <ActionTypeRelationFields
            networkId="kn-1"
            objectTypeId="orders"
            onRelationChange={vi.fn()}
          />
          <button
            onClick={() => {
              void form.validateFields(["relationTypeId"]).catch(() => undefined);
            }}
            type="button"
          >
            validate relation
          </button>
        </Form>
      );
    }

    renderWithoutAntdStyles(<TestForm />);
    fireEvent.click(screen.getByRole("button", { name: "validate relation" }));
    expect(
      await screen.findByText("knowledgeNetwork.actionRelationBoundRequired"),
    ).toBeInTheDocument();

    await act(async () => {
      resolveDetail(orderSupplier);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.queryByText("knowledgeNetwork.actionRelationBoundRequired")).toBeNull(),
    );
  });

  it("requires an explicit direction for self relationships and preserves an existing selection", async () => {
    const relation = {
      ...orderSupplier,
      id: "parent_child",
      sourceObjectTypeId: "people",
      targetObjectTypeId: "people",
    };
    mocks.getRelation.mockResolvedValue(relation);
    mocks.listRelations.mockResolvedValue({ entries: [relation], totalCount: 1 });
    const onFinish = vi.fn();
    const onRelationChange = vi.fn();
    const { rerender } = renderWithoutAntdStyles(
      <Form initialValues={{ relationTypeId: "parent_child" }} onFinish={onFinish}>
        <ActionTypeRelationFields
          networkId="kn-1"
          objectTypeId="people"
          onRelationChange={onRelationChange}
        />
        <button type="submit">save</button>
      </Form>,
    );
    await waitFor(() => expect(onRelationChange).toHaveBeenCalledWith(relation));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(
      await screen.findByText("knowledgeNetwork.actionRelationAnchorRequired"),
    ).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("radio", { name: "knowledgeNetwork.actionRelationAnchorTarget" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() =>
      expect(onFinish).toHaveBeenCalledWith({
        relationTypeId: "parent_child",
        relationAnchor: "target",
      }),
    );
    rerender(
      <Form initialValues={{ relationTypeId: "parent_child" }} onFinish={onFinish}>
        <ActionTypeRelationFields
          networkId="kn-1"
          objectTypeId="people"
          onRelationChange={onRelationChange}
        />
        <button type="submit">save</button>
      </Form>,
    );
    expect(
      screen.getByRole("radio", { name: "knowledgeNetwork.actionRelationAnchorTarget" }),
    ).toBeChecked();
  });

  it("rejects a retained relationship that does not touch the new object class", async () => {
    mocks.getRelation.mockResolvedValue(orderSupplier);
    mocks.listRelations.mockResolvedValue({ entries: [orderSupplier], totalCount: 1 });
    const onFinish = vi.fn();
    const callback = vi.fn();
    renderWithoutAntdStyles(
      <Form initialValues={{ relationTypeId: "order_supplier" }} onFinish={onFinish}>
        <ActionTypeRelationFields
          networkId="kn-1"
          objectTypeId="projects"
          onRelationChange={callback}
        />
        <button type="submit">save</button>
      </Form>,
    );
    await waitFor(() => expect(mocks.getRelation).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(
      await screen.findByText("knowledgeNetwork.actionRelationBoundRequired"),
    ).toBeInTheDocument();
    expect(callback).not.toHaveBeenCalledWith(orderSupplier);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
