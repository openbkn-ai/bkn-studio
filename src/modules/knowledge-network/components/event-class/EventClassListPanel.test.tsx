/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnEventType } from "@/modules/knowledge-network/types/event-type";

const mocks = vi.hoisted(() => {
  const noState: unknown = null;
  return {
    check: vi.fn(),
    confirm: vi.fn(),
    deleteEventType: vi.fn(),
    error: vi.fn(),
    listChecks: vi.fn(),
    listEventTypes: vi.fn(),
    listObjectTypes: vi.fn(),
    location: {
      pathname: "/knowledge-network/workspace/network-1/event-classes",
      search: "",
      state: noState,
    },
    navigate: vi.fn(),
    success: vi.fn(),
    versioned: false,
    versionView: "running",
  };
});

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: mocks.error, success: mocks.success, warning: vi.fn() },
    modal: { confirm: mocks.confirm, error: vi.fn() },
  }),
}));

vi.mock("@/modules/knowledge-network/hooks/useKnVersionView", () => ({
  useKnVersioned: () => mocks.versioned,
  useKnVersionView: () => [mocks.versionView, vi.fn()] as const,
}));

vi.mock("@/modules/knowledge-network/services/event-type.service", () => ({
  checkKnEventType: mocks.check,
  deleteKnEventType: mocks.deleteEventType,
  describeKnEventError: (error: unknown) => (error instanceof Error ? error.message : ""),
  listKnEventRuleChecks: mocks.listChecks,
  listKnEventTypes: mocks.listEventTypes,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  listKnowledgeNetworkObjectTypes: mocks.listObjectTypes,
}));

vi.mock("@/modules/knowledge-network/components/event-class/EventClassFormDrawer", () => ({
  EventClassFormDrawer: ({ eventType, open }: { eventType?: KnEventType; open: boolean }) =>
    open ? <div data-testid="event-class-form">{eventType?.code ?? "new"}</div> : null,
}));

import { EventClassListPanel } from "./EventClassListPanel";

const PREFIX = "knowledgeNetwork.eventClasses";

const overdue: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order_overdue",
  name: "Overdue order",
  next_check_at: 1_700_000_000_000,
  object_type_id: "order_overdue",
  recognition_action_id: "order_overdue_recognition",
  recognition_basis: "condition",
  source: "rule",
  subject: "order",
};

const complaint: KnEventType = {
  code: "complaint",
  name: "Complaint",
  object_type_id: "complaint",
  source: "report",
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
  mocks.listEventTypes.mockResolvedValue([overdue, complaint]);
  mocks.listObjectTypes.mockResolvedValue([{ id: "order", name: "Order" }]);
  mocks.listChecks.mockResolvedValue([
    { event_type: "order_overdue", hits: 4, status: "ok", time: 1_700_000_000_000 },
  ]);
  mocks.check.mockResolvedValue({ execution_id: "ex-1" });
  mocks.deleteEventType.mockResolvedValue(undefined);
  mocks.location.state = null;
  mocks.versioned = false;
  mocks.versionView = "running";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPanel = (props: { canModify?: boolean } = {}) =>
  render(
    <EventClassListPanel canDelete canModify={props.canModify ?? true} networkId="network-1" />,
  );

const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

describe("EventClassListPanel", () => {
  it("lists each class with its source, subject, basis, check time and checks", async () => {
    renderPanel();

    const row = await rowOf("Overdue order");
    expect(within(row).getByText("order_overdue")).toBeVisible();
    expect(within(row).getByText(`${PREFIX}.source.rule`)).toBeVisible();
    expect(within(row).getByRole("button", { name: "Order" })).toBeVisible();
    expect(within(row).getByText(`${PREFIX}.recognition.bases.condition`)).toBeVisible();
    expect(
      within(row).getByText(`${PREFIX}.schedule.describe.daily (Asia/Shanghai)`),
    ).toBeVisible();
    expect(within(row).getByText(new RegExp(`${PREFIX}.recognition.lastCheckOk`))).toBeVisible();

    // A reported class is not checked: nothing to show for its rule.
    const reported = await rowOf("Complaint");
    expect(within(reported).getByText(`${PREFIX}.source.report`)).toBeVisible();
    expect(within(reported).queryByText(`${PREFIX}.recognition.checkNow`)).toBeNull();
  });

  it("opens the subject's object type", async () => {
    renderPanel();

    fireEvent.click(within(await rowOf("Overdue order")).getByRole("button", { name: "Order" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/object-types/order/detail",
    );
  });

  it("opens a class's detail from its name, and its events from the hits of the last check", async () => {
    renderPanel();

    const row = await rowOf("Overdue order");
    fireEvent.click(within(row).getByText("Overdue order"));
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      "/knowledge-network/workspace/network-1/object-types/order_overdue/detail",
      { state: { knowledgeNetworkReturnTo: expect.stringContaining("/") as unknown } },
    );

    fireEvent.click(within(row).getByText(new RegExp(`${PREFIX}.recognition.lastCheckOk`)));
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      "/knowledge-network/workspace/network-1/object-types/order_overdue/detail?tab=data",
      { state: { knowledgeNetworkReturnTo: expect.stringContaining("/") as unknown } },
    );
  });

  it("checks a rule class now and reads the last checks again", async () => {
    renderPanel();

    fireEvent.click(
      within(await rowOf("Overdue order")).getByRole("button", {
        name: `${PREFIX}.recognition.checkNow`,
      }),
    );

    await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledWith("network-1", "order_overdue"));
    expect(mocks.success).toHaveBeenCalledWith(`${PREFIX}.recognition.checkStarted`);
    await vi.waitFor(() => expect(mocks.listChecks).toHaveBeenCalledTimes(2));
  });

  it("says why a check now could not start", async () => {
    mocks.check.mockRejectedValue(new Error("the class has no schedule yet"));
    renderPanel();

    fireEvent.click(
      within(await rowOf("Overdue order")).getByRole("button", {
        name: `${PREFIX}.recognition.checkNow`,
      }),
    );

    await vi.waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("the class has no schedule yet"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("creates and edits classes in its form", async () => {
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: /eventClasses\.create/ }));
    expect(screen.getByTestId("event-class-form")).toHaveTextContent("new");

    fireEvent.click(
      within(await rowOf("Overdue order")).getByRole("button", { name: "common.edit" }),
    );
    expect(screen.getByTestId("event-class-form")).toHaveTextContent("order_overdue");
  });

  it("deletes a class after asking", async () => {
    renderPanel();

    fireEvent.click(
      within(await rowOf("Overdue order")).getByRole("button", { name: "common.delete" }),
    );
    const confirmation = mocks.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await confirmation.onOk();

    expect(mocks.deleteEventType).toHaveBeenCalledWith("network-1", "order_overdue");
    await vi.waitFor(() => expect(mocks.listEventTypes).toHaveBeenCalledTimes(2));
  });

  it("offers no writes on the running version of a versioned network", async () => {
    mocks.versioned = true;
    renderPanel();

    const row = await rowOf("Overdue order");
    expect(within(row).queryByRole("button", { name: "common.edit" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "common.delete" })).toBeNull();
    expect(
      within(row).queryByRole("button", { name: `${PREFIX}.recognition.checkNow` }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /eventClasses\.create/ })).toBeNull();
  });

  it("opens the edit another page asked for, once", async () => {
    mocks.location.state = { eventClassIntent: { action: "edit", code: "order_overdue" } };
    renderPanel();

    expect(await screen.findByTestId("event-class-form")).toHaveTextContent("order_overdue");
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/knowledge-network/workspace/network-1/event-classes",
      { replace: true, state: null },
    );
  });

  it("asks to delete the class another page sent here", async () => {
    mocks.location.state = { eventClassIntent: { action: "delete", code: "order_overdue" } };
    renderPanel();

    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEventType).not.toHaveBeenCalled();
  });

  it("shows only the class another page asked to see", async () => {
    mocks.location.state = { eventClassIntent: { action: "view", code: "complaint" } };
    renderPanel();

    expect(await screen.findByDisplayValue("complaint")).toBeVisible();
    expect(await screen.findByText("Complaint")).toBeVisible();
    expect(screen.queryByText("Overdue order")).toBeNull();
  });
});
