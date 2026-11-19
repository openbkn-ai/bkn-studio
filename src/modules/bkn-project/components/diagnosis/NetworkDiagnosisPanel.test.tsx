/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Diagnosis, DiagnosisSuggestion } from "@/modules/bkn-project/types/diagnosis";

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  dismiss: vi.fn(),
  get: vi.fn(),
  message: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  run: vi.fn(),
  t: (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message }),
}));

vi.mock("@/modules/bkn-project/services/diagnosis.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/diagnosis.service")>()),
  applySuggestion: mocks.apply,
  dismissSuggestion: mocks.dismiss,
  getDiagnosis: mocks.get,
  runDiagnosis: mocks.run,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { NetworkDiagnosisPanel } from "./NetworkDiagnosisPanel";

const draft = mapDraft(mockDraft("p1"));
// Fields shown by their display names, as people know them.
draft.items.objectTypes
  .find((item) => item.id === "sales_orders")!
  .properties.forEach((property) => {
    if (property.name === "customer_id") property.displayName = "下单客户编码";
  });
draft.items.objectTypes
  .find((item) => item.id === "customers")!
  .properties.forEach((property) => {
    if (property.name === "customer_id") property.displayName = "客户编码";
  });

const relation: DiagnosisSuggestion = {
  apply: {
    cardinality: "many_to_one",
    description: "",
    kind: "create_relation",
    mapping: [{ sourceProperty: "customer_id", targetProperty: "customer_id" }],
    name: "下单客户",
    source: "sales_orders",
    target: "customers",
  },
  evidence: {
    hits: 572,
    nulls: 25,
    quotes: [{ documentId: "doc-1", text: "订单要能追到客户" }],
    rate: 0.716,
    rows: 799,
    sourceField: "customer_id",
    targetField: "customer_id",
  },
  group: "connect",
  id: "s-relation",
  impact: { connects: ["customers"], questions: ["q-1", "q-2"] },
  kind: "create_relation",
  rank: 1,
  reason: "大部分订单的客户编码都能在客户里找到。",
  status: "open",
  title: "销售订单 —下单客户→ 客户",
};
const identity: DiagnosisSuggestion = {
  apply: {
    candidates: [["bom_id", "line_no"]],
    kind: "choose_identity",
    objectTypeId: "material_bom",
  },
  evidence: { quotes: [] },
  group: "object",
  id: "s-identity",
  impact: { connects: ["material_bom"], questions: [] },
  kind: "choose_identity",
  rank: 2,
  reason: "只因未定标识而进不了模型。",
  status: "open",
  title: "给「物料清单」定唯一标识并采纳",
};
const writeback: DiagnosisSuggestion = {
  apply: {
    actions: [
      { kind: "add", name: "创建监测任务", parameters: ["forecast", "creator"] },
      { kind: "modify", name: "结束监测任务", parameters: ["end_way"] },
    ],
    description: "",
    kind: "writeback_object",
    name: "监测任务",
    properties: [
      { displayName: "任务编号", name: "task_no", role: "id", type: "string" },
      { displayName: "跟踪的预测单", name: "forecast", role: "tracked", type: "string" },
      { displayName: "创建时间", name: "created_at", role: "time", type: "datetime" },
      { displayName: "创建人", name: "creator", role: "actor", type: "string" },
      { displayName: "需求数量", name: "demand", role: "snapshot", type: "integer" },
      { displayName: "结束方式", name: "end_way", role: "outcome", type: "string" },
    ],
    trackedObjectTypeId: "sales_orders",
  },
  evidence: { quotes: [] },
  group: "object",
  id: "s-writeback",
  impact: { connects: [], questions: ["q-3"] },
  kind: "writeback_object",
  rank: 3,
  reason: "需求文档的业务主角。",
  status: "open",
  title: "「监测任务」建为决策跟踪对象",
};
const quality: DiagnosisSuggestion = {
  apply: null,
  evidence: { quotes: [] },
  group: "data",
  id: "s-data",
  impact: { connects: [], questions: [] },
  kind: "data_quality",
  rank: 4,
  reason: "追溯时会断链。",
  status: "open",
  title: "25 张订单没有客户",
};

const ready = (overrides: Partial<Diagnosis> = {}): Diagnosis => ({
  components: [["sales_orders", "customers"], ["material_bom"]],
  computedAt: 1,
  draftUpdateTime: draft.updateTime,
  error: "",
  metrics: {
    connectivity: { components: 6, largest: 9, objects: 16 },
    pendingConcepts: 8,
    reachability: { reachable: 15, total: 21 },
    references: { covered: 5, total: 11 },
  },
  runId: "r1",
  stale: false,
  state: "ready",
  suggestions: [relation, identity, writeback, quality],
  ...overrides,
});

const refusal = (code: string, status = 409) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

function renderPanel(props: { editable?: boolean; ownerIsCaller?: boolean } = {}) {
  const handlers = {
    onChooseIdentity: vi.fn().mockReturnValue(true),
    onClose: vi.fn(),
    onDiagnosis: vi.fn(),
    onDraftChanged: vi.fn().mockResolvedValue(undefined),
    onPreview: vi.fn(),
  };
  renderWithoutAntdStyles(
    <NetworkDiagnosisPanel
      draft={draft}
      editable={props.editable ?? true}
      ownerIsCaller={props.ownerIsCaller ?? true}
      projectId="p1"
      {...handlers}
    />,
  );
  return handlers;
}

const card = async (title: string) => screen.findByRole("article", { name: title });

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

describe("NetworkDiagnosisPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue(ready());
    mocks.run.mockResolvedValue({ runId: "r2" });
    mocks.apply.mockImplementation((_p: string, id: string, time: number) =>
      Promise.resolve({
        draftUpdateTime: time + 1,
        suggestion: { ...relation, id, status: "applied" },
      }),
    );
    mocks.dismiss.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers the owner a first diagnosis when there was none", async () => {
    mocks.get.mockResolvedValue(null);
    mocks.get.mockResolvedValueOnce(null);
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "bknProject.diagnosis.start" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("bknProject.diagnosis.running")).toBeInTheDocument();
  });

  it("tells others only the owner runs it", async () => {
    mocks.get.mockResolvedValue(null);
    renderPanel({ ownerIsCaller: false });
    expect(await screen.findByText("bknProject.diagnosis.ownerOnly")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bknProject.diagnosis.start" })).toBeNull();
  });

  it("reads a running diagnosis again until it is ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.get.mockResolvedValueOnce(ready({ metrics: null, state: "running", suggestions: [] }));
    renderPanel();
    expect(await screen.findByText("bknProject.diagnosis.running")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(await card(relation.title)).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("follows a diagnosis someone else started", async () => {
    mocks.get.mockResolvedValueOnce(null);
    mocks.get.mockResolvedValueOnce(ready({ metrics: null, state: "running", suggestions: [] }));
    mocks.run.mockRejectedValue(refusal("Diagnosis.Running"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "bknProject.diagnosis.start" }));
    expect(await screen.findByText("bknProject.diagnosis.running")).toBeInTheDocument();
  });

  it("shows the four measures and the ranked suggestions with their evidence", async () => {
    const handlers = renderPanel();
    const first = await card(relation.title);
    expect(screen.getByText("56%")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(
      screen.getByText('bknProject.diagnosis.metrics.reachabilityDetail:{"missing":6,"total":21}'),
    ).toBeInTheDocument();
    // Business wording: display names, counted rows and the document's words; no ids.
    expect(
      within(first).getByText(
        'bknProject.diagnosis.evidence.fields:{"source":"下单客户编码","target":"客户编码"}' +
          'bknProject.diagnosis.evidence.match:{"hits":572,"rate":72,"rows":799}',
      ),
    ).toBeInTheDocument();
    expect(
      within(first).getByText('bknProject.diagnosis.evidence.nulls:{"count":25}'),
    ).toBeInTheDocument();
    expect(
      within(first).getByText('bknProject.diagnosis.evidence.quote:{"text":"订单要能追到客户"}'),
    ).toBeInTheDocument();
    expect(within(first).getByText(/impact\.connects:\{"names":"customers"\}/)).toBeInTheDocument();
    expect(first.textContent).not.toContain("q-1");
    // Tabs count the open suggestions of each group.
    expect(screen.getByText('bknProject.diagnosis.tabs.object:{"count":2}')).toBeInTheDocument();
    fireEvent.click(screen.getByText('bknProject.diagnosis.tabs.data:{"count":1}'));
    expect(screen.queryByRole("article", { name: relation.title })).toBeNull();
    expect(await card(quality.title)).toBeInTheDocument();
    // The islands go to the graph.
    expect(handlers.onDiagnosis).toHaveBeenLastCalledWith(expect.objectContaining({ runId: "r1" }));
  });

  it("previews a suggestion on the graph while it is pointed at", async () => {
    const handlers = renderPanel();
    const first = await card(relation.title);
    fireEvent.mouseEnter(first);
    expect(handlers.onPreview).toHaveBeenLastCalledWith(relation);
    fireEvent.mouseLeave(first);
    expect(handlers.onPreview).toHaveBeenLastCalledWith(null);
  });

  it("applies a suggestion to the draft as read and reads the draft again", async () => {
    const handlers = renderPanel();
    const first = await card(relation.title);
    fireEvent.click(
      within(first).getByRole("button", { name: "bknProject.diagnosis.actions.apply" }),
    );
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith("p1", "s-relation", draft.updateTime),
    );
    await waitFor(() => expect(handlers.onDraftChanged).toHaveBeenCalled());
    expect(await within(first).findByText("bknProject.diagnosis.applied")).toBeInTheDocument();
    expect(
      within(first).queryByRole("button", { name: "bknProject.diagnosis.actions.apply" }),
    ).toBeNull();
  });

  it("says a suggestion no longer holds when the draft moved on", async () => {
    mocks.apply.mockRejectedValue(refusal("Diagnosis.SuggestionStale"));
    renderPanel();
    const first = await card(relation.title);
    fireEvent.click(
      within(first).getByRole("button", { name: "bknProject.diagnosis.actions.apply" }),
    );
    await waitFor(() =>
      expect(mocks.message.warning).toHaveBeenCalledWith(
        "bknProject.diagnosis.errors.suggestionStale",
      ),
    );
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it("reads the draft again when someone else changed it", async () => {
    mocks.apply.mockRejectedValue(refusal("Draft.Stale"));
    const handlers = renderPanel();
    const first = await card(relation.title);
    fireEvent.click(
      within(first).getByRole("button", { name: "bknProject.diagnosis.actions.apply" }),
    );
    await waitFor(() =>
      expect(mocks.message.warning).toHaveBeenCalledWith("bknProject.diagnosis.errors.draftStale"),
    );
    expect(handlers.onDraftChanged).toHaveBeenCalled();
  });

  it("opens the identity chooser for a suggested identity instead of applying it", async () => {
    const handlers = renderPanel();
    const second = await card(identity.title);
    fireEvent.click(
      within(second).getByRole("button", { name: "bknProject.diagnosis.actions.chooseIdentity" }),
    );
    expect(handlers.onChooseIdentity).toHaveBeenCalledWith("material_bom", [["bom_id", "line_no"]]);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("shows a write-back object's drafted properties by role and its actions", async () => {
    renderPanel();
    const third = await card(writeback.title);
    const rows = within(third)
      .getAllByRole("row")
      .map((row) => row.textContent);
    expect(rows).toEqual([
      'bknProject.diagnosis.writeback.roles.tracked跟踪的预测单 bknProject.diagnosis.writeback.tracks:{"name":"sales_orders"}',
      "bknProject.diagnosis.writeback.roles.id任务编号",
      "bknProject.diagnosis.writeback.roles.time创建时间",
      "bknProject.diagnosis.writeback.roles.actor创建人",
      "bknProject.diagnosis.writeback.roles.snapshot需求数量",
      "bknProject.diagnosis.writeback.roles.outcome结束方式",
      expect.stringContaining("bknProject.diagnosis.writeback.actions"),
    ]);
    expect(rows[6]).toContain('"name":"创建监测任务"');
    expect(rows[6]).toContain("跟踪的预测单");
    expect(rows[6]).not.toContain("forecast");
  });

  it("says when this edition cannot build a write-back object", async () => {
    mocks.apply.mockRejectedValue(refusal("Diagnosis.NotApplicable", 400));
    renderPanel();
    const third = await card(writeback.title);
    fireEvent.click(
      within(third).getByRole("button", { name: "bknProject.diagnosis.actions.apply" }),
    );
    await waitFor(() =>
      expect(mocks.message.warning).toHaveBeenCalledWith(
        "bknProject.diagnosis.errors.writebackNotApplicable",
      ),
    );
  });

  it("dismisses a suggestion with an optional reason and reads the draft again", async () => {
    const handlers = renderPanel();
    const first = await card(relation.title);
    fireEvent.click(
      within(first).getByRole("button", { name: "bknProject.diagnosis.actions.dismiss" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "不需要" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "bknProject.diagnosis.dismissDialog.ok" }),
    );
    await waitFor(() => expect(mocks.dismiss).toHaveBeenCalledWith("p1", "s-relation", "不需要"));
    await waitFor(() => expect(screen.queryByRole("article", { name: relation.title })).toBeNull());
    // The dismissal changed the draft: the next apply must be on the draft read again.
    await waitFor(() => expect(handlers.onDraftChanged).toHaveBeenCalled());
  });

  it("acknowledges a data quality note without asking for a reason", async () => {
    renderPanel();
    const last = await card(quality.title);
    fireEvent.click(
      within(last).getByRole("button", { name: "bknProject.diagnosis.actions.acknowledge" }),
    );
    await waitFor(() => expect(mocks.dismiss).toHaveBeenCalledWith("p1", "s-data", ""));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says a diagnosis made before the draft changed may be out of date", async () => {
    mocks.get.mockResolvedValue(ready({ stale: true }));
    renderPanel();
    const notice = await screen.findByText("bknProject.diagnosis.stale");
    const alert = notice.closest("[role=alert]") as HTMLElement;
    fireEvent.click(within(alert).getByRole("button", { name: "bknProject.diagnosis.rerun" }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith("p1"));
  });

  it("says a failed diagnosis in business wording and offers to run it again", async () => {
    mocks.get.mockResolvedValue(ready({ error: "timeout", state: "failed" }));
    renderPanel();
    expect(await screen.findByText("bknProject.diagnosis.failed.title")).toBeInTheDocument();
    expect(screen.getByText("bknProject.diagnosis.failed.timeout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bknProject.diagnosis.rerun" })).toBeInTheDocument();
  });

  it("never shows an unknown failure as it came", async () => {
    mocks.get.mockResolvedValue(ready({ error: "llm.quota_exceeded", state: "failed" }));
    renderPanel();
    expect(await screen.findByText("bknProject.diagnosis.failed.generic")).toBeInTheDocument();
    expect(screen.queryByText(/quota/)).toBeNull();
  });

  it("offers nothing to change on a read-only draft", async () => {
    renderPanel({ editable: false });
    const first = await card(relation.title);
    expect(within(first).queryByRole("button")).toBeNull();
  });
});
