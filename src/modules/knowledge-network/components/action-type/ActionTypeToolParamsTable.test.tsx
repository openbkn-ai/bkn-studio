/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";
import type { ActionTypeExecutionParameter } from "../../types/action-type";
import type { ActionRelationTableContext } from "../../utils/action-type-operation";
import { ActionTypeToolParamsTable } from "./ActionTypeToolParamsTable";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
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
  vi.unstubAllGlobals();
});

const schema = [{ key: "order_id", name: "order_id", type: "string" }];
const context: ActionRelationTableContext = {
  sourceIdentity: {
    objectTypeId: "orders",
    objectTypeName: "Order",
    properties: [{ name: "order_id", label: "Order ID", type: "string" }],
  },
  targetIdentity: {
    objectTypeId: "suppliers",
    objectTypeName: "Supplier",
    properties: [{ name: "supplier_id", label: "Supplier ID", type: "string" }],
  },
};

describe("relationship identities in the tool parameter table", () => {
  it("binds an endpoint directly in the row and displays the configured identity as read-only", async () => {
    const onChange = vi.fn();
    function Editor() {
      const [parameters, setParameters] = useState<ActionTypeExecutionParameter[]>([
        { name: "order_id", type: "string", valueFrom: "input" },
      ]);
      return (
        <ActionTypeToolParamsTable
          hasSource
          inputSchema={schema}
          parameters={parameters}
          propertyOptions={[]}
          relationBinding={context}
          onChange={(next) => {
            setParameters(next);
            onChange(next);
          }}
        />
      );
    }
    renderWithoutAntdStyles(<Editor />);
    const source = await screen.findByRole("combobox", {
      name: "order_id knowledgeNetwork.actionTypeExecutionParameterValueSource",
    });
    fireEvent.mouseDown(source);
    fireEvent.click(
      screen.getByText("knowledgeNetwork.actionRelationSourceIdentity", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: "order_id", valueFrom: "source_identity" }),
      ]),
    );
    const identity = screen.getByLabelText(
      "order_id knowledgeNetwork.actionRelationIdentityProperty",
    );
    expect(identity).toHaveValue("Order.order_id");
    expect(identity).toHaveAttribute("readonly");

    fireEvent.mouseDown(source);
    fireEvent.click(
      screen.getByText("knowledgeNetwork.actionTypeExecutionValueFromInput", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith([
        expect.objectContaining({ name: "order_id", valueFrom: "input" }),
      ]),
    );
    expect(
      screen.queryByLabelText("order_id knowledgeNetwork.actionRelationIdentityProperty"),
    ).toBeNull();
  });

  it("keeps endpoint sources out of ordinary tool actions", async () => {
    renderWithoutAntdStyles(
      <ActionTypeToolParamsTable
        hasSource
        inputSchema={schema}
        parameters={[{ name: "order_id", valueFrom: "input" }]}
        propertyOptions={[]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.mouseDown(
      await screen.findByRole("combobox", {
        name: "order_id knowledgeNetwork.actionTypeExecutionParameterValueSource",
      }),
    );
    expect(screen.queryByText("knowledgeNetwork.actionRelationSourceIdentity")).toBeNull();
    expect(
      screen.getByText("knowledgeNetwork.actionTypeExecutionValueFromProperty", {
        selector: ".ant-select-item-option-content",
      }),
    ).toBeInTheDocument();
  });
});
