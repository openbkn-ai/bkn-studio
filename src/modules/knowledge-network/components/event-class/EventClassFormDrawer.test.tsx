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
  listKnEventRuleTools: mocks.listRuleTools,
  updateKnEventType: mocks.update,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypes: mocks.listObjectTypes,
}));

import { EventClassFormDrawer } from "./EventClassFormDrawer";

const overdue: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order_overdue",
  merge_hours: 0,
  name: "Overdue order",
  object_type_id: "order_overdue",
  rule_tool: {
    box_id: "box-1",
    parameters: { days: 3, today: { check_time: "date" } },
    tool_id: "tool-1",
  },
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
    Promise.resolve({ ...body, object_type_id: body.code }),
  );
  mocks.update.mockImplementation((_networkId: string, code: string, body: object) =>
    Promise.resolve({ ...body, code, object_type_id: code }),
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderDrawer = (eventType?: KnEventType, initialSubject?: string) => {
  const onSaved = vi.fn();
  render(
    <EventClassFormDrawer
      eventClassIds={new Set(["order_overdue"])}
      eventType={eventType}
      initialSubject={initialSubject}
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
    expect(mocks.update).toHaveBeenCalledWith("network-1", "order_overdue", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      handling_note: "",
      merge_hours: 0,
      name: "Overdue order",
      rule_tool: {
        box_id: "box-1",
        parameters: { days: 3, today: { check_time: "date" } },
        tool_id: "tool-1",
      },
      severity: "P2",
      subject: "order",
    });
  });

  it("saves a class that has no recognition action without a rule tool", async () => {
    const legacy: KnEventType = {
      ...overdue,
      check_schedule: null,
      rule_tool: null,
    };
    const onSaved = renderDrawer(legacy);
    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.legacyRuleHint"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        check_schedule: null,
        rule_tool: null,
      }),
    );
  });

  it("creates a reported event class with no rule tool and no schedule", async () => {
    const onSaved = renderDrawer(undefined, "order");

    fireEvent.change(
      screen.getByPlaceholderText("knowledgeNetwork.eventClasses.form.namePlaceholder"),
      { target: { value: " Quality complaint " } },
    );
    fireEvent.change(screen.getByPlaceholderText("order_overdue"), {
      target: { value: "quality_complaint" },
    });
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.eventClasses.source.report"));
    expect(await screen.findByText("knowledgeNetwork.eventClasses.form.mergeHours")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith("network-1", {
      check_schedule: null,
      code: "quality_complaint",
      handling_note: "",
      merge_hours: 0,
      name: "Quality complaint",
      rule_tool: null,
      severity: "",
      source: "report",
      subject: "order",
    });
    expect(mocks.success).toHaveBeenCalledWith("common.success");
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it("tells how many objects the trial of the recognition action found", async () => {
    mocks.update.mockImplementation((_networkId: string, code: string, body: object) =>
      Promise.resolve({ ...body, code, object_type_id: code, trial: { hits: 5, limited: true } }),
    );
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText("knowledgeNetwork.eventClasses.form.parameters")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.success).toHaveBeenCalledWith(
      "knowledgeNetwork.eventClasses.form.savedWithLimitedTrial",
    );
  });

  it("locks the subject of a class while its recognition action is bound to it", async () => {
    renderDrawer({
      ...overdue,
      recognition_action_id: "order_overdue_recognition",
      recognition_basis: "function",
    });

    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.subjectLockedHint"),
    ).toBeVisible();
  });

  it("leaves a recognition action that selects another way alone, and says so", async () => {
    const onSaved = renderDrawer({
      ...overdue,
      check_schedule: null,
      recognition_action_id: "order_overdue_recognition",
      recognition_basis: "cypher",
      rule_tool: null,
    });
    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.otherBasisHint"),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ rule_tool: null }),
    );
  });

  it("does not create a rule event class without a rule tool", async () => {
    renderDrawer(undefined, "order");

    fireEvent.change(
      screen.getByPlaceholderText("knowledgeNetwork.eventClasses.form.namePlaceholder"),
      { target: { value: "Low stock" } },
    );
    fireEvent.change(screen.getByPlaceholderText("order_overdue"), {
      target: { value: "stock_low" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(
      await screen.findByText("knowledgeNetwork.eventClasses.form.ruleToolRequired"),
    ).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
