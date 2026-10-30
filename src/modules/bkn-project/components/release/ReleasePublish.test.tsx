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
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";
import type { ReleaseReview } from "@/modules/bkn-project/types/release";

const getReleaseReviewMock = vi.hoisted(() => vi.fn());
const publishReleaseMock = vi.hoisted(() => vi.fn());
const syncBranchMock = vi.hoisted(() => vi.fn());
const getSwitchPlanMock = vi.hoisted(() => vi.fn());
const switchConsumersMock = vi.hoisted(() => vi.fn());
const getRegressionMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/release.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/release.service")>()),
  commitDrift: vi.fn(),
  getRegression: getRegressionMock,
  getReleaseReview: getReleaseReviewMock,
  getSwitchPlan: getSwitchPlanMock,
  publishRelease: publishReleaseMock,
  switchConsumers: switchConsumersMock,
  syncBranch: syncBranchMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ReleasePublish } from "./ReleasePublish";

function status(extra: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    blockers: [],
    check: { current: true, status: "passed" },
    confirmation: { current: true, time: 1 },
    dataSources: null,
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
    risks: { copies: 0, existing: [], onlyAdditions: true, orphans: [] },
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

function renderPublish(projectStatus = status(), canPublish = true) {
  return renderWithoutAntdStyles(
    <ReleasePublish
      baseNetworkId="n"
      canPublish={canPublish}
      onChanged={onChanged}
      onOpenRegression={onOpenRegression}
      projectId="p1"
      status={projectStatus}
      versionOf={(networkId) => ({ n_v1_0_1: "1.0.1" })[networkId]}
    />,
  );
}

const dialog = async () => within(await screen.findByRole("dialog"));
const publishButton = () => screen.getByRole("button", { name: "发布 v1.0.3" });

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

  it("reviews the release in plain words, and publishes once the owner accepts what did not pass", async () => {
    publishReleaseMock.mockResolvedValue({ networkId: "n_v1_0_3" });
    renderPublish();

    expect(
      screen.getByText("数据校验已通过，可以发布为 v1.0.3。发布前先看一遍发布审核。"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
    const view = await dialog();
    expect(await view.findByText("草稿确认")).toBeInTheDocument();
    expect(
      view.getByText(
        "3 / 4 张表的本地索引可用。全文检索和向量检索要等索引就绪，其他查询不受影响。",
      ),
    ).toBeInTheDocument();
    expect(
      view.getByText("将创建新版本「供应链 · 1.0.3」，基于线上的 v1.0.2。"),
    ).toBeInTheDocument();
    expect(view.getByText("订单")).toBeInTheDocument();
    expect(view.getByText("这次只新增内容，不改动线上已有的内容。")).toBeInTheDocument();
    expect(view.getByText("哪些产品用到了 P-100？")).toBeInTheDocument();
    expect(view.getByText("缺少：物料BOM")).toBeInTheDocument();
    expect(view.queryByText(/index_not_ready|object_type/)).toBeNull();

    expect(publishButton()).toBeDisabled();
    fireEvent.click(view.getByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.change(view.getByLabelText("发布说明"), { target: { value: " 新增订单 " } });
    fireEvent.click(publishButton());

    await waitFor(() =>
      expect(publishReleaseMock).toHaveBeenCalledWith("p1", {
        accepts: ["index_not_ready"],
        notes: "新增订单",
        signature: "sig-1",
        version: "1.0.3",
      }),
    );
    expect(messageMock.success).toHaveBeenCalledWith("v1.0.3 已发布，场景问题的回归已在后台开始。");
    expect(onChanged).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
    const view = await dialog();
    expect(await view.findByText("新增 300")).toBeInTheDocument();
    expect(view.getByText(long)).toBeInTheDocument();
    expect(view.queryByText("Object 30")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "显示全部 300 项" }));
    expect(view.getByText("Object 299")).toBeInTheDocument();
  });

  it("reads the review again when the draft or the live version moved since", async () => {
    publishReleaseMock.mockRejectedValue(refusal("Release.ReviewOutdated"));
    renderPublish();

    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
    const view = await dialog();
    fireEvent.click(await view.findByText("知道部分索引还没就绪，仍然发布"));
    fireEvent.click(publishButton());

    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "检查之后草稿或线上版本又变了，已重新检查，请再看一遍。",
      ),
    );
    await waitFor(() => expect(getReleaseReviewMock).toHaveBeenCalledTimes(2));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reviews another version only after checking it again", async () => {
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
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

    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
    const view = await dialog();
    expect(await view.findByText("这个版本号已经发布过，请换一个。")).toBeInTheDocument();
    expect(
      view.getByText("线上已发布 v1.0.2，项目还基于更早的版本，需要先同步。"),
    ).toBeInTheDocument();
    // A reason the page does not know reads as one, not as its code.
    expect(view.getByText("这项检查没有通过。")).toBeInTheDocument();
    expect(publishButton()).toBeDisabled();

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

    fireEvent.click(screen.getByRole("button", { name: "发布审核 v1.0.3" }));
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
    expect(publishButton()).toBeDisabled();
  });

  it("lets others read the review, never publish", async () => {
    renderPublish(status(), false);

    fireEvent.click(screen.getByRole("button", { name: "查看发布审核" }));
    const view = await dialog();
    expect(await view.findByText("草稿确认")).toBeInTheDocument();
    expect(view.getByRole("checkbox")).toBeDisabled();
    expect(view.queryByLabelText("发布说明")).toBeNull();
    expect(screen.queryByRole("button", { name: "发布 v1.0.3" })).toBeNull();
  });

  it("asks to switch consumers once published, showing what moves", async () => {
    getSwitchPlanMock.mockResolvedValue({
      fromNetworkId: "n_v1_0_1",
      schedules: [{ id: "s1", name: "每晚交付预警" }],
      toNetworkId: "n_v1_0_2",
    });
    switchConsumersMock.mockResolvedValue(undefined);
    getRegressionMock.mockResolvedValue({
      attempt: 1,
      error: "",
      finishTime: 2,
      networkId: "n_v1_0_2",
      questions: [],
      results: [
        { outcome: "passed", questionId: "q1" },
        { outcome: "not_answered", questionId: "q7" },
      ],
      runnerId: "me",
      startTime: 1,
      status: "not_passed",
      version: "1.0.2",
    });
    renderPublish(
      status({
        nextActions: [
          { accepts: [], action: "switch_consumers", allowed: true, discardsDecisions: 0 },
        ],
        release: { inUse: false, networkId: "n_v1_0_2", version: "1.0.2" },
        stage: "published",
      }),
    );

    expect(screen.getByText("已发布 v1.0.2")).toBeInTheDocument();
    // How the release's scenario questions did, said beside it.
    expect(await screen.findByText("1 / 2 次提问通过")).toBeInTheDocument();
    expect(getRegressionMock).toHaveBeenCalledWith("p1", "n_v1_0_2");
    fireEvent.click(screen.getByRole("button", { name: "查看回归结果" }));
    expect(onOpenRegression).toHaveBeenCalled();
    expect(screen.getByText("v1.0.2 已发布，但使用方还在用之前的版本。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换使用方" }));
    const view = await dialog();
    expect(await view.findByText("使用方将从 v1.0.1 切换到 v1.0.2。")).toBeInTheDocument();
    expect(view.getByText("每晚交付预警")).toBeInTheDocument();
    expect(view.getByText("智能体等其他使用方由各自的负责人切换。")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /切\s*换/ }));
    await waitFor(() => expect(switchConsumersMock).toHaveBeenCalledWith("p1", "n_v1_0_2"));
    expect(messageMock.success).toHaveBeenCalledWith("使用方已切换到 v1.0.2。");
    expect(onChanged).toHaveBeenCalled();
  });

  it("says the original network only when consumers are on it, never for an unread version", async () => {
    const published = status({
      nextActions: [
        { accepts: [], action: "switch_consumers", allowed: true, discardsDecisions: 0 },
      ],
      release: { inUse: false, networkId: "n_v1_0_2", version: "1.0.2" },
      stage: "published",
    });
    getSwitchPlanMock.mockResolvedValueOnce({
      fromNetworkId: "n",
      schedules: [],
      toNetworkId: "n_v1_0_2",
    });
    const view = renderPublish(published);
    fireEvent.click(screen.getByRole("button", { name: "切换使用方" }));
    expect(
      await screen.findByText("使用方将从最初的业务知识网络切换到 v1.0.2。"),
    ).toBeInTheDocument();
    expect(screen.getByText("当前没有要转移的定时任务。")).toBeInTheDocument();
    view.unmount();

    // A release the versions list has not read yet is the one in use, not the original.
    getSwitchPlanMock.mockResolvedValueOnce({
      fromNetworkId: "n_v1_0_0",
      schedules: [],
      toNetworkId: "n_v1_0_2",
    });
    renderPublish(published);
    fireEvent.click(screen.getByRole("button", { name: "切换使用方" }));
    expect(await screen.findByText("使用方将从当前在用的版本切换到 v1.0.2。")).toBeInTheDocument();
    expect(screen.queryByText(/最初的业务知识网络/)).toBeNull();
  });

  it("tells others the owner switches consumers, and says when publishing waits", () => {
    const view = renderPublish(
      status({
        nextActions: [
          {
            accepts: [],
            action: "switch_consumers",
            allowed: false,
            discardsDecisions: 0,
            reason: "not_owner",
          },
        ],
        release: { inUse: false, networkId: "n_v1_0_2", version: "1.0.2" },
        stage: "published",
      }),
      false,
    );
    expect(screen.getByText("只有项目负责人可以切换使用方。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "切换使用方" })).toBeNull();
    view.unmount();

    renderPublish(status({ nextActions: [], stage: "checking" }));
    expect(screen.getByText("数据校验通过后才能发布。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /发布审核/ })).toBeNull();
  });
});
