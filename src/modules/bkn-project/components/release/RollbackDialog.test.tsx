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
    consumers: ["agents", "mcp", "workshop", "eval"],
    from: { base: false, networkId: "n_v1_0_1", version: "1.0.1" },
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
    schedules: [{ id: "s1", name: "每晚交付预警" }],
    signature: "sig-1",
    to: { base: false, networkId: "n_v1_0_0", version: "1.0.0" },
    ...extra,
  };
}

const refusal = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

function renderDialog(canRollBack = true) {
  const onRolledBack = vi.fn();
  renderWithoutAntdStyles(
    <RollbackDialog
      canRollBack={canRollBack}
      onCancel={vi.fn()}
      onRolledBack={onRolledBack}
      projectId="p1"
    />,
  );
  return { onRolledBack };
}

const confirmButton = () => screen.getByRole("button", { name: "切回使用方" });

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

  it("says what rolling back moves, then switches back with the plan it read", async () => {
    getRollbackPlanMock.mockResolvedValue(plan());
    rollBackMock.mockResolvedValue(undefined);
    const { onRolledBack } = renderDialog();

    expect(await screen.findByText("使用方将从 v1.0.1 切回 v1.0.0。")).toBeInTheDocument();
    expect(screen.getByText(/回退只切换使用方/)).toBeInTheDocument();
    expect(screen.getByText("每晚交付预警")).toBeInTheDocument();
    expect(
      screen.getByText("智能体、MCP 服务、Workshop 应用、评测由各自的负责人切回。"),
    ).toBeInTheDocument();
    expect(screen.getByText(/回退后回答不了的问题/)).toBeInTheDocument();
    expect(screen.getByText("哪些产品用到了 P-100？")).toBeInTheDocument();
    expect(screen.queryByText(/n_v1_0|sig-1/)).toBeNull();

    fireEvent.click(confirmButton());
    await waitFor(() => expect(rollBackMock).toHaveBeenCalledWith("p1", "sig-1"));
    expect(messageMock.success).toHaveBeenCalledWith("使用方已切回 v1.0.0。");
    expect(onRolledBack).toHaveBeenCalled();
  });

  it("names the network before the first release, and reads again a plan that moved", async () => {
    getRollbackPlanMock
      .mockResolvedValueOnce(plan({ to: { base: true, networkId: "n", version: "" } }))
      .mockResolvedValueOnce(plan({ signature: "sig-2" }));
    rollBackMock.mockRejectedValueOnce(refusal(409, "Rollback.PlanOutdated"));
    renderDialog();

    expect(
      await screen.findByText("使用方将从 v1.0.1 切回首次发布前的业务知识网络。"),
    ).toBeInTheDocument();
    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "使用方或定时任务在这之后有变化，已重新读取，请再确认一次。",
      ),
    );
    expect(await screen.findByText("使用方将从 v1.0.1 切回 v1.0.0。")).toBeInTheDocument();
    fireEvent.click(confirmButton());
    await waitFor(() => expect(rollBackMock).toHaveBeenLastCalledWith("p1", "sig-2"));
  });

  it("says why it cannot roll back, and lets only the owner", async () => {
    getRollbackPlanMock.mockResolvedValue(
      plan({ refusals: ["Rollback.NoPrevious"], schedules: [], to: null }),
    );
    renderDialog();
    expect(
      await screen.findByText("使用方已经在用最早的版本，没有可以切回的版本。"),
    ).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByText(/NoPrevious/)).toBeNull();
  });

  it("shows others what it would do, without the button", async () => {
    getRollbackPlanMock.mockResolvedValue(plan());
    renderDialog(false);
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText("只有项目负责人可以回退。")).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
  });

  it("says it in English", async () => {
    await i18n.changeLanguage("en-US");
    getRollbackPlanMock.mockResolvedValue(plan());
    renderDialog();
    expect(
      await screen.findByText("Consumers will switch back from v1.0.1 to v1.0.0."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Their owners switch back: agents, MCP services, Workshop apps, evaluations.",
      ),
    ).toBeInTheDocument();
    await i18n.changeLanguage("zh-CN");
  });
});
