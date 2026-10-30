/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { LineageRelease } from "@/modules/bkn-project/types/release";

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ runtimeConfig: { currentUser: { id: "me" } } }),
}));

vi.mock("@/modules/knowledge-network/hooks/useAccountDirectory", () => ({
  useAccountDirectory: () => new Map([["u2", "张三"]]),
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ReleaseVersions } from "./ReleaseVersions";

const release = (version: string, extra: Partial<LineageRelease> = {}): LineageRelease => ({
  createTime: Date.parse("2026-10-29T08:30:00"),
  networkId: `n_${version}`,
  notes: "",
  projectId: "p1",
  publisherId: "me",
  state: "archived",
  version,
  ...extra,
});

const onOpenRegression = vi.fn();

const section = () => within(screen.getByRole("region", { name: "版本" }));

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
    await i18n.changeLanguage("zh-CN");
  });

  it("lists every version, who published it, and what was accepted, in plain words", () => {
    renderWithoutAntdStyles(
      <ReleaseVersions
        inUseNetworkId="n_1.0.2"
        onOpenRegression={onOpenRegression}
        onRetry={vi.fn()}
        projectId="p1"
        releases={[
          release("1.0.2", {
            notes: "新增订单\nAccepted: 业务方已同意\n\nAccepted: index_not_ready",
            state: "live",
          }),
          release("1.0.1", { projectId: "p2", publisherId: "u2" }),
          release("1.0.0", { publisherId: "gone" }),
        ]}
      />,
    );

    const [, newest, other, oldest] = section().getAllByRole("row");
    expect(within(newest).getByText("v1.0.2")).toBeInTheDocument();
    expect(within(newest).getByText("最新")).toBeInTheDocument();
    expect(within(newest).getByText("使用中")).toBeInTheDocument();
    expect(within(newest).getByText("本项目")).toBeInTheDocument();
    expect(within(newest).getByText("你")).toBeInTheDocument();
    // A line a person wrote like the one bkn-project appends stays theirs.
    expect(within(newest).getByText(/新增订单\s+Accepted: 业务方已同意/)).toBeInTheDocument();
    expect(within(newest).getByText("发布时接受：部分本地索引没有就绪")).toBeInTheDocument();
    expect(within(other).getByText("其他项目")).toBeInTheDocument();
    expect(within(other).getByText("张三")).toBeInTheDocument();
    expect(within(oldest).getByText("其他成员")).toBeInTheDocument();
    // Only the project's own releases ask its scenario questions.
    expect(within(other).queryByRole("button", { name: "回归结果" })).toBeNull();
    fireEvent.click(within(newest).getByRole("button", { name: "回归结果" }));
    expect(onOpenRegression).toHaveBeenCalledWith(expect.objectContaining({ version: "1.0.2" }));
    expect(section().queryByText(/index_not_ready/)).toBeNull();
  });

  it("says when there is none yet, and offers to read them again when they cannot be read", () => {
    const onRetry = vi.fn();
    const view = renderWithoutAntdStyles(
      <ReleaseVersions
        inUseNetworkId={null}
        onOpenRegression={onOpenRegression}
        onRetry={onRetry}
        projectId="p1"
        releases={[]}
      />,
    );
    expect(screen.getByText("还没有发布过版本。")).toBeInTheDocument();
    view.unmount();

    renderWithoutAntdStyles(
      <ReleaseVersions
        inUseNetworkId={null}
        onOpenRegression={onOpenRegression}
        onRetry={onRetry}
        projectId="p1"
        releases="failed"
      />,
    );
    expect(screen.getByText("版本列表暂时读取不到")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});
