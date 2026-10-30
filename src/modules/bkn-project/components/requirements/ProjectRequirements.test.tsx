/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import { mapSpec } from "@/modules/bkn-project/services/requirements.service";
import type { Project } from "@/modules/bkn-project/types/project";
import type { RequirementDocument, Requirements } from "@/modules/bkn-project/types/requirements";

const getRequirementsMock = vi.hoisted(() => vi.fn());
const listDocumentsMock = vi.hoisted(() => vi.fn());
const getDocumentMock = vi.hoisted(() => vi.fn());
const draftRequirementsMock = vi.hoisted(() => vi.fn());
const uploadDocumentsMock = vi.hoisted(() => vi.fn());
const setDocumentTypeMock = vi.hoisted(() => vi.fn());
const getDraftMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, modal: { confirm: confirmMock } }),
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  getDraft: getDraftMock,
}));

vi.mock("@/modules/bkn-project/services/requirements.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/requirements.service")>()),
  draftRequirements: draftRequirementsMock,
  getDocument: getDocumentMock,
  getRequirements: getRequirementsMock,
  listDocuments: listDocumentsMock,
  setDocumentType: setDocumentTypeMock,
  uploadDocuments: uploadDocumentsMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectRequirements } from "./ProjectRequirements";

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

const documents: RequirementDocument[] = [
  {
    createTime: Date.parse("2026-10-29T09:00:00"),
    docType: "prd",
    format: "markdown",
    id: "d1",
    name: "supply-prd.md",
    size: 2048,
    uploaderId: "me",
  },
  {
    createTime: Date.parse("2026-10-29T09:01:00"),
    docType: "policy",
    format: "markdown",
    id: "d2",
    name: "purchase-policy.md",
    size: 400,
    uploaderId: "me",
  },
];

const quote = { block_id: "b2", document_id: "d1", end: 15, quote: "哪些订单晚了", start: 9 };

function requirements(extra: Partial<Requirements> = {}): Requirements {
  return {
    error: "",
    spec: mapSpec({
      choices: [
        {
          id: "f1",
          options: [
            { consequence: "一个客户对象类", id: "o1", label: "不分开" },
            { consequence: "按类型分开建模", id: "o2", label: "分开" },
          ],
          question: "客户要不要按类型分开建模？",
          reason: "资料里各类客户没有差别。",
          recommended_option_id: "o1",
        },
      ],
      concepts: [
        {
          category: "object",
          citations: [quote],
          definition: "客户下的销售订单。",
          id: "c1",
          maps_to: { id: "sales_order", kind: "object_type" },
          term: "销售订单",
        },
        {
          category: "not_ontology",
          definition: "订单晚了多少天。",
          id: "c2",
          not_ontology_reason: "由订单日期算出。",
          term: "延误天数",
        },
      ],
      conflicts: [
        {
          deferred: false,
          id: "k1",
          kind: "rule",
          sides: [
            { ...quote, position: "按客户统计" },
            { ...quote, document_id: "d2", position: "按承诺日期" },
          ],
          suggested_document_id: "d2",
          topic: "什么算晚",
        },
      ],
      questions: [
        {
          answer_shape: "订单列表",
          citations: [quote],
          id: "q1",
          layer: "knowledge",
          needs: [
            { id: "sales_order", kind: "object_type" },
            { id: "gone", kind: "object_type" },
          ],
          needs_source: "concepts",
          scenario_ids: ["s1"],
          template: "客户 {customer} 哪些订单晚了？",
          text: "某个客户哪些订单晚了？",
          type: "filter",
        },
      ],
      rejected: [{ kind: "rule", reason: "quote_not_found", text: "两天内发货。" }],
      rules: [{ compiles_to: "constraint", id: "r1", statement: "晚于承诺日期发货即为延误。" }],
      scenarios: [
        {
          actor: "销售经理",
          capabilities: [{ kind: "metric", name: "延误率" }],
          decision: "先联系谁",
          id: "s1",
          knowledge: ["订单与承诺日期"],
          name: "交付延误预警",
          trigger: "每天早上",
        },
      ],
    }),
    stale: false,
    status: "ready",
    undecidedChoices: 1,
    unresolvedConflicts: 1,
    updateTime: 1,
    version: 2,
    ...extra,
  };
}

function renderPage(owner = true) {
  return renderWithoutAntdStyles(<ProjectRequirements ownerIsCaller={owner} project={project} />);
}

describe("ProjectRequirements", () => {
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
    listDocumentsMock.mockResolvedValue(documents);
    getRequirementsMock.mockResolvedValue(requirements());
    getDraftMock.mockResolvedValue({
      items: { objectTypes: [{ id: "sales_order", name: "销售订单" }], relationTypes: [] },
    });
  });

  it("shows the questions first, naming what they need as the draft does", async () => {
    renderPage();

    expect(await screen.findByText("需求规格第 2 版 · 已起草")).toBeInTheDocument();
    expect(screen.getByText("还有 1 个需求冲突、1 个建模选择等你处理。")).toBeInTheDocument();
    expect(screen.getByText("某个客户哪些订单晚了？")).toBeInTheDocument();
    expect(screen.getByText("知识层")).toBeInTheDocument();
    expect(screen.getByText("筛选")).toBeInTheDocument();
    expect(screen.getByText("交付延误预警")).toBeInTheDocument();
    expect(await screen.findByText("销售订单、gone（按候选概念）")).toBeInTheDocument();
    expect(screen.getByText("出自「supply-prd.md」")).toBeInTheDocument();
    expect(screen.getByText("起草时去掉了 1 条内容")).toBeInTheDocument();
    expect(screen.queryByText(/knowledge|filter|object_type/)).toBeNull();
  });

  it("opens a quote in its document, marked", async () => {
    getDocumentMock.mockResolvedValue({
      ...documents[0],
      blocks: [],
      content: "销售部门需要知道：哪些订单晚了，并尽快跟进。",
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "查看原文" }));
    const drawer = within(await screen.findByRole("dialog"));
    await waitFor(() => expect(getDocumentMock).toHaveBeenCalledWith("p1", "d1"));
    expect((await drawer.findByText("哪些订单晚了")).tagName).toBe("MARK");
  });

  it("shows scenarios, concepts, and the conflicts and choices with the rules", async () => {
    renderPage();
    await screen.findByText("某个客户哪些订单晚了？");

    fireEvent.click(screen.getByText(/^业务场景/));
    expect(screen.getByText("销售经理")).toBeInTheDocument();
    expect(screen.getByText("指标：延误率")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/^候选概念/));
    expect(screen.getByText("实体")).toBeInTheDocument();
    expect(screen.getAllByText("销售订单").length).toBeGreaterThan(0);
    expect(screen.getByText("不进入本体")).toBeInTheDocument();
    expect(screen.getByText("由订单日期算出。")).toBeInTheDocument();

    fireEvent.click(screen.getByText(/^业务规则/));
    expect(screen.getByText("需求冲突：什么算晚")).toBeInTheDocument();
    expect(screen.getByText("待裁决")).toBeInTheDocument();
    expect(screen.getByText("按文档类型，建议以这一方为准")).toBeInTheDocument();
    expect(screen.getByText("建模选择：客户要不要按类型分开建模？")).toBeInTheDocument();
    expect(screen.getByText("当前采用")).toBeInTheDocument();
    expect(screen.getByText("晚于承诺日期发货即为延误。")).toBeInTheDocument();
    expect(screen.getByText("约束")).toBeInTheDocument();
  });

  it("starts from the documents before the first drafting, and drafts from them", async () => {
    getRequirementsMock.mockResolvedValueOnce(null);
    draftRequirementsMock.mockResolvedValue(
      requirements({ spec: mapSpec({}), status: "drafting", version: 1 }),
    );
    renderPage();

    expect(
      await screen.findByText("还没有需求规格。上传需求文档后，从资料起草。"),
    ).toBeInTheDocument();
    expect(screen.getByText("supply-prd.md")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "从资料起草" }));
    await waitFor(() => expect(draftRequirementsMock).toHaveBeenCalledWith("p1", false));
    expect(
      await screen.findByText("正在从资料起草需求规格，通常需要一两分钟。"),
    ).toBeInTheDocument();
  });

  it("asks before drafting again discards what was decided", async () => {
    draftRequirementsMock.mockRejectedValueOnce(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error_code: "BknProject.Requirement.HasDecisions" },
        status: 409,
      } as AxiosResponse),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "重新起草" }));
    await waitFor(() =>
      expect(confirmMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "重新起草会丢弃已做的冲突裁决和建模选择。",
          title: "重新起草需求规格？",
        }),
      ),
    );
  });

  it("names only what waits", async () => {
    getRequirementsMock.mockResolvedValue(
      requirements({ undecidedChoices: 5, unresolvedConflicts: 0 }),
    );
    renderPage();
    expect(
      await screen.findByText("有 5 个建模选择可以处理，不处理就按推荐。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0 个需求冲突/)).toBeNull();
  });

  it("says why drafting failed, in plain words", async () => {
    getRequirementsMock.mockResolvedValue(
      requirements({ error: "agent_timeout", spec: mapSpec({}), status: "failed" }),
    );
    renderPage();
    expect(await screen.findByText("起草超时了，请重新起草。")).toBeInTheDocument();
    expect(screen.queryByText(/agent_timeout/)).toBeNull();
  });

  it("uploads documents and says how each went", async () => {
    uploadDocumentsMock.mockResolvedValue([
      { code: "", documentId: "d3", name: "new.md", outcome: "created" },
      { code: "Requirement.UnsupportedFormat", documentId: "", name: "a.pdf", outcome: "rejected" },
    ]);
    renderPage();
    await screen.findByText("某个客户哪些订单晚了？");

    fireEvent.click(screen.getByText(/^输入资料/));
    fireEvent.click(screen.getByRole("button", { name: "上传文档" }));
    const dialog = within(await screen.findByRole("dialog"));
    const input = dialog
      .getByText("拖入文件，或点击选择")
      .closest(".ant-upload")!
      .querySelector("input")!;
    // Two files of one name stay two, and one of them can be taken out on its own.
    fireEvent.change(input, {
      target: { files: [new File(["# x"], "new.md"), new File(["# y"], "new.md")] },
    });
    const listed = () => document.querySelectorAll(".ant-upload-list-item");
    await waitFor(() => expect(listed()).toHaveLength(2));
    fireEvent.click(listed()[1].querySelector(".ant-upload-list-item-actions button")!);
    await waitFor(() => expect(listed()).toHaveLength(1));
    fireEvent.click(await dialog.findByRole("button", { name: "上传所选" }));
    expect(uploadDocumentsMock.mock.calls[0][1]).toHaveLength(1);

    expect(await dialog.findByText("已上传")).toBeInTheDocument();
    expect(dialog.getByText("只支持 Markdown 和纯文本文件")).toBeInTheDocument();
    // Closing reads the documents again. A slow runner may take the click while the button is
    // still settling, so it is clicked until the documents are read again.
    await waitFor(
      () => {
        const done = screen.queryByRole("button", { name: /完\s*成/ });
        if (done) {
          fireEvent.click(done);
        }
        expect(listDocumentsMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 },
    );
  });

  it("lets the owner type a document; others only read", async () => {
    setDocumentTypeMock.mockResolvedValue(undefined);
    const view = renderPage();
    await screen.findByText("某个客户哪些订单晚了？");
    fireEvent.click(screen.getByText(/^输入资料/));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "「supply-prd.md」的文档类型" }));
    fireEvent.click(await screen.findByTitle("标准"));
    await waitFor(() => expect(setDocumentTypeMock).toHaveBeenCalledWith("p1", "d1", "standard"));
    view.unmount();

    renderPage(false);
    await screen.findByText("某个客户哪些订单晚了？");
    expect(screen.queryByRole("button", { name: "重新起草" })).toBeNull();
    fireEvent.click(screen.getByText(/^输入资料/));
    expect(screen.getByText("产品需求")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "上传文档" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
