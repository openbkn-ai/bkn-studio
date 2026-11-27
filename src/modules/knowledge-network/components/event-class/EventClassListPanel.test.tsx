/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  localStorage.removeItem("bkn-knowledge-network-list-page-size:event-classes");
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
    <MemoryRouter>
      <EventClassListPanel canDelete canModify={props.canModify ?? true} networkId="network-1" />
    </MemoryRouter>,
  );

const pageFixtures = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    ...complaint,
    code: `event_${index + 1}`,
    name: `Event ${index + 1}`,
    object_type_id: `event_${index + 1}`,
  }));

const rowOf = async (name: string) => (await screen.findByText(name)).closest("tr") as HTMLElement;

async function openActions(name: string) {
  fireEvent.click(within(await rowOf(name)).getByRole("button", { name: "common.actions" }));
  return within(await screen.findByRole("menu"));
}

describe("EventClassListPanel", () => {
  it("paginates the loaded classes and returns to the first page when searching", async () => {
    mocks.listEventTypes.mockResolvedValue(pageFixtures(25));
    renderPanel();

    expect(await screen.findByText("Event 1")).toBeVisible();
    expect(screen.queryByText("Event 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("2"));
    expect(screen.getByText("Event 11")).toBeVisible();
    expect(screen.queryByText("Event 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: `${PREFIX}.list.searchPlaceholder` }), {
      target: { value: "event_" },
    });
    expect(screen.getByText("Event 1")).toBeVisible();
    expect(screen.queryByText("Event 11")).not.toBeInTheDocument();
    expect(mocks.listEventTypes).toHaveBeenCalledTimes(1);
  });

  it("allows changing the page size and remembers the selection", async () => {
    mocks.listEventTypes.mockResolvedValue(pageFixtures(25));
    renderPanel();

    await screen.findByText("Event 1");
    fireEvent.click(screen.getByTitle("2"));
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByText("20 / page"));

    expect(screen.getByText("Event 1")).toBeVisible();
    expect(screen.getByText("Event 20")).toBeVisible();
    expect(screen.queryByText("Event 21")).not.toBeInTheDocument();
    expect(localStorage.getItem("bkn-knowledge-network-list-page-size:event-classes")).toBe("20");
  });

  it("returns to the last available page when deleting its last row", async () => {
    mocks.listEventTypes
      .mockResolvedValueOnce(pageFixtures(11))
      .mockResolvedValueOnce(pageFixtures(10));
    renderPanel();

    await screen.findByText("Event 1");
    fireEvent.click(screen.getByTitle("2"));
    fireEvent.click(
      (await openActions("Event 11")).getByRole("menuitem", { name: "common.delete" }),
    );
    const confirmation = mocks.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await confirmation.onOk();

    expect(await screen.findByText("Event 10")).toBeVisible();
    expect(screen.queryByText("Event 11")).not.toBeInTheDocument();
  });

  it("lists each class with its source, subject, basis, check time and checks", async () => {
    renderPanel();

    const row = await rowOf("Overdue order");
    expect(within(row).queryByText("order_overdue")).not.toBeInTheDocument();
    const name = within(row).getByRole("button", { name: "Overdue order" });
    expect(name).toHaveAttribute("title", "Overdue order");
    expect(name.querySelector("svg")).toBeNull();
    expect(within(row).getByText(`${PREFIX}.source.rule`)).toBeVisible();
    expect(within(row).getByRole("button", { name: "Order" })).toBeVisible();
    expect(within(row).getByText(`${PREFIX}.recognition.bases.condition`)).toBeVisible();
    expect(
      within(row).getByText(`${PREFIX}.schedule.describe.daily (Asia/Shanghai)`),
    ).toBeVisible();
    const result = within(row).getByText(`${PREFIX}.list.lastCheckHits`);
    expect(result).toBeVisible();
    expect(result.parentElement?.firstElementChild).toBe(result);
    expect(result.nextElementSibling).toHaveTextContent(/\d{4}-\d{2}-\d{2}/);

    // A reported class is not checked: nothing to show for its rule.
    const reported = await rowOf("Complaint");
    expect(within(reported).getByText(`${PREFIX}.source.report`)).toBeVisible();
    const actions = await openActions("Complaint");
    expect(actions.getByRole("menuitem", { name: "common.detail" })).toBeVisible();
    expect(actions.queryByRole("menuitem", { name: `${PREFIX}.recognition.checkNow` })).toBeNull();
  });

  it("distinguishes failed, unmatched, and not-yet-run checks", async () => {
    mocks.listEventTypes.mockResolvedValue([
      overdue,
      { ...overdue, code: "new_check", name: "New rule" },
      { ...overdue, code: "no_hits", name: "No hits rule" },
    ]);
    mocks.listChecks.mockResolvedValue([
      { event_type: "order_overdue", status: "unknown", time: 1_700_000_000_000 },
      { event_type: "no_hits", status: "ok", hits: 0, time: 1_700_000_000_000 },
    ]);
    renderPanel();

    expect(
      within(await rowOf("Overdue order")).getByText(`${PREFIX}.list.lastCheckFailed`),
    ).toBeVisible();
    expect(
      within(await rowOf("New rule")).getByText(`${PREFIX}.recognition.neverChecked`),
    ).toBeVisible();
    const noHits = within(await rowOf("No hits rule")).getByText(`${PREFIX}.list.lastCheckNoHits`);
    expect(noHits).toBeVisible();
    expect(noHits.closest("a")).toBeNull();
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

    fireEvent.click(within(row).getByText(`${PREFIX}.list.lastCheckHits`));
    expect(mocks.navigate).toHaveBeenLastCalledWith(
      "/knowledge-network/workspace/network-1/object-types/order_overdue/detail?tab=data",
      { state: { knowledgeNetworkReturnTo: expect.stringContaining("/") as unknown } },
    );
  });

  it("checks a rule class now and reads the last checks again", async () => {
    renderPanel();

    fireEvent.click(
      (await openActions("Overdue order")).getByRole("menuitem", {
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
      (await openActions("Overdue order")).getByRole("menuitem", {
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

    fireEvent.click(await screen.findByRole("button", { name: "common.create" }));
    expect(screen.getByTestId("event-class-form")).toHaveTextContent("new");

    fireEvent.click(
      (await openActions("Overdue order")).getByRole("menuitem", { name: "common.edit" }),
    );
    expect(screen.getByTestId("event-class-form")).toHaveTextContent("order_overdue");
  });

  it("deletes a class after asking", async () => {
    renderPanel();

    fireEvent.click(
      (await openActions("Overdue order")).getByRole("menuitem", { name: "common.delete" }),
    );
    const confirmation = mocks.confirm.mock.calls[0]?.[0] as { onOk: () => Promise<void> };
    await confirmation.onOk();

    expect(mocks.deleteEventType).toHaveBeenCalledWith("network-1", "order_overdue");
    await vi.waitFor(() => expect(mocks.listEventTypes).toHaveBeenCalledTimes(2));
  });

  it("offers no writes on the running version of a versioned network", async () => {
    mocks.versioned = true;
    renderPanel();

    const actions = await openActions("Overdue order");
    expect(actions.getByRole("menuitem", { name: "common.detail" })).toBeVisible();
    expect(actions.queryByRole("menuitem", { name: "common.edit" })).toBeNull();
    expect(actions.queryByRole("menuitem", { name: "common.delete" })).toBeNull();
    expect(actions.queryByRole("menuitem", { name: `${PREFIX}.recognition.checkNow` })).toBeNull();
    expect(screen.queryByRole("button", { name: "common.create" })).toBeNull();
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
