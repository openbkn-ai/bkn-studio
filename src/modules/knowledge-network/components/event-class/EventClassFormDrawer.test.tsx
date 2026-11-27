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
  listHandling: vi.fn(),
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
  describeKnEventError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  listKnEventHandlingCandidates: mocks.listHandling,
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
  mocks.listHandling.mockResolvedValue([
    { id: "notify_buyer", inputs: [], name: "Notify buyer" },
    { id: "refund", inputs: [{ comment: "Why", name: "reason", type: "string" }], name: "Refund" },
  ]);
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
  it("opens on conditions and groups the schedule under the recognition rule", async () => {
    renderDrawer(undefined, "order");

    expect(await screen.findByRole("tab", { selected: true })).toHaveTextContent(
      `${PREFIX}.basisTabs.condition`,
    );
    // A Cypher query is written as a function of the network, not here.
    expect(screen.getAllByRole("tab").map((node) => node.textContent)).toEqual([
      `${PREFIX}.basisTabs.condition`,
      `${PREFIX}.basisTabs.function`,
    ]);
    for (const [basis, hint] of [
      ["condition", "conditionHint"],
      ["function", "ruleToolHint"],
    ] as const) {
      const icon = tab(basis).querySelector(".anticon-question-circle");
      expect(icon).toBeVisible();
      fireEvent.mouseEnter(icon!);
      expect(await screen.findByRole("tooltip", { name: `${PREFIX}.${hint}` })).toBeVisible();
      fireEvent.mouseLeave(icon!);
    }
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      `${PREFIX}.sectionBasics`,
      `${PREFIX}.sectionRule`,
      `${PREFIX}.sectionHandling`,
    ]);
    const rule = within(screen.getByRole("region", { name: `${PREFIX}.sectionRule` }));
    expect(rule.getByRole("combobox", { name: `${PREFIX}.scheduleKind` })).toBeInTheDocument();
    expect(
      rule.getByRole("combobox", { name: "knowledgeNetwork.eventClasses.schedule.timezone" }),
    ).toBeInTheDocument();
    for (const hint of [`${PREFIX}.whenHint`, `${PREFIX}.trialHint`]) {
      expect(rule.queryByText(hint)).not.toBeInTheDocument();
      const help = rule.getByRole("button", { name: hint });
      fireEvent.focus(help);
      expect(await screen.findByText(hint)).toBeVisible();
      fireEvent.blur(help);
    }
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
      handling_action: null,
      handling_note: "",
      merge_hours: 0,
      name: "Overdue order",
      rule: functionRule,
      severity: "P2",
      subject: "order",
    });
  });

  it("keeps a fixed rate the form cannot show until the check time is changed", async () => {
    const rated: KnEventType = {
      ...overdue,
      check_schedule: { cron: "", rate: "90m", timezone: "Asia/Shanghai" },
    };
    const onSaved = renderDrawer(rated);
    expect(await screen.findByText(`${PREFIX}.keptRate`)).toBeVisible();
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenLastCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        check_schedule: { cron: "", rate: "90m", timezone: "Asia/Shanghai" },
      }),
    );

    // Picking another frequency replaces the rate with the cron of the new one.
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.scheduleKind` }));
    fireEvent.click(
      await screen.findByTitle("knowledgeNetwork.eventClasses.schedule.kinds.minutes"),
    );
    expect(screen.queryByText(`${PREFIX}.keptRate`)).toBeNull();
    save();

    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenLastCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        check_schedule: { cron: "*/15 * * * *", timezone: "Asia/Shanghai" },
      }),
    );
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

  it("shows a rule saved as a Cypher query read-only and saves it back as it was", async () => {
    const onSaved = renderDrawer(withRule(cypherRule));

    expect(tab("cypher")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(`${PREFIX}.cypherReadOnly`)).toBeVisible();
    expect(
      screen.getByText("MATCH (o:order) WHERE o.status = $status RETURN o.id AS key"),
    ).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /cypher/i })).toBeNull();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ rule: cypherRule }),
    );
  });

  it("replaces a Cypher query with the function chosen on the function tab", async () => {
    const onSaved = renderDrawer(withRule(cypherRule));
    fireEvent.click(tab("function"));
    await vi.waitFor(() => expect(mocks.listRuleTools).toHaveBeenCalledWith("network-1"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.ruleTool` }));
    fireEvent.click(await screen.findByText("Overdue orders"));
    fireEvent.change(await screen.findByLabelText("today"), { target: { value: "2026-11-25" } });

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        rule: {
          basis: "function",
          tool: { box_id: "box-1", parameters: { today: "2026-11-25" }, tool_id: "tool-1" },
        },
      }),
    );
  });

  it("opens the function pages beside the drawer, and reads the functions again", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    vi.stubGlobal("__BKN_STUDIO_RUNTIME__", { router: { basename: "/custom-studio" } });
    try {
      renderDrawer(overdue);
      await vi.waitFor(() => expect(mocks.listRuleTools).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole("button", { name: new RegExp(`${PREFIX}\\.newFunction$`) }));
      expect(open).toHaveBeenLastCalledWith(
        "/custom-studio/knowledge-network/workspace/network-1/experience/cypher",
        "_blank",
        "noopener,noreferrer",
      );
      fireEvent.click(
        await screen.findByRole("button", { name: new RegExp(`${PREFIX}\\.editFunction$`) }),
      );
      expect(open).toHaveBeenLastCalledWith(
        "/custom-studio/execution-factory/toolboxes/box-1/tools/tool-1/edit",
        "_blank",
        "noopener,noreferrer",
      );

      fireEvent.click(screen.getByRole("button", { name: `${PREFIX}.reloadFunctions` }));
      await vi.waitFor(() => expect(mocks.listRuleTools).toHaveBeenCalledTimes(2));
    } finally {
      vi.unstubAllGlobals();
      open.mockRestore();
    }
  });

  it("says why the platform refused a save, and keeps the drawer open", async () => {
    mocks.update.mockRejectedValue(new Error("the code is taken"));
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();

    save();

    expect(await screen.findByText(`${PREFIX}.saveFailed`)).toBeVisible();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("tries the unsaved rule, lists its hits, and marks them stale once the rule changes", async () => {
    renderDrawer(withRule(conditionRule));
    await screen.findByDisplayValue("open");

    fireEvent.click(screen.getByRole("button", { name: `${PREFIX}.trial` }));

    const result = await screen.findByTestId("event-rule-trial");
    expect(mocks.trial).toHaveBeenCalledWith(
      "network-1",
      {
        check_schedule: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
        code: "order_overdue",
        name: "Overdue order",
        rule: conditionRule,
        subject: "order",
      },
      { versioned: false },
    );
    expect(within(result).getByText(`${PREFIX}.trialResult`)).toBeVisible();
    expect(within(result).getByText("PO-1024")).toBeVisible();
    expect(within(result).getByText(`${PREFIX}.trialRowFilter`)).toBeVisible();
    expect(within(result).queryByText(`${PREFIX}.trialStale`)).toBeNull();
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue("open"), { target: { value: "closed" } });

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
    expect(screen.queryByRole("region", { name: `${PREFIX}.sectionRule` })).toBeNull();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith("network-1", {
      check_schedule: null,
      code: "quality_complaint",
      handling_action: null,
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

  it("hands the events to an action type on the subject, run automatically by default", async () => {
    const onSaved = renderDrawer(overdue);
    await vi.waitFor(() => expect(mocks.listHandling).toHaveBeenCalledWith("network-1", "order"));
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.handlingAction` }));
    fireEvent.click(await screen.findByText("Notify buyer"));
    expect(await screen.findByText(`${PREFIX}.handlingModeAuto`)).toBeVisible();
    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        handling_action: { action_type_id: "notify_buyer", mode: "auto" },
      }),
    );
  });

  it("runs an action type that asks for input by itself once the class gives each input", async () => {
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.handlingAction` }));
    // The options say which action types ask for input.
    expect(await screen.findByText(`${PREFIX}.handlingActionInputs`)).toBeVisible();
    fireEvent.click(await screen.findByText("Refund"));
    expect(await screen.findByText(`${PREFIX}.handlingParameters`)).toBeVisible();
    expect(screen.getByText("Why")).toBeVisible();

    save();

    expect(await screen.findByText(`${PREFIX}.handlingParameterRequired`)).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: `${PREFIX}.handlingParameterValue` }), {
      target: { value: " late " },
    });
    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        handling_action: {
          action_type_id: "refund",
          mode: "auto",
          parameters: { reason: { value: "late", value_from: "const" } },
        },
      }),
    );
  });

  it("gives an input a property of the event's object", async () => {
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.handlingAction` }));
    fireEvent.click(await screen.findByText("Refund"));
    fireEvent.mouseDown(
      await screen.findByRole("combobox", { name: `${PREFIX}.handlingParameterFrom` }),
    );
    fireEvent.click(await screen.findByText(`${PREFIX}.handlingParameterProperty`));
    fireEvent.mouseDown(
      await screen.findByRole("combobox", { name: `${PREFIX}.handlingParameterValue` }),
    );
    fireEvent.click(await screen.findByTitle("status"));

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        handling_action: {
          action_type_id: "refund",
          mode: "auto",
          parameters: { reason: { value: "status", value_from: "property" } },
        },
      }),
    );
  });

  it("suggests an action type with its inputs left to the person", async () => {
    const onSaved = renderDrawer(overdue);
    expect(await screen.findByText(`${PREFIX}.parameters`)).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.handlingAction` }));
    fireEvent.click(await screen.findByText("Refund"));
    fireEvent.click(await screen.findByText(`${PREFIX}.handlingModeSuggest`));

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({ handling_action: { action_type_id: "refund", mode: "suggest" } }),
    );
  });

  it("keeps the inputs a class gives its handling action", async () => {
    const onSaved = renderDrawer({
      ...overdue,
      handling_action: {
        action_type_id: "refund",
        mode: "auto",
        parameters: { reason: { value: "status", value_from: "property" } },
      },
    });
    expect(
      await screen.findByRole("combobox", { name: `${PREFIX}.handlingParameterValue` }),
    ).toBeVisible();
    expect(screen.getByTitle("status")).toBeVisible();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.update).toHaveBeenCalledWith(
      "network-1",
      "order_overdue",
      expect.objectContaining({
        handling_action: {
          action_type_id: "refund",
          mode: "auto",
          parameters: { reason: { value: "status", value_from: "property" } },
        },
      }),
    );
  });

  it("only suggests the handling action of a reported class", async () => {
    const onSaved = renderDrawer(undefined, "order");
    fillNewClass("Quality complaint", "quality_complaint");
    fireEvent.click(screen.getByLabelText("knowledgeNetwork.eventClasses.source.report"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: `${PREFIX}.handlingAction` }));
    fireEvent.click(await screen.findByText("Notify buyer"));
    expect(screen.getByRole("radio", { name: `${PREFIX}.handlingModeAuto` })).toBeDisabled();

    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(
      "network-1",
      expect.objectContaining({
        handling_action: { action_type_id: "notify_buyer", mode: "suggest" },
      }),
    );
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

    await vi.waitFor(() => expect(mocks.listObjectTypes).toHaveBeenCalled());
    // Why it is locked is in the label's tip.
    const field = screen.getByText(`${PREFIX}.subject`).closest(".ant-form-item");
    expect(within(field as HTMLElement).getByRole("combobox")).toBeDisabled();
  });

  it("does not create a rule event class without a rule", async () => {
    renderDrawer(undefined, "order");
    fillNewClass("Low stock", "stock_low");

    save();

    expect(await screen.findByText(`${PREFIX}.ruleRequired`)).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
