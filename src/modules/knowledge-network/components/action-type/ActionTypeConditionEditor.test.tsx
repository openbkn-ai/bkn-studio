/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActionTypeConditionEditor } from "@/modules/knowledge-network/components/action-type/ActionTypeConditionEditor";
import type { ActionTypeCondition } from "@/modules/knowledge-network/types/knowledge-network";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

describe("ActionTypeConditionEditor", () => {
  it("clears a fixed value when switching sources and picks only matching properties", () => {
    const handleChange = vi.fn();
    function Editor() {
      const [condition, setCondition] = useState<ActionTypeCondition>({
        field: "amount",
        objectTypeId: "orders",
        operation: ">=",
        value: "100",
      });
      return (
        <ActionTypeConditionEditor
          boundObjectTypeId="orders"
          hideObjectTypeSelect
          objectTypes={[]}
          onChange={(next) => {
            handleChange(next);
            setCondition(next!);
          }}
          propertyOptions={[
            {
              name: "amount",
              displayName: "Amount",
              label: "Amount",
              value: "amount",
              type: "number",
            },
            {
              name: "minimum",
              displayName: "Minimum",
              label: "Minimum",
              value: "minimum",
              type: "integer",
            },
            {
              name: "status",
              displayName: "Status",
              label: "Status",
              value: "status",
              type: "string",
            },
          ]}
          value={condition}
        />
      );
    }
    render(<Editor />);
    expect(screen.getByDisplayValue("100")).toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "knowledgeNetwork.actionTypeConditionValueSource" }),
    );
    fireEvent.click(screen.getByText("knowledgeNetwork.actionTypeExecutionValueFromProperty"));
    expect(handleChange.mock.lastCall?.[0]).toMatchObject({
      valueFrom: "property",
      value: undefined,
    });
    expect(screen.queryByDisplayValue("100")).toBeNull();
    fireEvent.mouseDown(
      screen.getByRole("combobox", {
        name: "knowledgeNetwork.actionTypeConditionPropertyPlaceholder",
      }),
    );
    expect(
      screen.queryByText("Status", { selector: ".ant-select-item-option-content" }),
    ).toBeNull();
    fireEvent.click(screen.getByText("Minimum", { selector: ".ant-select-item-option-content" }));
    expect(handleChange.mock.lastCall?.[0]).toMatchObject({
      valueFrom: "property",
      value: "minimum",
    });
  });

  it("binds a runtime input without including constant or incompatible tool parameters", () => {
    const handleChange = vi.fn();
    render(
      <ActionTypeConditionEditor
        boundObjectTypeId="orders"
        executionParameters={[
          { name: "requested", type: "number", valueFrom: "input" },
          { name: "fixed", type: "number", valueFrom: "const", value: "10" },
          { name: "text", type: "string", valueFrom: "input" },
        ]}
        hideObjectTypeSelect
        objectTypes={[]}
        onChange={handleChange}
        propertyOptions={[
          {
            name: "amount",
            displayName: "Amount",
            label: "Amount",
            value: "amount",
            type: "number",
          },
        ]}
        value={{ field: "amount", operation: ">=", valueFrom: "input" }}
      />,
    );
    fireEvent.mouseDown(
      screen.getByRole("combobox", {
        name: "knowledgeNetwork.actionTypeConditionParameterPlaceholder",
      }),
    );
    expect(screen.queryByText("fixed")).toBeNull();
    expect(screen.queryByText("text")).toBeNull();
    fireEvent.click(screen.getByText("requested", { selector: ".ant-select-item-option-content" }));
    expect(handleChange.mock.lastCall?.[0]).toMatchObject({
      valueFrom: "input",
      value: "requested",
    });
  });

  it("keeps reference sources inside nested condition groups when another row changes", () => {
    const handleChange = vi.fn();
    render(
      <ActionTypeConditionEditor
        boundObjectTypeId="orders"
        hideObjectTypeSelect
        objectTypes={[]}
        onChange={handleChange}
        propertyOptions={[]}
        value={{
          operation: "and",
          subConditions: [
            { field: "status", operation: "==", value: "Active", valueFrom: "const" },
            {
              operation: "or",
              subConditions: [
                { field: "amount", operation: ">=", value: "minimum", valueFrom: "property" },
                { field: "amount", operation: ">=", value: "requested", valueFrom: "input" },
              ],
            },
          ],
        }}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Active"), { target: { value: "Inactive" } });
    const nextCondition = handleChange.mock.lastCall?.[0] as ActionTypeCondition | undefined;
    expect(nextCondition?.subConditions?.[1]?.subConditions).toEqual([
      expect.objectContaining({ valueFrom: "property", value: "minimum" }),
      expect.objectContaining({ valueFrom: "input", value: "requested" }),
    ]);
  });
  it("does not duplicate legacy flat sub-conditions when editing the root row", () => {
    const handleChange = vi.fn();
    const legacyCondition: ActionTypeCondition = {
      field: "status",
      objectTypeId: "material_entity",
      operation: "==",
      subConditions: [
        {
          field: "amount",
          objectTypeId: "material_entity",
          operation: ">",
          value: "100",
          valueFrom: "const",
        },
      ],
      value: "Active",
      valueFrom: "const",
    };

    render(
      <ActionTypeConditionEditor
        boundObjectTypeId="material_entity"
        hideObjectTypeSelect
        objectTypes={[]}
        onChange={handleChange}
        propertyOptions={[
          {
            displayName: "Status",
            label: "Status",
            name: "status",
            type: "string",
            value: "status",
          },
          {
            displayName: "Amount",
            label: "Amount",
            name: "amount",
            type: "number",
            value: "amount",
          },
        ]}
        value={legacyCondition}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Active"), {
      target: { value: "Inactive" },
    });

    expect(handleChange).toHaveBeenCalled();
    const nextCondition = handleChange.mock.lastCall?.[0] as ActionTypeCondition;

    expect(nextCondition.operation).toBe("and");
    expect(nextCondition.subConditions).toHaveLength(2);
    expect(nextCondition.subConditions?.[0]).toMatchObject({
      field: "status",
      operation: "==",
      value: "Inactive",
    });
    expect(nextCondition.subConditions?.[0]?.subConditions).toBeUndefined();
    expect(nextCondition.subConditions?.[1]).toMatchObject({
      field: "amount",
      operation: ">",
      value: "100",
    });
  });

  it("hides value input for valueless operations and clears stale values", () => {
    const handleChange = vi.fn();

    render(
      <ActionTypeConditionEditor
        boundObjectTypeId="material_entity"
        hideObjectTypeSelect
        objectTypes={[]}
        onChange={handleChange}
        propertyOptions={[
          {
            displayName: "Product ID",
            label: "Product ID",
            name: "product_id",
            type: "string",
            value: "product_id",
          },
        ]}
        value={{
          field: "product_id",
          objectTypeId: "material_entity",
          operation: "exist",
          value: "stale",
          valueFrom: "input",
        }}
      />,
    );

    expect(
      screen.queryByPlaceholderText("knowledgeNetwork.actionTypeConditionValueInputPlaceholder"),
    ).toBeNull();
    expect(screen.queryByLabelText("knowledgeNetwork.actionTypeConditionValueSource")).toBeNull();

    fireEvent.mouseDown(screen.getByText("knowledgeNetwork.actionTypeConditionOperation_exist"));
    fireEvent.click(screen.getByText("knowledgeNetwork.actionTypeConditionOperation_not_exist"));

    const nextCondition = handleChange.mock.lastCall?.[0] as ActionTypeCondition;

    expect(nextCondition.operation).toBe("not_exist");
    expect(nextCondition.value).toBeUndefined();
    expect(nextCondition.valueFrom).toBe("const");
  });
});
