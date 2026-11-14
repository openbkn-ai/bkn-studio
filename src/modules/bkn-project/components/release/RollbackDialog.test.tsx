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
import type { RollbackPlan } from "@/modules/bkn-project/types/release";

const getRollbackPlanMock = vi.hoisted(() => vi.fn());
const rollBackMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/release.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/release.service")>()),
  getRollbackPlan: getRollbackPlanMock,
  rollBack: rollBackMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { RollbackDialog } from "./RollbackDialog";

function plan(extra: Partial<RollbackPlan> = {}): RollbackPlan {
  return {
    from: { knVersion: 7, label: "v1.3.0", version: "1.3.0" },
    fullHistory: true,
    questions: {
      affected: [],
      answerableNew: [],
      total: 2,
      unanswerable: [
        {
          id: "q8",
          missing: [{ id: "bom", kind: "object_type", name: "物料清单" }],
          text: "哪些产品用到了 P-100？",
          unconnected: [],
        },
      ],
      unjudged: 0,
    },
    refusals: [],
    signature: "sig-1",
    to: { knVersion: 6, label: "v1.2.1", version: "1.2.1" },
    ...extra,
  };
}

const refusal = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

function renderDialog(canRollBack = true, toVersion?: number) {
  const onRolledBack = vi.fn();
  renderWithoutAntdStyles(
    <RollbackDialog
      canRollBack={canRollBack}
      onCancel={vi.fn()}
      onRolledBack={onRolledBack}
      projectId="p1"
      rollback={toVersion === undefined}
      toVersion={toVersion}
    />,
  );
  return { onRolledBack };
}

const confirmButton = () => screen.getByRole("button", { name: /^切\s?换$/ });

describe("RollbackDialog", () => {
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
  });

  it("says what switching back changes, then switches with the plan it read", async () => {
    getRollbackPlanMock.mockResolvedValue(plan());
    rollBackMock.mockResolvedValue(undefined);
    const { onRolledBack } = renderDialog();

    expect(await screen.findByText("回退到 v1.2.1")).toBeInTheDocument();
    expect(getRollbackPlanMock).toHaveBeenCalledWith("p1", undefined);
    expect(
      screen.getByText(
        "切换后立即生效，智能体、MCP 和调度都改用 v1.2.1，不用改配置。之后还可以再切回 v1.3.0。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1 个场景问题受影响")).toBeInTheDocument();
    expect(screen.getByText("哪些产品用到了 P-100？")).toBeInTheDocument();
    expect(
      screen.getByText("项目里的内容不变。之后再发布时，会提示你确认是否带回这些改动。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sig-1|kn_version/)).toBeNull();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(rollBackMock).toHaveBeenCalledWith("p1", "sig-1", 6));
    expect(messageMock.success).toHaveBeenCalledWith("已切换为 v1.2.1");
    expect(onRolledBack).toHaveBeenCalled();
  });

  it("switches to an earlier version by number, and reads again a plan that moved", async () => {
    getRollbackPlanMock
      .mockResolvedValueOnce(plan({ to: { knVersion: 4, label: "", version: "" } }))
      .mockResolvedValueOnce(
        plan({ signature: "sig-2", to: { knVersion: 4, label: "", version: "" } }),
      );
    rollBackMock.mockRejectedValueOnce(refusal(409, "Rollback.PlanOutdated"));
    renderDialog(true, 4);

    expect(await screen.findByText("切换为运行版本：v4")).toBeInTheDocument();
    expect(getRollbackPlanMock).toHaveBeenCalledWith("p1", 4);
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "运行版本在这之后有变化，已重新读取，请再确认一次。",
      ),
    );
    await waitFor(() => expect(getRollbackPlanMock).toHaveBeenCalledTimes(2));
    const confirm = await screen.findByRole("button", { name: /^切\s?换$/ });
    // The new plan can render before the confirmation button finishes its loading transition.
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(rollBackMock).toHaveBeenLastCalledWith("p1", "sig-2", 4));
  });

  it.each([
    ["Rollback.NoPrevious", "没有可以回退的上一版。"],
    ["Rollback.EditionRestricted", "社区版只能回退到上一版。升级专业版可以切换到任一历史版本。"],
    ["Release.VersionPurged", "这个版本只保留了记录。可以在版本列表里复制为草稿，再重新发布。"],
  ])("says why it cannot switch for %s, in plain words", async (code, text) => {
    getRollbackPlanMock.mockResolvedValue(plan({ refusals: [code], to: null }));
    renderDialog();
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByText(new RegExp(code))).toBeNull();
  });

  it("says when the version refers to what no longer exists", async () => {
    getRollbackPlanMock.mockResolvedValue(plan());
    rollBackMock.mockRejectedValueOnce(refusal(409, "Rollback.BrokenReferences"));
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /^切\s?换$/ }));
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("这个版本引用的内容已经不存在，不能切换。"),
    );
  });

  it("shows others what it would do, without the button", async () => {
    getRollbackPlanMock.mockResolvedValue(plan());
    renderDialog(false);
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText("只有项目负责人可以切换运行版本。")).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("says it in English", async () => {
    await i18n.changeLanguage("en-US");
    getRollbackPlanMock.mockResolvedValue(plan());
    renderDialog();
    expect(await screen.findByText("Roll back to v1.2.1")).toBeInTheDocument();
    await i18n.changeLanguage("zh-CN");
  });
});
