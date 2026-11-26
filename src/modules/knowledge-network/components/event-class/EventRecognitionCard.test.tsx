/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  error: vi.fn(),
  getTool: vi.fn(),
  listChecks: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: mocks.error, success: mocks.success, warning: mocks.warning },
  }),
}));

vi.mock("@/modules/execution-factory/services/tool.service", () => ({
  getTool: mocks.getTool,
}));

vi.mock("@/modules/knowledge-network/services/event-type.service", () => ({
  checkKnEventType: mocks.check,
  describeKnEventError: (error: unknown) => (error instanceof Error ? error.message : ""),
  listKnEventRuleChecks: mocks.listChecks,
}));

import { EventRecognitionCard } from "./EventRecognitionCard";

const PREFIX = "knowledgeNetwork.eventClasses.recognition";

const overdue: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order.overdue",
  merge_hours: 0,
  name: "Overdue order",
  object_type_id: "order_overdue",
  recognition_action_id: "order_overdue_recognition",
  recognition_basis: "function",
  rule_tool: { box_id: "box-1", tool_id: "tool-1" },
  severity: "P2",
  source: "rule",
  subject: "order",
};

beforeEach(() => {
  mocks.getTool.mockResolvedValue({ name: "Overdue orders" });
  mocks.listChecks.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const checkNow = () => {
  render(
    <EventRecognitionCard
      canModify
      canQueryData
      eventType={overdue}
      networkId="network-1"
      onEdit={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText(`${PREFIX}.checkNow`));
};

describe("EventRecognitionCard check now", () => {
  it("says the check started, since the platform runs it in the background", async () => {
    mocks.check.mockResolvedValue({ execution_id: "ex-1" });
    checkNow();

    await vi.waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`${PREFIX}.checkStarted`));
    expect(mocks.check).toHaveBeenCalledWith("network-1", "order.overdue");
  });

  it("says why a check now could not start", async () => {
    mocks.check.mockRejectedValue(new Error("the class has no schedule yet"));

    checkNow();

    await vi.waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("the class has no schedule yet"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("offers no check now for a class without a recognition action", () => {
    render(
      <EventRecognitionCard
        canModify
        canQueryData
        eventType={{ ...overdue, recognition_action_id: undefined, rule_tool: null }}
        networkId="network-1"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByText(`${PREFIX}.checkNow`)).toBeNull();
  });
});

describe("EventRecognitionCard handling", () => {
  it("names the action type the events are handed to and how it runs", () => {
    render(
      <EventRecognitionCard
        canModify
        canQueryData
        eventType={{
          ...overdue,
          handling_action: { action_type_id: "notify_buyer", mode: "auto" },
        }}
        networkId="network-1"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("notify_buyer")).toBeVisible();
    expect(screen.getByText(`${PREFIX}.handlingModes.auto`)).toBeVisible();
  });

  it("shows what the class gives the inputs of its handling action", () => {
    render(
      <EventRecognitionCard
        canModify
        canQueryData
        eventType={{
          ...overdue,
          handling_action: {
            action_type_id: "refund",
            mode: "auto",
            parameters: {
              buyer: { value: "buyer_id", value_from: "property" },
              reason: { value: "late", value_from: "const" },
            },
          },
        }}
        networkId="network-1"
        onEdit={vi.fn()}
      />,
    );

    expect(screen.getByText("buyer")).toBeVisible();
    expect(screen.getByText(`${PREFIX}.handlingParameterProperty`)).toBeVisible();
    expect(screen.getByText("reason")).toBeVisible();
    expect(screen.getByText(`${PREFIX}.handlingParameterConst`)).toBeVisible();
  });
});

describe("EventRecognitionCard execution records", () => {
  it("opens the records of the recognition action and of the handling action", () => {
    const onOpenExecutions = vi.fn();
    render(
      <EventRecognitionCard
        canModify
        canQueryData
        eventType={{
          ...overdue,
          handling_action: { action_type_id: "notify_buyer", mode: "auto" },
        }}
        networkId="network-1"
        onEdit={vi.fn()}
        onOpenExecutions={onOpenExecutions}
      />,
    );

    fireEvent.click(screen.getByText(`${PREFIX}.viewExecutions`));
    fireEvent.click(screen.getByText(`${PREFIX}.handlingExecutions`));

    expect(onOpenExecutions.mock.calls).toEqual([["order_overdue_recognition"], ["notify_buyer"]]);
  });

  it("offers no records for a class without a recognition action", () => {
    render(
      <EventRecognitionCard
        canModify
        canQueryData
        eventType={{ ...overdue, recognition_action_id: undefined, rule_tool: null }}
        networkId="network-1"
        onEdit={vi.fn()}
        onOpenExecutions={vi.fn()}
      />,
    );

    expect(screen.queryByText(`${PREFIX}.viewExecutions`)).toBeNull();
  });
});
