/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";
import type {
  ProjectVersions,
  Regression,
  ReleaseReview,
} from "@/modules/bkn-project/types/release";

const getReleaseReviewMock = vi.hoisted(() => vi.fn());
const publishReleaseMock = vi.hoisted(() => vi.fn());
const prepareReleaseMock = vi.hoisted(() => vi.fn());
const commitDriftMock = vi.hoisted(() => vi.fn());
const syncBranchMock = vi.hoisted(() => vi.fn());
const getRegressionMock = vi.hoisted(() => vi.fn());
const getRollbackPlanMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => new Map([["u2", "张三"]]),
}));

vi.mock("@/modules/bkn-project/services/release.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/release.service")>()),
  commitDrift: commitDriftMock,
  getRegression: getRegressionMock,
  getReleaseReview: getReleaseReviewMock,
  getRollbackPlan: getRollbackPlanMock,
  prepareRelease: prepareReleaseMock,
  publishRelease: publishReleaseMock,
  syncBranch: syncBranchMock,
}));

import { REGRESSION_POLL_MS } from "@/modules/bkn-project/services/release.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ReleasePublish } from "./ReleasePublish";

function status(extra: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    blockers: [],
    check: { current: true, status: "passed" },
    confirmation: { current: true, time: 1 },
    dataSources: null,
    hints: [],
    draft: { decisions: 0, placeholders: 0, status: "ready", updateTime: 1 },
    nextActions: [
      {
        accepts: [],
        action: "review_release",
        allowed: true,
        discardsDecisions: 0,
        suggestedVersion: "1.0.3",
      },
    ],
    release: null,
    stage: "confirmed",
    stale: [],
    undecided: 0,
    unresolvedConflicts: 0,
    unreviewed: 0,
    ...extra,
  };
}

function review(extra: Partial<ReleaseReview> = {}): ReleaseReview {
  return {
    accepts: ["index_not_ready"],
    blocked: false,
    capabilities: [],
    changes: {
      added: [{ id: "orders", kind: "object_type", name: "订单" }],
      changed: [],
      other: 0,
      removed: [],
    },
    checks: [
      { code: "confirmed", passed: true },
      {
        accept: "index_not_ready",
        code: "index",
        details: { not_configured: 1, ready: 3 },
        passed: false,
        reason: "index_not_ready",
      },
    ],
    questions: {
      affected: [],
      answerableNew: [],
      total: 1,
      unanswerable: [
        {
          id: "q7",
          missing: [{ id: "bom", kind: "object_type", name: "物料BOM" }],
          text: "哪些产品用到了 P-100？",
          unconnected: [],
        },
      ],
      unjudged: 0,
    },
    refusals: [],
    release: { baseVersion: "1.0.2", networkId: "n_v1_0_3", networkName: "供应链 · 1.0.3" },
    risks: { copies: 0, existing: [], onlyAdditions: true, orphans: [], unimplementedNeeds: [] },
    signature: "sig-1",
    version: "1.0.3",
    ...extra,
  };
}

function refusal(code: string) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: code, error_code: `BknProject.${code}` },
    status: 409,
  } as AxiosResponse);
}

const onChanged = vi.fn();
const onOpenRegression = vi.fn();

const onGoToBuild = vi.fn();

function versions(extra: Partial<ProjectVersions> = {}, fullHistory = true): ProjectVersions {
  return {
    entries: [
      {
        baseVersion: 6,
        createTime: 1,
        label: "v1.0.2",
        notes: "",
        origin: "project",
        publisherId: "me",
        release: "1.0.2",
        status: "running",
        version: 7,
      },
      {
        baseVersion: 5,
        createTime: 1,
        label: "v1.0.1",
        notes: "",
        origin: "project",
        publisherId: "me",
        release: "1.0.1",
        status: "history",
        version: 6,
      },
    ],
    prepared: null,
    versioning: {
      draft: { baseVersion: 7, hasChanges: false, outdated: false },
      fullHistory,
      previousVersion: 6,
      runningVersion: 7,
    },
    ...extra,
  };
}

const prepared = {
  publisherId: "me",
  updateTime: Date.parse("2026-11-08T10:31:00"),
  version: "1.0.3",
};

function regression(results: string[], extra: Partial<Regression> = {}): Regression {
  return {
    attempt: 1,
    error: "",
    finishTime: 2,
    questions: [],
    results: results.map((outcome, at) => ({
      answer: "",
      errorCode: "",
      missing: [],
      missingTables: [],
      outcome,
      questionId: `q${at}`,
      reason: "",
      testId: "",
      toolStatuses: [],
    })),
    runnerId: "me",
    startTime: 1,
    status: results.every((outcome) => outcome === "passed") ? "passed" : "not_passed",
    version: "1.0.3",
    ...extra,
  };
}

function renderPublish(
  projectStatus = status(),
  canPublish = true,
  projectVersions: ProjectVersions | null = versions(),
) {
  return renderWithoutAntdStyles(
    <ReleasePublish
      canPublish={canPublish}
      onChanged={onChanged}
      onGoToBuild={onGoToBuild}
      onOpenRegression={onOpenRegression}
      projectId="p1"
      status={projectStatus}
      versions={projectVersions}
    />,
  );
}

const dialog = async () => within(await screen.findByRole("dialog"));
const prepareButton = () => screen.getByRole("button", { name: "写入网络并回归" });

describe("ReleasePublish", () => {
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
    getReleaseReviewMock.mockResolvedValue(review());
    getRegressionMock.mockResolvedValue(null);
  });

  it("shows the confirmed number of document originals included in search", async () => {
    getReleaseReviewMock.mockResolvedValue(
      review({
        checks: [{ code: "knowledge_base", passed: true, details: { original_documents: 5 } }],
        accepts: [],
      }),
    );
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(
      await view.findByText("5 份文件的原文将纳入网络检索。未开启的文件仅保留证据定位。"),
    ).toBeInTheDocument();
    expect(view.queryByText(/original_documents|knowledge_base/)).not.toBeInTheDocument();
  });

  it("uses the English singular for one original document", async () => {
    await i18n.changeLanguage("en-US");
    getReleaseReviewMock.mockResolvedValue(
      review({
        checks: [{ code: "knowledge_base", passed: true, details: { original_documents: 1 } }],
        accepts: [],
      }),
    );
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Review and prepare" }));
    const view = await dialog();
    expect(
      await view.findByText(
        "Originals from 1 document will be included in network search. Other documents retain evidence locations only.",
      ),
    ).toBeInTheDocument();
  });

  it("reviews the release in plain words, and prepares it once the owner accepts what did not pass", async () => {
    prepareReleaseMock.mockResolvedValue(undefined);
    renderPublish();

    for (const step of ["审查确认的内容", "写入网络并回归", "发布"]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(screen.getByText("运行版本 v1.0.2")).toBeInTheDocument();
    expect(screen.getByText("v1.0.3（基于 v1.0.2）")).toBeInTheDocument();
    expect(
      screen.getByText(
        "先把确认的内容写入网络，在网络上跑一遍场景问题，看过结果再发布。写入后，运行版本不受影响。",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(view.getByText("准备发布 v1.0.3")).toBeInTheDocument();
    expect(await view.findByText("草稿确认")).toBeInTheDocument();
    expect(
      view.getByText(
        "3 / 4 张表的本地索引可用。全文检索和向量检索要等索引就绪，其他查询不受影响。",
      ),
    ).toBeInTheDocument();
    expect(view.getByText("订单")).toBeInTheDocument();
    expect(view.getByText("这次只新增内容，不改动线上已有的内容。")).toBeInTheDocument();
    expect(view.getByText("哪些产品用到了 P-100？")).toBeInTheDocument();
    expect(view.getByText("缺少：物料BOM")).toBeInTheDocument();
    expect(view.queryByText(/index_not_ready|object_type/)).toBeNull();
    expect(view.queryByLabelText("发布说明")).toBeNull();

    expect(prepareButton()).toBeDisabled();
    fireEvent.click(view.getByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.click(prepareButton());

    await waitFor(() =>
      expect(prepareReleaseMock).toHaveBeenCalledWith("p1", {
        accepts: ["index_not_ready"],
        overwriteDraftChanges: false,
        signature: "sig-1",
        version: "1.0.3",
      }),
    );
    expect(messageMock.success).toHaveBeenCalledWith("已写入网络，场景回归进行中");
    expect(onChanged).toHaveBeenCalled();
  });

  it("asks what happens to online edits nobody published, and commits or overwrites them", async () => {
    prepareReleaseMock
      .mockRejectedValueOnce(refusal("Release.DraftHasChanges"))
      .mockRejectedValueOnce(refusal("Release.DraftHasChanges"))
      .mockResolvedValueOnce(undefined);
    commitDriftMock.mockResolvedValue(undefined);
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    fireEvent.click(await view.findByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.click(prepareButton());

    expect(await screen.findByText("网络里有尚未发布的在线修改")).toBeInTheDocument();
    expect(screen.getByText(/写入确认的内容会替换它们/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("先提交到项目"));
    await waitFor(() => expect(commitDriftMock).toHaveBeenCalledWith("p1"));
    expect(messageMock.success).toHaveBeenCalledWith("已把在线修改提交到项目，请重新审查");
    await waitFor(() => expect(getReleaseReviewMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("网络里有尚未发布的在线修改")).toBeNull();

    // What was accepted stays accepted while the review still asks for it.
    await view.findByText("草稿确认");
    await waitFor(() => expect(prepareButton()).toBeEnabled());
    fireEvent.click(prepareButton());
    fireEvent.click(await screen.findByText("覆盖在线修改"));
    await waitFor(() =>
      expect(prepareReleaseMock).toHaveBeenLastCalledWith(
        "p1",
        expect.objectContaining({ overwriteDraftChanges: true }),
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("leads to the build page from indexes that are not ready", async () => {
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();

    fireEvent.click(await view.findByRole("button", { name: "去构建页处理索引" }));
    expect(onGoToBuild).toHaveBeenCalledTimes(1);
  });

  it("keeps hundreds of changes and long names readable", async () => {
    const long = "供应商年度准时交付率按季度滚动计算的考核结果".repeat(4);
    getReleaseReviewMock.mockResolvedValue(
      review({
        changes: {
          added: Array.from({ length: 300 }, (_, index) => ({
            id: `ot_${index}`,
            kind: "object_type",
            name: index === 0 ? long : `Object ${index}`,
          })),
          changed: [],
          other: 0,
          removed: [],
        },
      }),
    );
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(await view.findByText("新增 300")).toBeInTheDocument();
    expect(view.getByText(long)).toBeInTheDocument();
    expect(view.queryByText("Object 30")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "显示全部 300 项" }));
    expect(view.getByText("Object 299")).toBeInTheDocument();
  });

  it("reads the review again when the draft or the live version moved since", async () => {
    prepareReleaseMock.mockRejectedValue(refusal("Release.ReviewOutdated"));
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    fireEvent.click(await view.findByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.click(prepareButton());

    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "检查之后草稿或线上版本又变了，已重新检查，请再看一遍。",
      ),
    );
    await waitFor(() => expect(getReleaseReviewMock).toHaveBeenCalledTimes(2));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it.each([
    ["KnowledgeBaseNotReady", "请先完成当前模型的知识库全量构建和结果核对。"],
    ["OriginalsChanged", "确认模型后，文件是否保留原文的设置已改，请重新确认模型。"],
    ["SourcePermission", "请确认来源知识库的查询权限和目标知识网络的配置权限。"],
    ["KnowledgeBaseUnavailable", "暂时无法核对知识库发布条件，请稍后重试。"],
  ])("explains %s after a refusal to prepare and preserves the retry", async (code, text) => {
    prepareReleaseMock.mockRejectedValue(refusal(`Release.${code}`));
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    fireEvent.click(await view.findByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.click(prepareButton());
    expect(await view.findByText(text)).toBeInTheDocument();
    expect(prepareButton()).toBeEnabled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(view.queryByText(code)).not.toBeInTheDocument();
  });

  it("reviews another version only after checking it again", async () => {
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    await view.findByText("草稿确认");

    fireEvent.change(view.getByLabelText("版本号"), { target: { value: "1.1" } });
    expect(view.getByText("版本号的格式是 主版本.次版本.修订号，例如 1.0.3")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "按这个版本号重新检查" })).toBeDisabled();

    fireEvent.change(view.getByLabelText("版本号"), { target: { value: "1.1.0" } });
    fireEvent.click(view.getByRole("button", { name: "按这个版本号重新检查" }));
    await waitFor(() => expect(getReleaseReviewMock).toHaveBeenLastCalledWith("p1", "1.1.0"));
  });

  it("says what stops a release, and offers to bring in the live version", async () => {
    getReleaseReviewMock.mockResolvedValue(
      review({
        accepts: [],
        blocked: true,
        checks: [
          {
            code: "baseline",
            details: { base_version: "1.0.2", live_network_id: "n" },
            passed: false,
            reason: "branch_behind",
          },
          { code: "names", passed: false, reason: "something_new" },
        ],
        refusals: ["Release.VersionExists"],
      }),
    );
    syncBranchMock.mockResolvedValue(undefined);
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(await view.findByText("这个版本号已经发布过，请换一个。")).toBeInTheDocument();
    expect(
      view.getByText("线上已发布 v1.0.2，项目还基于更早的版本，需要先同步。"),
    ).toBeInTheDocument();
    // A reason the page does not know reads as one, not as its code.
    expect(view.getByText("这项检查没有通过。")).toBeInTheDocument();
    expect(prepareButton()).toBeDisabled();

    fireEvent.click(view.getByRole("button", { name: "同步线上版本" }));
    await waitFor(() => expect(syncBranchMock).toHaveBeenCalledWith("p1"));
    await waitFor(() => expect(getReleaseReviewMock).toHaveBeenCalledTimes(2));
  });

  it("names the items whose tables are gone, which no one can accept", async () => {
    getReleaseReviewMock.mockResolvedValue(
      review({
        accepts: [],
        blocked: true,
        checks: [
          { code: "mapped", passed: true },
          {
            code: "data_source",
            details: [
              { id: "ot_customer", kind: "object_type", name: "客户" },
              { id: "rt_order", kind: "relation_type", name: "下单" },
            ],
            passed: false,
            reason: "table_missing",
          },
        ],
      }),
    );
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(await view.findByText("数据来源")).toBeInTheDocument();
    expect(
      view.getByText(
        "2 个条目的数据表已不存在，发布后查不到它们的数据。请重新起草并确认后再发布。",
      ),
    ).toBeInTheDocument();
    expect(view.getByText("「客户」的数据表已不存在")).toBeInTheDocument();
    expect(view.getByText("「下单」的数据表已不存在")).toBeInTheDocument();
    expect(view.queryByText(/ot_customer|table_missing/)).toBeNull();
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(prepareButton()).toBeDisabled();
  });

  it("names the metrics whose object types the release lacks, which no one can accept", async () => {
    getReleaseReviewMock.mockResolvedValue(
      review({
        accepts: [],
        blocked: true,
        changes: {
          added: [],
          changed: [],
          other: 0,
          removed: [{ id: "ot_order", kind: "object_type", name: "订单" }],
        },
        checks: [
          {
            code: "metric_owners",
            details: [{ id: "m1", name: "延误率", owner_object_type_id: "ot_order" }],
            passed: false,
            reason: "metric_owner_missing",
          },
        ],
      }),
    );
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(await view.findByText("指标所属对象")).toBeInTheDocument();
    expect(view.getByText(/有 1 个指标所属的对象类不在这次发布里/)).toBeInTheDocument();
    expect(view.getByText("指标「延误率」所属的对象类「订单」")).toBeInTheDocument();
    expect(view.queryByText(/ot_order|metric_owner/)).toBeNull();
    expect(view.queryByRole("checkbox")).toBeNull();
    expect(prepareButton()).toBeDisabled();
  });

  it("counts the kinetic needs nothing implements, without stopping the release", async () => {
    const onGoToKinetic = vi.fn();
    getReleaseReviewMock.mockResolvedValue(
      review({
        risks: {
          copies: 0,
          existing: [],
          onlyAdditions: true,
          orphans: [],
          unimplementedNeeds: [
            { id: "n1", kind: "metric", name: "延误率" },
            { id: "n2", kind: "skill", name: "催单排序" },
          ],
        },
      }),
    );
    renderWithoutAntdStyles(
      <ReleasePublish
        canPublish
        onChanged={onChanged}
        onGoToKinetic={onGoToKinetic}
        onOpenRegression={onOpenRegression}
        projectId="p1"
        status={status()}
        versions={versions()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(
      await view.findByText(/还有 2 项动力需求没有实现，依赖它们的问题可能答不上来/),
    ).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "去动力建模" }));
    expect(onGoToKinetic).toHaveBeenCalledTimes(1);
  });

  it("lets others read the review, never publish", async () => {
    renderPublish(status(), false);

    fireEvent.click(screen.getByRole("button", { name: "查看发布审核" }));
    const view = await dialog();
    expect(await view.findByText("草稿确认")).toBeInTheDocument();
    expect(view.getByRole("checkbox")).toBeDisabled();
    expect(view.queryByLabelText("发布说明")).toBeNull();
    expect(screen.queryByRole("button", { name: "写入网络并回归" })).toBeNull();
  });

  it.each([
    ["knowledge_base_not_ready", "请先完成当前模型的知识库全量构建和结果核对。"],
    [
      "knowledge_base_originals_changed",
      "确认模型后，文件是否保留原文的设置已改，请重新确认模型。",
    ],
    ["knowledge_base_permission", "请确认来源知识库的查询权限和目标知识网络的配置权限。"],
    ["knowledge_base_unavailable", "暂时无法核对知识库发布条件，请稍后重新审核。"],
  ])("blocks knowledge-base publication in business language: %s", async (reason, message) => {
    getReleaseReviewMock.mockResolvedValue(
      review({
        accepts: [],
        blocked: true,
        checks: [{ code: "knowledge_base", passed: false, reason }],
      }),
    );
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "审查并准备发布" }));
    const view = await dialog();
    expect(await view.findByText("知识库构建与来源权限")).toBeInTheDocument();
    expect(view.getByText(message)).toBeInTheDocument();
    expect(prepareButton()).toBeDisabled();
    expect(view.queryByText(/knowledge_base/)).not.toBeInTheDocument();
    expect(prepareReleaseMock).not.toHaveBeenCalled();
  });

  it("shows a prepared release with its regression, and publishes once failures are accepted", async () => {
    getRegressionMock.mockResolvedValue(regression(["passed", "passed", "not_answered"]));
    publishReleaseMock.mockResolvedValue({ knVersion: 8, purgedVersion: 0 });
    renderPublish(status(), true, versions({ prepared }));

    expect(screen.getByText("2026/11/08 10:31，你")).toBeInTheDocument();
    expect(await screen.findByText("2 / 3 通过")).toBeInTheDocument();
    expect(getRegressionMock).toHaveBeenCalledWith("p1", "1.0.3");
    expect(
      screen.getByText(
        "有 1 个场景问题没有答对。可以回到建模修改后重新准备，也可以确认后照样发布。",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    expect(onOpenRegression).toHaveBeenCalledWith("1.0.3", true);
    expect(screen.getByRole("button", { name: "重新准备" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    const view = await dialog();
    expect(view.getByText("v1.0.2")).toBeInTheDocument();
    const publish = view.getByRole("button", { name: /^发\s?布$/ });
    expect(publish).toBeDisabled();
    fireEvent.click(view.getByText("1 个场景问题没有答对，确认照样发布"));
    fireEvent.change(view.getByLabelText("发布说明"), { target: { value: " 新增订单 " } });
    expect(view.queryByText(/社区版只保留上一版/)).toBeNull();
    fireEvent.click(publish);

    await waitFor(() =>
      expect(publishReleaseMock).toHaveBeenCalledWith("p1", {
        allowOutdatedBase: false,
        notes: "新增订单",
        version: "1.0.3",
      }),
    );
    expect(messageMock.success).toHaveBeenCalledWith("已发布 v1.0.3，智能体和 MCP 已在使用新版本");
    expect(onChanged).toHaveBeenCalled();
  });

  it("asks to bring back what a rollback took out before publishing", async () => {
    getRegressionMock.mockResolvedValue(regression(["passed"]));
    publishReleaseMock.mockResolvedValue({ knVersion: 8, purgedVersion: 0 });
    renderPublish(
      status(),
      true,
      versions({
        prepared,
        versioning: {
          draft: { baseVersion: 7, hasChanges: false, outdated: true },
          fullHistory: true,
          previousVersion: 7,
          runningVersion: 6,
        },
      }),
    );

    expect(
      screen.getByText(
        "运行版本已回退到 v1.0.1，项目里的内容仍基于 v1.0.2。发布时会把回退掉的 v1.0.2 的改动重新带回。",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    const view = await dialog();
    expect(
      view.getByText("运行版本已回退到 v1.0.1。这次发布会把 v1.0.2 的改动重新带回。"),
    ).toBeInTheDocument();
    const publish = view.getByRole("button", { name: /^发\s?布$/ });
    expect(publish).toBeDisabled();
    fireEvent.click(view.getByText("我确认要带回这些改动"));
    fireEvent.click(publish);
    await waitFor(() =>
      expect(publishReleaseMock).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ allowOutdatedBase: true }),
      ),
    );
  });

  it("asks to bring changes back when the network says it was rolled back since", async () => {
    getRegressionMock.mockResolvedValue(regression(["passed"]));
    publishReleaseMock
      .mockRejectedValueOnce(refusal("Release.DraftOutdated"))
      .mockResolvedValueOnce({ knVersion: 8, purgedVersion: 0 });
    renderPublish(status(), true, versions({ prepared }));
    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    const view = await dialog();
    fireEvent.click(view.getByRole("button", { name: /^发\s?布$/ }));

    expect(
      await view.findByText("运行版本刚刚被回退过，请确认要带回这些改动后再发布。"),
    ).toBeInTheDocument();
    expect(view.getByRole("button", { name: /^发\s?布$/ })).toBeDisabled();
    fireEvent.click(view.getByText("我确认要带回这些改动"));
    fireEvent.click(view.getByRole("button", { name: /^发\s?布$/ }));
    await waitFor(() =>
      expect(publishReleaseMock).toHaveBeenLastCalledWith(
        "p1",
        expect.objectContaining({ allowOutdatedBase: true }),
      ),
    );
  });

  it.each([
    ["Release.DraftChanged", "写入网络之后，网络又被修改过。请重新准备发布。"],
    ["Release.RunningChanged", "运行版本刚刚有变化。请重新准备发布。"],
    ["Release.ValidationFailed", "网络里的内容没有通过校验，没能发布。请回到建模检查后重新准备。"],
    ["Release.NotReady", "暂时发布不了，请稍后重试。"],
    [
      "Release.PublishPending",
      "这个版本已经发出发布，但没有收到结果。请先再次点击发布完成它，不要重新准备。",
    ],
  ])("explains %s when publishing, in plain words", async (code, text) => {
    getRegressionMock.mockResolvedValue(regression(["passed"]));
    publishReleaseMock.mockRejectedValue(refusal(code));
    renderPublish(status(), true, versions({ prepared }));
    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    const view = await dialog();
    fireEvent.click(view.getByRole("button", { name: /^发\s?布$/ }));
    expect(await view.findByText(text)).toBeInTheDocument();
    expect(view.queryByText(new RegExp(code))).toBeNull();
  });

  it("says the network has not changed, and publishes nothing", async () => {
    getRegressionMock.mockResolvedValue(regression(["passed"]));
    publishReleaseMock.mockRejectedValue(refusal("Release.NothingToPublish"));
    renderPublish(status(), true, versions({ prepared }));
    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    fireEvent.click((await dialog()).getByRole("button", { name: /^发\s?布$/ }));

    expect(
      await screen.findByText("网络没有变化。确认的内容与运行版本 v1.0.2 相同，不需要发布。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布 v1.0.3" })).toBeDisabled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("tells the community edition which version keeps only its record", async () => {
    getRegressionMock.mockResolvedValue(regression(["passed"]));
    renderPublish(status(), true, versions({ prepared }, false));
    fireEvent.click(screen.getByRole("button", { name: "发布 v1.0.3" }));
    expect(
      (await dialog()).getByText("社区版只保留上一版。发布后 v1.0.1 只保留记录。"),
    ).toBeInTheDocument();
  });

  it("follows a running regression until it ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // A failed read in between does not stop following it.
    getRegressionMock
      .mockResolvedValueOnce(regression([], { status: "running" }))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(regression(["passed"]));
    renderPublish(status(), true, versions({ prepared }));

    expect(await screen.findByText("运行中")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(REGRESSION_POLL_MS));
    expect(screen.getByText("运行中")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(REGRESSION_POLL_MS));
    expect(await screen.findByText("1 / 1 通过")).toBeInTheDocument();
    const reads = getRegressionMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(REGRESSION_POLL_MS * 2));
    expect(getRegressionMock.mock.calls.length).toBe(reads);
    vi.useRealTimers();
  });

  it("offers to roll back once published, and opens what it would do", async () => {
    getRegressionMock.mockResolvedValue(null);
    getRollbackPlanMock.mockResolvedValue({
      from: { knVersion: 7, label: "v1.0.2", version: "1.0.2" },
      fullHistory: true,
      questions: { affected: [], answerableNew: [], total: 0, unanswerable: [], unjudged: 0 },
      refusals: [],
      signature: "s",
      to: { knVersion: 6, label: "v1.0.1", version: "1.0.1" },
    });
    renderPublish(
      status({
        nextActions: [
          { accepts: [], action: "review_rollback", allowed: true, discardsDecisions: 0 },
        ],
        release: {
          knVersion: 7,
          networkId: "n",
          rolledBack: false,
          running: null,
          version: "1.0.2",
        },
        stage: "published",
      }),
    );
    expect(screen.getByText("已发布 v1.0.2")).toBeInTheDocument();
    expect(screen.queryByText("审查确认的内容")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^回\s*退$/ }));
    expect(await (await dialog()).findByText("回退到 v1.0.1")).toBeInTheDocument();
    expect(getRollbackPlanMock).toHaveBeenCalledWith("p1", undefined);
  });

  it("says a rolled-back release, offers to publish it again, and no rollback", async () => {
    renderPublish(
      status({
        release: {
          knVersion: 7,
          networkId: "n",
          rolledBack: true,
          running: { knVersion: 6, label: "v1.0.1" },
          version: "1.0.2",
        },
        stage: "published",
      }),
    );
    expect(screen.getByText("已回退，运行版本为 v1.0.1")).toBeInTheDocument();
    expect(screen.queryByText("已发布 v1.0.2")).toBeNull();
    expect(screen.queryByRole("button", { name: /^回\s*退$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新发布" }));
    expect(await (await dialog()).findByText("草稿确认")).toBeInTheDocument();
    expect(getReleaseReviewMock).toHaveBeenCalledWith("p1", "1.0.3");
  });

  it("says it in English when rolled back", async () => {
    await i18n.changeLanguage("en-US");
    renderPublish(
      status({
        release: {
          knVersion: 7,
          networkId: "n",
          rolledBack: true,
          running: { knVersion: 6, label: "v1.0.1" },
          version: "1.0.2",
        },
        stage: "published",
      }),
    );
    expect(screen.getByText("Rolled back; the running version is v1.0.1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish again" })).toBeInTheDocument();
  });

  it("says the first release, and when publishing waits", () => {
    const view = renderPublish(
      status(),
      true,
      versions({
        entries: [],
        versioning: {
          draft: { baseVersion: 0, hasChanges: false, outdated: false },
          fullHistory: true,
          previousVersion: 0,
          runningVersion: 0,
        },
      }),
    );
    expect(
      screen.getByText("网络还没有发布过。发布后，智能体和 MCP 才能读到这个本体。"),
    ).toBeInTheDocument();
    expect(screen.getByText("v1.0.3")).toBeInTheDocument();
    expect(screen.queryByText(/运行版本 /)).toBeNull();
    view.unmount();

    renderPublish(status({ nextActions: [], stage: "checking" }));
    expect(screen.getByText("数据校验通过后才能发布。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "审查并准备发布" })).toBeNull();
  });
});
