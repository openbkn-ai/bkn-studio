/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { mapSpec } from "@/modules/bkn-project/services/requirements.service";
import type { LogicNeeds, LogicNeedView } from "@/modules/bkn-project/types/kinetic";
import type { Project } from "@/modules/bkn-project/types/project";
import type { Requirements } from "@/modules/bkn-project/types/requirements";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const mocks = vi.hoisted(() => ({
  addItem: vi.fn(),
  analyzeKinetic: vi.fn(),
  confirm: vi.fn(),
  editItem: vi.fn(),
  getCandidates: vi.fn(),
  getDraft: vi.fn(),
  getLogicNeeds: vi.fn(),
  getRequirements: vi.fn(),
  getStatus: vi.fn(),
  link: vi.fn(),
  listDocuments: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  removeItem: vi.fn(),
  reviewRequirements: vi.fn(),
  snapshot: { current: null as { capabilities: string[]; extensions: string[] } | null },
  unlink: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message, modal: { confirm: mocks.confirm } }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useEntitlementContext: () => ({
    loading: false,
    refresh: vi.fn(),
    snapshot: mocks.snapshot.current,
  }),
}));

vi.mock("@/modules/bkn-project/services/kinetic.service", () => ({
  getLogicNeedCandidates: mocks.getCandidates,
  getLogicNeeds: mocks.getLogicNeeds,
  linkLogicNeed: mocks.link,
  unlinkLogicNeed: mocks.unlink,
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  addItem: mocks.addItem,
  analyzeKinetic: mocks.analyzeKinetic,
  editItem: mocks.editItem,
  getRequirements: mocks.getRequirements,
  listDocuments: mocks.listDocuments,
  removeItem: mocks.removeItem,
  reviewRequirements: mocks.reviewRequirements,
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getProjectStatus: mocks.getStatus,
}));

vi.mock("@/modules/bkn-project/services/draft.service", () => ({
  getDraft: mocks.getDraft,
}));

import { ProjectKinetic } from "./ProjectKinetic";

const project: Project = {
  archived: false,
  baselineNetworkId: "n",
  branch: "project/p1",
  catalogIds: ["c"],
  createTime: 1,
  id: "p1",
  knId: "n",
  name: "p",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

const ENABLED = { capabilities: ["object_metrics"], extensions: ["object_metrics"] };

type Need = Requirements["spec"]["logicNeeds"][number];

const need = (extra: Partial<Need>): Need => ({
  accepted: true,
  citations: [],
  conceptIds: [],
  definition: "",
  edited: false,
  id: "n1",
  kind: "metric",
  name: "延误率",
  objectTypeIds: ["orders"],
  properties: [],
  scenarioIds: [],
  source: "analysis",
  suggestedMetricType: "atomic",
  supplementReason: "",
  ...extra,
});

const implementation = {
  available: true,
  description: "",
  name: "订单延误率",
  ownerObjectTypeId: "orders",
  ownerObjectTypeName: "销售订单",
  reason: "",
  status: "published",
  version: "2",
};

const NEEDS: Need[] = [
  need({ definition: "晚于承诺日期发货的订单占比", id: "n1", name: "延误率" }),
  need({ id: "n2", kind: "skill", name: "催单排序", objectTypeIds: [] }),
  need({ id: "n3", kind: "action_type", name: "改期", suggestedMetricType: "" }),
  need({ id: "n4", name: "零件数", objectTypeIds: ["bom"] }),
  need({ accepted: false, id: "n5", kind: "app", name: "看板", objectTypeIds: [] }),
  need({ id: "n6", kind: "function", name: "算运费", objectTypeIds: [] }),
  need({ id: "n7", kind: "mcp_tool", name: "查物流", objectTypeIds: [] }),
];

function requirements(extra: Partial<Requirements["spec"]> = {}): Requirements {
  return {
    error: "",
    ontologyUncovered: [],
    spec: { ...mapSpec({}), logicNeeds: NEEDS, ...extra },
    stale: false,
    status: "ready",
    undecidedChoices: 0,
    unresolvedConflicts: 0,
    updateTime: 9,
    version: 1,
  };
}

const view = (item: Need, extra: Partial<LogicNeedView> = {}): LogicNeedView => ({
  ...item,
  implementation: null,
  link: null,
  liveObjectTypeIds: item.objectTypeIds.filter((id) => id !== "bom"),
  ...extra,
});

function logicNeeds(): LogicNeeds {
  return {
    needs: [
      view(NEEDS[0]),
      view(NEEDS[1]),
      view(NEEDS[2]),
      view(NEEDS[3]),
      view(NEEDS[4]),
      view(NEEDS[5], {
        implementation,
        link: { at: 1, boxId: "box", byId: "me", id: "f1", type: "function" },
      }),
      view(NEEDS[6], {
        implementation: { ...implementation, available: false, reason: "missing" },
        link: { at: 1, boxId: "mcp", byId: "me", id: "t1", type: "mcp_tool" },
      }),
    ],
    networkId: "net",
    reason: "",
    updateTime: 9,
  };
}

function Probe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {`${location.pathname}${location.search} ${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

function renderPage(state?: unknown, owner = true) {
  return renderWithoutAntdStyles(
    <MemoryRouter initialEntries={[{ pathname: "/bkn-project/p1/kinetic", state }]}>
      <Routes>
        <Route
          element={
            <>
              <ProjectKinetic
                onGoToModel={vi.fn()}
                onGoToRelease={vi.fn()}
                ownerIsCaller={owner}
                project={project}
              />
              <Probe />
            </>
          }
          path="/bkn-project/:projectId/kinetic"
        />
        <Route element={<Probe />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent ?? "";

async function openNeed(name: string, cta: string) {
  const row = (await screen.findByText(name)).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: cta }));
  return within(await screen.findByRole("dialog"));
}

describe("ProjectKinetic", () => {
  beforeAll(() => {
    // Ant Design reads breakpoints, which jsdom lacks.
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        addEventListener: vi.fn(),
        addListener: vi.fn(),
        dispatchEvent: vi.fn(),
        matches: false,
        media: query,
        onchange: null,
        removeEventListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
    mocks.snapshot.current = ENABLED;
    mocks.getRequirements.mockResolvedValue(requirements());
    mocks.getLogicNeeds.mockResolvedValue(logicNeeds());
    mocks.getCandidates.mockResolvedValue({ candidates: [], networkId: "net", reason: "" });
    mocks.getStatus.mockResolvedValue({ confirmation: { current: true, time: 1 } });
    mocks.listDocuments.mockResolvedValue([]);
    mocks.getDraft.mockResolvedValue({
      items: {
        objectTypes: [
          { adopted: true, id: "orders", name: "销售订单" },
          { adopted: true, id: "bom", name: "物料清单" },
        ],
      },
    });
    mocks.link.mockResolvedValue(requirements());
    mocks.unlink.mockResolvedValue(requirements());
    mocks.analyzeKinetic.mockResolvedValue(requirements());
    mocks.confirm.mockImplementation(({ onOk }: { onOk: () => unknown }) => void onOk());
  });

  it("lists each need with its kind, basis, objects and where its implementation stands", async () => {
    renderPage();

    const metric = (await screen.findByText("延误率")).closest("tr")!;
    expect(within(metric).getByText("晚于承诺日期发货的订单占比")).toBeInTheDocument();
    expect(within(metric).getByText("指标")).toBeInTheDocument();
    expect(within(metric).getByText("专业版")).toBeInTheDocument();
    expect(within(metric).getByText("AI 分析")).toBeInTheDocument();
    expect(within(metric).getByText("销售订单")).toBeInTheDocument();
    expect(within(metric).getByText("待实现")).toBeInTheDocument();
    expect(within(metric).getByRole("button", { name: "匹配或实现" })).toBeInTheDocument();

    const row = (name: string) => screen.getByText(name).closest("tr")!;
    expect(within(row("零件数")).getByText("待首次发布")).toBeInTheDocument();
    expect(within(row("看板")).getByText("仅记录")).toBeInTheDocument();
    expect(within(row("看板")).getByText("AI 生成，待审核")).toBeInTheDocument();
    expect(within(row("算运费")).getByText("已实现")).toBeInTheDocument();
    expect(within(row("算运费")).getByRole("button", { name: "查看" })).toBeInTheDocument();
    expect(within(row("查物流")).getByText("实现已失效")).toBeInTheDocument();
    expect(within(row("查物流")).getByRole("button", { name: "重新匹配" })).toBeInTheDocument();
    expect(screen.queryByText(/object_metric|mcp_tool|action_type|analysis/)).toBeNull();
  });

  it("filters by kind and by state", async () => {
    renderPage();
    await screen.findByText("延误率");

    const [kind, state] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(state);
    fireEvent.click(await screen.findByTitle("实现已失效"));
    expect(screen.getByText("查物流")).toBeInTheDocument();
    expect(screen.queryByText("延误率")).toBeNull();

    fireEvent.mouseDown(kind);
    fireEvent.click(await screen.findByTitle("Skill"));
    expect(screen.queryByText("查物流")).toBeNull();
    expect(screen.getByText("没有符合筛选条件的动力需求。")).toBeInTheDocument();
  });

  it("drops the state filter when the live network can no longer be read", async () => {
    renderPage();
    await screen.findByText("延误率");
    const [, state] = screen.getAllByRole("combobox");
    fireEvent.mouseDown(state);
    fireEvent.click(await screen.findByTitle("实现已失效"));
    expect(screen.queryByText("延误率")).toBeNull();

    // An edit reads the needs again, and this time the live network does not answer.
    mocks.getLogicNeeds.mockRejectedValue(new Error("down"));
    mocks.removeItem.mockResolvedValue(requirements());
    fireEvent.click(screen.getByRole("button", { name: "删除「查物流」" }));

    expect(await screen.findByText("延误率")).toBeInTheDocument();
    expect(screen.getByText("催单排序")).toBeInTheDocument();
    expect(screen.queryByText("没有符合筛选条件的动力需求。")).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("cannot analyse before the model is confirmed, and says so", async () => {
    mocks.getStatus.mockResolvedValue({ confirmation: null });
    renderPage();

    expect(
      await screen.findByText("概念模型还没确认，确认后才能分析动力需求。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去概念建模" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分析动力需求" })).toBeDisabled();
  });

  it("analyses, and asks before starting over", async () => {
    const analysed = requirements({
      runs: {
        concepts: null,
        kinetic: {
          byId: "me",
          error: "",
          retried: false,
          startTime: 1,
          stale: false,
          status: "ready",
          updateTime: 2,
        },
      },
    });
    mocks.getRequirements.mockResolvedValue(analysed);
    mocks.analyzeKinetic.mockResolvedValue(analysed);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "重新分析" }));
    await waitFor(() => expect(mocks.analyzeKinetic).toHaveBeenCalledWith("p1", false));
    fireEvent.click(screen.getByRole("button", { name: "全部重来" }));
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "全部重新分析？" }),
    );
    await waitFor(() => expect(mocks.analyzeKinetic).toHaveBeenCalledWith("p1", true));
  });

  it("says while an analysis runs, and why one failed", async () => {
    const run = {
      byId: "me",
      error: "",
      retried: false,
      startTime: 1,
      stale: false,
      status: "running",
      updateTime: 1,
    };
    mocks.getRequirements.mockResolvedValue(
      requirements({ runs: { concepts: null, kinetic: run } }),
    );
    const { unmount } = renderPage();

    expect(await screen.findByText(/正在分析概念模型和需求文档/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新分析" })).toBeDisabled();
    unmount();

    mocks.getRequirements.mockResolvedValue(
      requirements({
        runs: { concepts: null, kinetic: { ...run, error: "agent_timeout", status: "failed" } },
      }),
    );
    renderPage();
    expect(
      await screen.findByText("没能分析动力需求：分析超时了，请重新分析。"),
    ).toBeInTheDocument();
  });

  it("links a candidate a person chooses, never by itself", async () => {
    mocks.getCandidates.mockResolvedValue({
      candidates: [
        {
          boxId: "",
          description: "按紧急程度排序",
          id: "triage",
          name: "订单分诊",
          ownerObjectTypeId: "",
          reasons: ["similar_name"],
          type: "skill",
        },
      ],
      networkId: "net",
      reason: "",
    });
    renderPage();

    const panel = await openNeed("催单排序", "匹配或实现");
    expect(await panel.findByText("订单分诊")).toBeInTheDocument();
    expect(panel.getByText("名称相近")).toBeInTheDocument();
    expect(panel.getByText(/Skill 的开发入口后续提供/)).toBeInTheDocument();
    expect(mocks.link).not.toHaveBeenCalled();

    fireEvent.click(panel.getByRole("button", { name: "连接「订单分诊」" }));
    await waitFor(() =>
      expect(mocks.link).toHaveBeenCalledWith(
        "p1",
        "n2",
        { boxId: "", id: "triage", type: "skill" },
        9,
      ),
    );
    expect(mocks.message.success).toHaveBeenCalledWith("已连上「订单分诊」");
  });

  it("opens the metric editor for the live network with the need stated", async () => {
    renderPage();

    const panel = await openNeed("延误率", "匹配或实现");
    fireEvent.click(panel.getByRole("button", { name: "去实现指标" }));

    await waitFor(() =>
      expect(location()).toContain(
        "/knowledge-network/workspace/net/metrics/create?metricType=atomic&objectTypeId=orders",
      ),
    );
    const state = JSON.parse(location().slice(location().indexOf(" ") + 1)) as {
      objectMetricContext: Record<string, unknown>;
    };
    expect(state.objectMetricContext).toEqual({
      description: "晚于承诺日期发货的订单占比",
      prompt: "创建指标「延误率」：晚于承诺日期发货的订单占比 关联对象：销售订单。",
      returnLabel: "回到动力建模",
      returnState: { needId: "n1" },
      returnTo: "/bkn-project/p1/kinetic",
      title: "项目需要：延误率",
    });
  });

  it("links the metric made there once on coming back, and clears the return", async () => {
    renderPage({ needId: "n1", objectMetricCreated: { id: "m9" } });

    await waitFor(() =>
      expect(mocks.link).toHaveBeenCalledWith(
        "p1",
        "n1",
        { boxId: "", id: "m9", type: "object_metric" },
        9,
      ),
    );
    await waitFor(() => expect(location()).toBe("/bkn-project/p1/kinetic {}"));
    expect(
      await screen.findByText(
        "线上知识网络有了新的修改。下次发布前，请先在发布页“提交线上的修改”，再发布。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "去发布" })).toBeInTheDocument();
    expect(mocks.link).toHaveBeenCalledTimes(1);
  });

  it("opens the action type form filled in, and links what it made on coming back", async () => {
    const { unmount } = renderPage();

    const panel = await openNeed("改期", "匹配或实现");
    expect(panel.getByText(/行动类没有 AI 助手/)).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "去配置行动类" }));
    await waitFor(() =>
      expect(location()).toContain("/knowledge-network/workspace/net/action-types/create"),
    );
    const state = JSON.parse(location().slice(location().indexOf(" ") + 1)) as {
      actionTypeContext: Record<string, unknown>;
    };
    expect(state.actionTypeContext).toMatchObject({
      prefill: { description: "", name: "改期", objectTypeId: "orders" },
      returnState: { needId: "n3" },
      returnTo: "/bkn-project/p1/kinetic",
    });
    unmount();

    renderPage({ actionTypeCreated: { id: "a7" }, needId: "n3" });
    await waitFor(() =>
      expect(mocks.link).toHaveBeenCalledWith(
        "p1",
        "n3",
        { boxId: "", id: "a7", type: "action_type" },
        9,
      ),
    );
  });

  it("shows the implementation as read live, opens it in a new tab, and unlinks it", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderPage();

    const panel = await openNeed("算运费", "查看");
    expect(panel.getByText("订单延误率")).toBeInTheDocument();
    expect(panel.getByText("状态：published")).toBeInTheDocument();
    expect(panel.getByText("所属对象：销售订单")).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "查看「订单延误率」" }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("/execution-factory/toolboxes/box/edit"),
      "_blank",
      "noopener,noreferrer",
    );
    expect(mocks.getCandidates).not.toHaveBeenCalled();

    fireEvent.click(panel.getByRole("button", { name: "解除连接" }));
    await waitFor(() => expect(mocks.unlink).toHaveBeenCalledWith("p1", "n6", 9));
    open.mockRestore();
  });

  it("offers to match again an implementation the network no longer has", async () => {
    renderPage();

    const panel = await openNeed("查物流", "重新匹配");
    expect(panel.getByText("知识网络里已经没有这个实现，请重新匹配。")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getCandidates).toHaveBeenCalledWith("p1", "n7"));
  });

  it("waits for the first release when its object types are not live", async () => {
    renderPage();

    const panel = await openNeed("零件数", "查看");
    expect(
      panel.getByText("关联对象还没发布到知识网络。先记录需求，首次发布后才能实现。"),
    ).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "去实现指标" })).toBeNull();
  });

  it("says the edition has no metrics in the community image, and asks nothing about them", async () => {
    mocks.snapshot.current = { capabilities: [], extensions: [] };
    renderPage();

    const row = (await screen.findByText("延误率")).closest("tr")!;
    expect(within(row).queryByText("专业版")).toBeNull();
    const panel = await openNeed("延误率", "匹配或实现");
    expect(panel.getByText("当前版本没有指标功能，可以先记录需求。")).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "去实现指标" })).toBeNull();
    expect(mocks.getCandidates).not.toHaveBeenCalled();
  });

  it("badges metrics and offers the upgrade where they are not licensed", async () => {
    mocks.snapshot.current = { capabilities: [], extensions: ["object_metrics"] };
    renderPage();

    const panel = await openNeed("延误率", "匹配或实现");
    expect(panel.getByText("专业版")).toBeInTheDocument();
    expect(panel.getByText(/指标是专业版功能，升级后可以实现/)).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "了解升级" })).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: "去实现指标" })).toBeNull();
    expect(mocks.getCandidates).not.toHaveBeenCalled();
  });

  it("sends a cleared metric type when editing, so the old one does not come back", async () => {
    mocks.editItem.mockResolvedValue(requirements());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "编辑「延误率」" }));
    const dialog = await screen.findByRole("dialog");
    const clear = dialog.querySelector(".ant-select-clear");
    expect(clear).not.toBeNull();
    fireEvent.mouseDown(clear!);
    fireEvent.click(within(dialog).getByRole("button", { name: /保\s*存/ }));

    await waitFor(() =>
      expect(mocks.editItem).toHaveBeenCalledWith(
        "p1",
        "logic_needs",
        "n1",
        expect.objectContaining({ suggestedMetricType: "" }),
        9,
      ),
    );
  });

  it("leaves an unchanged metric type out of an edit", async () => {
    mocks.editItem.mockResolvedValue(requirements());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "编辑「延误率」" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: /保\s*存/ }));

    await waitFor(() => expect(mocks.editItem).toHaveBeenCalled());
    expect(mocks.editItem.mock.calls[0][3]).not.toHaveProperty("suggestedMetricType");
  });

  it("accepts, adds and removes needs on the version read", async () => {
    mocks.reviewRequirements.mockResolvedValue(requirements());
    mocks.addItem.mockResolvedValue(requirements());
    mocks.removeItem.mockResolvedValue(requirements());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "采纳「看板」" }));
    await waitFor(() =>
      expect(mocks.reviewRequirements).toHaveBeenCalledWith("p1", 9, [
        { id: "n5", kind: "logic_needs" },
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: "删除「催单排序」" }));
    await waitFor(() =>
      expect(mocks.removeItem).toHaveBeenCalledWith("p1", "logic_needs", "n2", 9),
    );

    fireEvent.click(screen.getByRole("button", { name: "新增动力需求" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("名称"), { target: { value: " 毛利率 " } });
    fireEvent.click(dialog.getByRole("button", { name: /保\s*存/ }));
    await waitFor(() =>
      expect(mocks.addItem).toHaveBeenCalledWith(
        "p1",
        "logic_needs",
        { definition: "", logicKind: "metric", name: "毛利率", objectTypeIds: [] },
        9,
      ),
    );
  });

  it("offers no edits to others", async () => {
    renderPage(undefined, false);

    await screen.findByText("延误率");
    expect(screen.queryByRole("button", { name: "分析动力需求" })).toBeNull();
    expect(screen.queryByRole("button", { name: "新增动力需求" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^删除/ })).toBeNull();
  });
});
