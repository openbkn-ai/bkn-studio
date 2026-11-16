/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  listObjectTypes: vi.fn(),
  listRuleTools: vi.fn(),
  success: vi.fn(),
  update: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: mocks.success, warning: mocks.warning },
  }),
}));

vi.mock("@/modules/knowledge-network/services/event-type.service", () => ({
  createKnEventType: mocks.create,
  eventClassIdOf: (code: string) => code.replace(/\./g, "_"),
  listKnEventRuleTools: mocks.listRuleTools,
  updateKnEventType: mocks.update,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypes: mocks.listObjectTypes,
}));

import { EventClassFormDrawer } from "./EventClassFormDrawer";

const overdue: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order.overdue",
  merge_hours: 0,
  name: "Overdue order",
  object_type_id: "order_overdue",
  rule: {},
  rule_tool: {
    box_id: "box-1",
    parameters: { days: 3, today: { check_time: "date" } },
    tool_id: "tool-1",
  },
  rule_version: "",
  severity: "P2",
  source: "rule",
  subject: "order",
};

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
  mocks.listObjectTypes.mockResolvedValue([{ id: "order", name: "Order" }]);
  mocks.listRuleTools.mockResolvedValue([
    {
      boxId: "box-1",
      boxName: "Order rules",
      parameters: [
        { name: "today", required: true, type: "string" },
        { name: "days", type: "integer" },
      ],
      toolId: "tool-1",
      toolName: "Overdue orders",
    },
  ]);
  // The platform answers with the saved type, its event class included.
  mocks.create.mockImplementation((_networkId: string, body: { code: string }) =>
    Promise.resolve({ ...body, object_type_id: body.code.replace(/\./g, "_") }),
  );
  mocks.update.mockImplementation((_networkId: string, code: string, body: object) =>
    Promise.resolve({ ...body, code, object_type_id: code.replace(/\./g, "_") }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDrawer = (eventType?: KnEventType) => {
  const onSaved = vi.fn();
  render(
    <EventClassFormDrawer
      eventClassIds={new Set(["order_overdue"])}
      eventType={eventType}
      networkId="network-1"
      onClose={vi.fn()}
      onSaved={onSaved}
      open
      versioned={false}
    />,
  );
  return onSaved;
};

describe("EventClassFormDrawer", () => {
  it("keeps the rule tool, its arguments and the schedule when an edit changes nothing else", async () => {
    const onSaved = renderDrawer(overdue);
    await vi.waitFor(() => expect(mocks.listRuleTools).toHaveBeenCalledWith("network-1"));
    expect(await screen.findByText("knowledgeNetwork.eventClasses.form.parameters")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith("network-1", "order.overdue", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      merge_hours: 0,
      name: "Overdue order",
      rule: {},
      rule_tool: {
        box_id: "box-1",
        parameters: { days: 3, today: { check_time: "date" } },
        tool_id: "tool-1",
      },
      rule_version: "",
      severity: "P2",
      subject: "order",
    });
  });

  it("saves a type the applications checked without a tool, so the platform still leaves it alone", async () => {
    const legacy: KnEventType = {
      ...overdue,
      check_schedule: null,
      rule: { kind: "threshold" },
      rule_tool: null,
      rule_version: "v1",
    };
    const onSaved = renderDrawer(legacy);
    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.legacyRuleHint"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order.overdue",
      expect.objectContaining({
        check_schedule: null,
        rule: { kind: "threshold" },
        rule_tool: null,
        rule_version: "v1",
      }),
    );
  });

  it("creates a reported event class with no rule tool and no schedule", async () => {
    const onSaved = renderDrawer();

    fireEvent.change(
      screen.getByPlaceholderText("knowledgeNetwork.eventClasses.form.namePlaceholder"),
      { target: { value: " Quality complaint " } },
    );
    fireEvent.change(screen.getByPlaceholderText("order_overdue"), {
      target: { value: "quality.complaint" },
    });
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.eventClasses.source.report"));
    expect(await screen.findByText("knowledgeNetwork.eventClasses.form.mergeHours")).toBeVisible();
    expect(screen.getByText("knowledgeNetwork.eventClasses.form.codeClassId")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith("network-1", {
      check_schedule: null,
      code: "quality.complaint",
      merge_hours: 0,
      name: "Quality complaint",
      rule: {},
      rule_tool: null,
      rule_version: undefined,
      severity: "",
      source: "report",
      subject: "",
    });
    expect(mocks.success).toHaveBeenCalledWith("common.success");
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it("does not claim a class was made when the platform saved the type without one", async () => {
    // An event module from before event classes answers without object_type_id.
    mocks.create.mockImplementation((_networkId: string, body: object) => Promise.resolve(body));
    const onSaved = renderDrawer();

    fireEvent.change(
      screen.getByPlaceholderText("knowledgeNetwork.eventClasses.form.namePlaceholder"),
      { target: { value: "Quality complaint" } },
    );
    fireEvent.change(screen.getByPlaceholderText("order_overdue"), {
      target: { value: "quality.complaint" },
    });
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.eventClasses.source.report"));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.warning).toHaveBeenCalledWith("knowledgeNetwork.eventClasses.savedWithoutClass");
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("does not create a rule event class without a rule tool", async () => {
    renderDrawer();

    fireEvent.change(
      screen.getByPlaceholderText("knowledgeNetwork.eventClasses.form.namePlaceholder"),
      { target: { value: "Low stock" } },
    );
    fireEvent.change(screen.getByPlaceholderText("order_overdue"), {
      target: { value: "stock.low" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.ruleToolRequired"),
    ).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
