/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { NetworkVersion, ProjectVersions } from "@/modules/bkn-project/types/release";

const getRegressionMock = vi.hoisted(() => vi.fn());
const getRollbackPlanMock = vi.hoisted(() => vi.fn());
const copyVersionMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock, runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => new Map([["u2", "张三"]]),
}));

vi.mock("@/modules/bkn-project/services/release.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/release.service")>()),
  copyVersion: copyVersionMock,
  getRegression: getRegressionMock,
  getRollbackPlan: getRollbackPlanMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ReleaseVersions } from "./ReleaseVersions";

const entry = (version: number, extra: Partial<NetworkVersion> = {}): NetworkVersion => ({
  baseVersion: version - 1,
  createTime: Date.parse("2026-10-29T08:30:00"),
  label: `v1.${version}.0`,
  notes: "",
  origin: "project",
  publisherId: "me",
  release: `1.${version}.0`,
  status: "history",
  version,
  ...extra,
});

function versions(fullHistory = true): ProjectVersions {
  return {
    entries: [
      entry(7, { notes: "增加故障部位\nAccepted: index_not_ready", status: "running" }),
      entry(6, { publisherId: "u2" }),
      entry(5, { publisherId: "u9", publisherName: "李四" }),
      entry(4, { label: "", origin: "workspace", release: "", status: "deprecated" }),
      entry(3, { origin: "other_project" }),
    ],
    prepared: null,
    versioning: {
      draft: { baseVersion: 7, hasChanges: false, outdated: false },
      fullHistory,
      previousVersion: 6,
      runningVersion: 7,
    },
  };
}

const onChanged = vi.fn();
const onOpenRegression = vi.fn();

function renderVersions(value: ProjectVersions | "failed" | null, canManage = true) {
  return renderWithoutAntdStyles(
    <ReleaseVersions
      canManage={canManage}
      onChanged={onChanged}
      onOpenRegression={onOpenRegression}
      onRetry={vi.fn()}
      projectId="p1"
      versions={value}
    />,
  );
}

const section = () => within(screen.getByRole("region", { name: /^版本/ }));
/** The row whose version cell names the version. */
const rowOf = (name: string) =>
  section()
    .getAllByRole("row")
    .find((row) =>
      within(row).queryAllByRole("cell")[0]?.textContent?.startsWith(name),
    ) as HTMLElement;

describe("ReleaseVersions", () => {
  beforeAll(() => {
    // Ant Design's table reads breakpoints, which jsdom lacks.
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
    getRegressionMock.mockResolvedValue({
      results: [{ outcome: "passed" }, { outcome: "passed" }, { outcome: "not_answered" }],
      status: "not_passed",
    });
  });

  it("lists every version with its state, base, notes, publisher, source and regression", async () => {
    renderVersions(versions());

    expect(section().getByText("专业版")).toBeInTheDocument();
    expect(
      section().getByText(
        "保留全部历史版本。任一历史版本都可以切换为运行版本，或复制为草稿后修改。",
      ),
    ).toBeInTheDocument();
    for (const header of [
      "版本",
      "状态",
      "基于",
      "发布说明",
      "发布人",
      "来源",
      "场景回归",
      "操作",
    ]) {
      expect(section().getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const running = rowOf("v1.7.0");
    expect(within(running).getByText("运行中")).toBeInTheDocument();
    expect(within(running).getByText("第 7 版")).toBeInTheDocument();
    expect(within(running).getAllByRole("cell")[2]).toHaveTextContent("v1.6.0");
    expect(within(running).getByText("增加故障部位")).toBeInTheDocument();
    expect(within(running).getByText("发布时接受：部分本地索引没有就绪")).toBeInTheDocument();
    expect(within(running).getByText("你")).toBeInTheDocument();
    expect(within(running).getByText("本项目")).toBeInTheDocument();
    expect(await within(running).findByText("2 / 3 通过")).toBeInTheDocument();
    expect(within(running).queryByText(/切换为运行版本|回退到此版本/)).toBeNull();

    expect(within(rowOf("v1.6.0")).getByText("张三")).toBeInTheDocument();
    expect(within(rowOf("v1.6.0")).getByText("回退到此版本")).toBeInTheDocument();
    expect(within(rowOf("v1.5.0")).getByText("切换为运行版本")).toBeInTheDocument();
    // A name the reply carries is shown to anyone, even one who may not list users.
    expect(within(rowOf("v1.5.0")).getByText("李四")).toBeInTheDocument();
    const workspace = rowOf("第 4 版");
    expect(within(workspace).getByText("已废止")).toBeInTheDocument();
    expect(within(workspace).getByText("工作区")).toBeInTheDocument();
    expect(within(workspace).getByText("没有回归")).toBeInTheDocument();
    expect(within(workspace).queryByText("切换为运行版本")).toBeNull();
    expect(within(workspace).getByText("复制为草稿")).toBeInTheDocument();
    expect(within(rowOf("v1.3.0")).getByText("其他项目")).toBeInTheDocument();
    expect(section().queryByText(/index_not_ready|workspace|deprecated/)).toBeNull();

    fireEvent.click(await within(running).findByText("2 / 3 通过"));
    expect(onOpenRegression).toHaveBeenCalledWith("1.7.0");
  });

  it("shows only the running and the previous version in the community edition", () => {
    renderVersions(versions(false));

    expect(section().queryByText("专业版")).toBeNull();
    expect(section().getByText(/社区版保留运行版本和上一版/)).toBeInTheDocument();
    expect(rowOf("v1.7.0")).toBeTruthy();
    expect(rowOf("v1.6.0")).toBeTruthy();
    expect(rowOf("v1.5.0")).toBeUndefined();

    fireEvent.click(section().getByText("查看更早的版本（只有记录，共 3 个）"));
    const earlier = rowOf("v1.5.0");
    expect(within(earlier).getByText("只有记录")).toBeInTheDocument();
    expect(within(earlier).queryByText("切换为运行版本")).toBeNull();
    expect(within(earlier).getByText("复制为草稿")).toBeInTheDocument();
    fireEvent.click(section().getByText("收起更早的版本"));
    expect(rowOf("v1.5.0")).toBeUndefined();
  });

  it("opens the switch for a version, by its number", async () => {
    getRollbackPlanMock.mockReturnValue(new Promise(() => undefined));
    renderVersions(versions());
    fireEvent.click(within(rowOf("v1.5.0")).getByText("切换为运行版本"));
    await waitFor(() => expect(getRollbackPlanMock).toHaveBeenCalledWith("p1", 5));
  });

  it("copies a record-only version from the project's history", async () => {
    copyVersionMock.mockResolvedValue(undefined);
    renderVersions(versions(false));
    fireEvent.click(section().getByText("查看更早的版本（只有记录，共 3 个）"));
    fireEvent.click(within(rowOf("v1.5.0")).getByText("复制为草稿"));

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("复制 v1.5.0 为草稿")).toBeInTheDocument();
    expect(dialog.getByText(/社区版只保留了这个版本的记录/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: /^复\s?制$/ }));
    await waitFor(() => expect(copyVersionMock).toHaveBeenCalledWith("p1", 5, false));
    expect(messageMock.success).toHaveBeenCalledWith("已复制 v1.5.0，请到概念建模继续修改");
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers no actions to others", () => {
    renderVersions(versions(), false);
    expect(section().queryByText("复制为草稿")).toBeNull();
    expect(section().queryByRole("columnheader", { name: "操作" })).toBeNull();
  });

  it("says when there is none, and when they cannot be read", () => {
    const { unmount } = renderVersions({ ...versions(), entries: [] });
    expect(section().getByText("还没有发布过版本。")).toBeInTheDocument();
    unmount();
    renderVersions("failed");
    expect(screen.getByText("版本列表暂时读取不到")).toBeInTheDocument();
  });
});
