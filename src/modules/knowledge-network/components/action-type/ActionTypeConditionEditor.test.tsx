/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
