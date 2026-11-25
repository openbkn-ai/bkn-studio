/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import type { KnEventRule, KnEventType } from "@/modules/knowledge-network/types/event-type";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getObjectType: vi.fn(),
  listObjectTypes: vi.fn(),
  listRuleTools: vi.fn(),
  success: vi.fn(),
  trial: vi.fn(),
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
  trialKnEventRule: mocks.trial,
  updateKnEventType: mocks.update,
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", () => ({
  getKnowledgeNetworkObjectTypeDetail: mocks.getObjectType,
  listKnowledgeNetworkObjectTypes: mocks.listObjectTypes,
}));

import { EventClassFormDrawer } from "./EventClassFormDrawer";

let consoleError: MockInstance<typeof console.error>;

const PREFIX = "knowledgeNetwork.eventClasses.form";

const functionRule: KnEventRule = {
  basis: "function",
  tool: {
    box_id: "box-1",
    parameters: { days: 3, today: { check_time: "date" } },
    tool_id: "tool-1",
  },
};

const conditionRule: KnEventRule = {
  basis: "condition",
  condition: {
    objectTypeId: "order",
    operation: "and",
    subConditions: [
      {
        field: "due_time",
        objectTypeId: "order",
        operation: "<",
        value: "-PT48H",
        valueFrom: "check_time",
      },
      {
        field: "status",
        objectTypeId: "order",
        operation: "==",
        value: "open",
        valueFrom: "const",
      },
    ],
    valueFrom: "const",
  },
};

const cypherRule: KnEventRule = {
  basis: "cypher",
  cypher: {
    parameters: { status: { value: "open", value_from: "const" } },
    query: "MATCH (o:order) WHERE o.status = $status RETURN o.id AS key",
  },
};

const overdue: KnEventType = {
  check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
  code: "order_overdue",
  merge_hours: 0,
  name: "Overdue order",
  object_type_id: "order_overdue",
  recognition_action_id: "order_overdue_recognition",
  recognition_basis: "function",
  rule: functionRule,
  rule_tool: functionRule.tool,
  severity: "P2",
  source: "rule",
  subject: "order",
};

const withRule = (rule: KnEventRule): KnEventType => ({
  ...overdue,
  recognition_basis: rule.basis,
  rule,
  rule_tool: rule.basis === "function" ? rule.tool : null,
});

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
  consoleError = vi.spyOn(console, "error");
  mocks.listObjectTypes.mockResolvedValue([{ id: "order", name: "Order" }]);
  mocks.getObjectType.mockResolvedValue({
    dataProperties: [
      { name: "due_time", type: "datetime" },
      { name: "status", type: "string" },
    ],
  });
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
  mocks.trial.mockResolvedValue({
    hit_count: 2,
    hits: [
      { key: "1024", name: "PO-1024" },
      { key: "1025", name: "PO-1025" },
    ],
    limited: false,
    row_filter_applied: true,
  });
});

afterEach(() => {
  cleanup();
  const addonWarnings = consoleError.mock.calls.filter((args) => {
    const message: unknown = args[0];
    return (
      typeof message === "string" &&
      message.includes("[antd: InputNumber]") &&
      /addonAfter|addonBefore/.test(message)
    );
  });
  consoleError.mockRestore();
  expect(addonWarnings).toEqual([]);

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

const tab = (basis: KnEventRule["basis"]) =>
  screen.getByRole("tab", { name: `${PREFIX}.basisTabs.${basis}` });

const save = () => fireEvent.click(screen.getByRole("button", { name: "common.save" }));

const fillNewClass = (name: string, code: string) => {
  fireEvent.change(screen.getByPlaceholderText(`${PREFIX}.namePlaceholder`), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText("order_overdue"), { target: { value: code } });
};

describe("EventClassFormDrawer", () => {
  it("opens a new class on the condition tab, with the schedule before the rule", async () => {
    renderDrawer(undefined, "order");

    expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(
      `${PREFIX}.basisTabs.condition`,
    );
    const labels = screen
      .getAllByText(new RegExp(`^${PREFIX}\\.(schedule|when|then|sectionRule|sectionHandling)$`))
      .map((node) => node.textContent);
    expect(labels).toEqual([
      `${PREFIX}.sectionRule`,
      `${PREFIX}.schedule`,
      `${PREFIX}.when`,
      `${PREFIX}.sectionHandling`,
      `${PREFIX}.then`,
    ]);
  });

  it("keeps the rule tool, its arguments and the schedule when an edit changes nothing else", async () => {
    const onSaved = renderDrawer(overdue);
    await vi.waitFor(() => expect(mocks.listRuleTools).toHaveBeenCalledWith("network-1"));
    expect(tab("function")).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith("network-1", "order_overdue", {
      check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
      handling_note: "",
      merge_hours: 0,
      name: "Overdue order",
      rule: functionRule,
      severity: "P2",
      subject: "order",
    });
  });

  it("opens a condition class on its condition and saves it back as it was", async () => {
    const onSaved = renderDrawer(withRule(conditionRule));

    expect(tab("condition")).toHaveAttribute("aria-selected", "true");
    // The row compares with the time of the check, moved two days back.
    expect(await screen.findByDisplayValue("-PT48H")).toBeVisible();
    expect(screen.getByDisplayValue("open")).toBeVisible();
    await vi.waitFor(() => expect(mocks.getObjectType).toHaveBeenCalledWith("network-1", "order"));

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
        rule: conditionRule,
      }),
    );
  });

  it("refuses an offset that is not a duration", async () => {
    renderDrawer(withRule(conditionRule));
    fireEvent.change(await screen.findByDisplayValue("-PT48H"), { target: { value: "2 days" } });

    save();

    expect(await screen.findByText(`${PREFIX}.offsetInvalid`)).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("opens a Cypher class on its query and saves it back as it was", async () => {
    const onSaved = renderDrawer(withRule(cypherRule));

    expect(tab("cypher")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByDisplayValue("MATCH (o:order) WHERE o.status = $status RETURN o.id AS key"),
    ).toBeVisible();
    expect(screen.getByDisplayValue("status")).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ rule: cypherRule }),
    );
  });

  it("creates a class that selects by a Cypher query and its parameters", async () => {
    const onSaved = renderDrawer(undefined, "order");
    fillNewClass("Open order", "order_open");
    fireEvent.click(tab("cypher"));
    fireEvent.change(screen.getByLabelText(`${PREFIX}.cypherQuery`), {
      target: { value: " MATCH (o:order) WHERE o.status = $status RETURN o.id AS key " },
    });
    fireEvent.click(screen.getByRole("button", { name: /cypherParameterAdd/ }));
    fireEvent.change(screen.getByLabelText(`${PREFIX}.cypherParameterName`), {
      target: { value: "status" },
    });
    fireEvent.change(screen.getByLabelText(`${PREFIX}.parameterValue`), {
      target: { value: "open" },
    });

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({
        check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
        code: "order_open",
        rule: {
          basis: "cypher",
          cypher: {
            parameters: { status: { value: "open", value_from: "const" } },
            query: "MATCH (o:order) WHERE o.status = $status RETURN o.id AS key",
          },
        },
        source: "rule",
      }),
    );
  });

  it("does not let a Cypher parameter take a name the platform gives", async () => {
    renderDrawer(withRule(cypherRule));
    fireEvent.change(screen.getByDisplayValue("status"), { target: { value: "check_time" } });

    save();

    expect(await screen.findByText(`${PREFIX}.cypherParameterNameInvalid`)).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("replaces the rule of any basis with the one on the chosen tab", async () => {
    const onSaved = renderDrawer(withRule(conditionRule));
    fireEvent.click(tab("cypher"));
    fireEvent.change(screen.getByLabelText(`${PREFIX}.cypherQuery`), {
      target: { value: "MATCH (o:order) RETURN o.id AS key" },
    });

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        rule: { basis: "cypher", cypher: { query: "MATCH (o:order) RETURN o.id AS key" } },
      }),
    );
  });

  it("tries the unsaved rule, lists its hits, and marks them stale once the rule changes", async () => {
    renderDrawer(withRule(cypherRule));

    fireEvent.click(screen.getByRole("button", { name: `${PREFIX}.trial` }));

    const result = await screen.findByTestId("event-rule-trial");
    expect(mocks.trial).toHaveBeenCalledWith(
      "network-1",
      {
        check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
        code: "order_overdue",
        name: "Overdue order",
        rule: cypherRule,
        subject: "order",
      },
      { versioned: false },
    );
    expect(within(result).getByText(`${PREFIX}.trialResult`)).toBeVisible();
    expect(within(result).getByText("PO-1024")).toBeVisible();
    expect(within(result).getByText(`${PREFIX}.trialRowFilter`)).toBeVisible();
    expect(within(result).queryByText(`${PREFIX}.trialStale`)).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(`${PREFIX}.cypherQuery`), {
      target: { value: "MATCH (o:order) RETURN o.id AS key" },
    });

    expect(
      within(screen.getByTestId("event-rule-trial")).getByText(`${PREFIX}.trialStale`),
    ).toBeVisible();
  });

  it("says why a trial could not run", async () => {
    mocks.trial.mockRejectedValue(
      Object.assign(new Error("refused"), {
        isAxiosError: true,
        response: { data: { error_details: "result has no key column" }, status: 400 },
      }),
    );
    renderDrawer(withRule(cypherRule));

    fireEvent.click(screen.getByRole("button", { name: `${PREFIX}.trial` }));

    expect(await screen.findByText(`${PREFIX}.trialFailed`)).toBeVisible();
  });

  it("saves a class that has no recognition action without a rule", async () => {
    const legacy: KnEventType = {
      ...overdue,
      check_schedule: null,
      recognition_action_id: undefined,
      recognition_basis: undefined,
      rule: null,
      rule_tool: null,
    };
    const onSaved = renderDrawer(legacy);
    expect(await screen.findByText(`${PREFIX}.legacyRuleHint`)).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ check_schedule: null, rule: null }),
    );
  });

  it("keeps a metric rule it cannot edit unless another rule is set", async () => {
    const onSaved = renderDrawer({
      ...overdue,
      recognition_basis: "metric",
      rule: null,
      rule_tool: null,
    });
    expect(await screen.findByText(`${PREFIX}.metricBasisHint`)).toBeVisible();
    expect(tab("condition")).toHaveAttribute("aria-selected", "true");

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ check_schedule: null, rule: null }),
    );
  });

  it("creates a reported event class with no rule and no schedule", async () => {
    const onSaved = renderDrawer(undefined, "order");
    fillNewClass(" Quality complaint ", "quality_complaint");
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.eventClasses.source.report"));
    expect(await screen.findByText(`${PREFIX}.mergeHours`)).toBeVisible();
    expect(screen.queryByText(`${PREFIX}.when`)).toBeNull();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith("network-1", {
      check_schedule: null,
      code: "quality_complaint",
      handling_note: "",
      merge_hours: 0,
      name: "Quality complaint",
      rule: null,
      severity: "",
      source: "report",
      subject: "order",
    });
    expect(mocks.success).toHaveBeenCalledWith("common.success");
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it("tells how many objects the trial of a save found", async () => {
    mocks.update.mockImplementation((_networkId: string, code: string, body: object) =>
      Promise.resolve({ ...body, code, object_type_id: code, trial: { hits: 5, limited: true } }),
    );
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.success).toHaveBeenCalledWith(`${PREFIX}.savedWithLimitedTrial`);
  });

  it("locks the subject of a class while its recognition action is bound to it", async () => {
    renderDrawer(overdue);

    expect(await screen.findByText(`${PREFIX}.subjectLockedHint`)).toBeVisible();
  });

  it("does not create a rule event class without a rule", async () => {
    renderDrawer(undefined, "order");
    fillNewClass("Low stock", "stock_low");

    save();

    expect(await screen.findByText(`${PREFIX}.ruleRequired`)).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
