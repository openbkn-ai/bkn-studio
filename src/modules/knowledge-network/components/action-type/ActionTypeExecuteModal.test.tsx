/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionTypeExecuteModal } from "./ActionTypeExecuteModal";

const loadSchema = vi.hoisted(() => vi.fn());
vi.mock("@/modules/knowledge-network/services/action-type.service", () => ({
  getActionTypeExecutionSchema: loadSchema,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const originalMatchMedia = window.matchMedia;
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

describe("action execution form", () => {
  beforeEach(() => {
    loadSchema.mockReset();
  });
  afterEach(cleanup);
  const props = {
    networkId: "kn",
    actionTypeId: "link",
    actionTypeName: "Link",
    open: true,
    onCancel: vi.fn(),
  };
  it("requires both directed identities even when no dynamic inputs are configured", async () => {
    loadSchema.mockResolvedValue({
      type: "object",
      properties: {
        relation_target: {
          type: "object",
          properties: {
            source_identity: {
              type: "object",
              title: "Orders",
              properties: { order_id: { type: "string", title: "Order number" } },
              required: ["order_id"],
            },
            target_identity: {
              type: "object",
              title: "Suppliers",
              properties: { supplier_id: { type: "string", title: "Supplier number" } },
              required: ["supplier_id"],
            },
          },
        },
      },
    });
    const submit = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    render(<ActionTypeExecuteModal {...props} onSubmit={submit} />);
    await screen.findByLabelText("Order number");
    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.actionTypeExecuteImmediately" }),
    );
    await waitFor(() =>
      expect(document.querySelectorAll(".ant-form-item-has-error")).toHaveLength(2),
    );
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Order number"), { target: { value: "O1" } });
    fireEvent.change(screen.getByLabelText("Supplier number"), { target: { value: "S2" } });
    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.actionTypeExecuteImmediately" }),
    );
    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        relation_target: {
          source_identity: { order_id: "O1" },
          target_identity: { supplier_id: "S2" },
        },
      }),
    );
  });
  it("blocks submission when the service cannot provide the new execution contract", async () => {
    loadSchema.mockRejectedValue(new Error("old service"));
    const submit = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    render(<ActionTypeExecuteModal {...props} onSubmit={submit} />);
    await screen.findByText("knowledgeNetwork.actionExecutionSchemaUnavailable");
    expect(
      screen.getByRole("button", { name: "knowledgeNetwork.actionTypeExecuteImmediately" }),
    ).toBeDisabled();
    expect(submit).not.toHaveBeenCalled();
  });
});
