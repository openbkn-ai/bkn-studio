/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { ProjectNextAction, ProjectStatus } from "@/modules/bkn-project/types/publish";

const getProjectStatusMock = vi.hoisted(() => vi.fn());
const getProjectPendingMock = vi.hoisted(() => vi.fn());
const confirmDraftMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  confirmDraft: confirmDraftMock,
  getProjectPending: getProjectPendingMock,
  getProjectStatus: getProjectStatusMock,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ConfirmDraft } from "./ConfirmDraftDialog";

const draft = mapDraft(mockDraft("p1"));

function status(action: Partial<ProjectNextAction> | null, extra: Partial<ProjectStatus> = {}) {
  return {
    blockers: [],
    check: null,
    confirmation: null,
    dataSources: null,
    draft: { decisions: 0, placeholders: 0, status: "ready", updateTime: draft.updateTime },
    nextActions: action
      ? [{ accepts: [], action: "confirm_draft", allowed: true, discardsDecisions: 0, ...action }]
      : [],
    release: null,
    stage: "ready_to_confirm",
    stale: [],
    undecided: 0,
    unresolvedConflicts: 0,
    ...extra,
  } satisfies ProjectStatus;
}

function refusal(code: string, details?: unknown) {
  return new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { description: "raw", error_code: `BknProject.${code}`, error_details: details },
    status: 409,
  } as AxiosResponse);
}

const onConfirmed = vi.fn();
const onShowPending = vi.fn();
const onStale = vi.fn();

function renderConfirm() {
  return renderWithoutAntdStyles(
    <ConfirmDraft
      draft={draft}
      onConfirmed={onConfirmed}
      onShowPending={onShowPending}
      onStale={onStale}
      projectId="p1"
    />,
  );
}

const okButton = () =>
  within(screen.getByRole("dialog")).getByRole("button", { name: /^确\s*认$/ });

describe("ConfirmDraft", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
    getProjectPendingMock.mockResolvedValue({ draftUpdateTime: draft.updateTime, items: [] });
  });

  it("confirms only once the owner accepts what is left out, then moves on", async () => {
    getProjectStatusMock.mockResolvedValue(
      status({ accepts: ["partial_draft", "undecided_items"] }),
    );
    getProjectPendingMock.mockResolvedValue({
      draftUpdateTime: draft.updateTime,
      items: [
        {
          blocking: false,
          because: "few_values",
          itemId: "r9",
          kind: "relation_types",
          name: "订单到仓库",
          neededBy: [{ id: "q4", text: "这批订单从哪个仓库发货？" }],
          reason: "undecided",
        },
        // Blocking items stop the button, not the dialog: they are not listed to accept.
        {
          blocking: true,
          itemId: "x",
          kind: "object_types",
          name: "阻断项",
          neededBy: [],
          reason: "needs_identity",
        },
      ],
    });
    confirmDraftMock.mockResolvedValue(draft);
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText("订单到仓库")).toBeInTheDocument();
    expect(dialog.getByText("字段取值太少，关联可能是巧合")).toBeInTheDocument();
    // Leaving it out leaves the question it is needed by unanswered.
    expect(dialog.getByText("不纳入的话，这些问题答不上来：")).toBeInTheDocument();
    expect(dialog.getByText("这批订单从哪个仓库发货？")).toBeInTheDocument();
    expect(dialog.queryByText("阻断项")).toBeNull();
    expect(dialog.getByText(draft.items.unreadable[0].name)).toBeInTheDocument();
    expect(dialog.getByText(/确认后会自动校验数据/)).toBeInTheDocument();

    expect(okButton()).toBeDisabled();
    fireEvent.click(dialog.getByText("暂不纳入这些项"));
    expect(okButton()).toBeDisabled();
    fireEvent.click(dialog.getByText("知道这些表没有参与起草，仍然确认"));
    fireEvent.click(okButton());

    await waitFor(() =>
      expect(confirmDraftMock).toHaveBeenCalledWith("p1", {
        acceptPartial: true,
        acceptUndecided: true,
        updateTime: draft.updateTime,
      }),
    );
    expect(messageMock.success).toHaveBeenCalledWith("草稿已确认");
    expect(onConfirmed).toHaveBeenCalled();
  });

  it("asks to accept the requirement conflicts the status says confirming leaves", async () => {
    getProjectStatusMock.mockResolvedValue(
      status({ accepts: ["unresolved_conflicts"] }, { unresolvedConflicts: 2 }),
    );
    confirmDraftMock.mockResolvedValue(draft);
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(okButton()).toBeDisabled();
    fireEvent.click(dialog.getByText("还有 2 个需求冲突没有裁决，仍然确认"));
    fireEvent.click(okButton());

    await waitFor(() =>
      expect(confirmDraftMock).toHaveBeenCalledWith("p1", {
        acceptUnresolvedConflicts: true,
        updateTime: draft.updateTime,
      }),
    );
  });

  it("asks for the conflicts a refusal names when the status did not say", async () => {
    getProjectStatusMock.mockResolvedValue(status({}));
    confirmDraftMock
      .mockRejectedValueOnce(refusal("Draft.ConflictsNotAccepted", ["k1"]))
      .mockResolvedValue(draft);
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(okButton());
    // The dialog stays open with what to accept, rather than "try again later".
    expect(await dialog.findByText("还有 1 个需求冲突没有裁决，仍然确认")).toBeInTheDocument();
    expect(messageMock.warning).toHaveBeenCalledWith(
      "还有需求冲突没有裁决。勾选下方的「仍然确认」后再确认草稿。",
    );
    expect(messageMock.error).not.toHaveBeenCalled();
    await waitFor(() => expect(okButton()).toBeDisabled());

    fireEvent.click(dialog.getByText("还有 1 个需求冲突没有裁决，仍然确认"));
    fireEvent.click(okButton());
    await waitFor(() =>
      expect(confirmDraftMock).toHaveBeenLastCalledWith("p1", {
        acceptUnresolvedConflicts: true,
        updateTime: draft.updateTime,
      }),
    );
    expect(onConfirmed).toHaveBeenCalled();
  });

  it("forgets a refusal's conflicts once the dialog opens again", async () => {
    getProjectStatusMock.mockResolvedValue(status({}));
    confirmDraftMock.mockRejectedValueOnce(refusal("Draft.ConflictsNotAccepted", ["k1", "k2"]));
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    fireEvent.click(okButton());
    expect(await screen.findByText("还有 2 个需求冲突没有裁决，仍然确认")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    // Ruled on meanwhile: the status no longer asks, so neither does the dialog.
    fireEvent.click(screen.getByRole("button", { name: "确认草稿" }));
    await screen.findByRole("dialog");
    await waitFor(() => expect(okButton()).toBeEnabled());
    expect(screen.queryByText(/需求冲突没有裁决/)).toBeNull();
  });

  it("says why the draft cannot be confirmed yet", async () => {
    getProjectStatusMock.mockResolvedValue(
      status(
        { allowed: false, reason: "needs_identity" },
        { blockers: [{ code: "needs_identity", count: 2, waitingFor: "editor" }] },
      ),
    );
    renderConfirm();

    const button = await screen.findByRole("button", { name: "确认草稿" });
    expect(button).toBeDisabled();
    fireEvent.mouseEnter(button.parentElement!);
    expect(await screen.findByText("2 个已采纳的对象类还需要选定唯一标识")).toBeInTheDocument();
  });

  it("offers to confirm again after a change, and says when the draft is confirmed", async () => {
    getProjectStatusMock.mockResolvedValueOnce(
      status({}, { confirmation: { current: false, time: 1 }, stale: ["confirmation_outdated"] }),
    );
    const view = renderConfirm();
    fireEvent.click(await screen.findByRole("button", { name: "重新确认" }));
    expect(
      await screen.findByText("会替换上次确认写入的内容，项目中的其他定义不受影响。"),
    ).toBeInTheDocument();
    view.unmount();

    getProjectStatusMock.mockResolvedValueOnce(
      status(null, { confirmation: { current: true, time: 1 }, stage: "confirmed" }),
    );
    renderConfirm();
    // A draft confirmed as it is says so, and leads to the confirmation's results.
    const confirmed = await screen.findByRole("button", { name: /^已于 .+ 确认$/ });
    expect(screen.queryByRole("button", { name: /确认草稿|重新确认/ })).toBeNull();
    fireEvent.click(confirmed);
    expect(onConfirmed).toHaveBeenCalled();
  });

  it("says when it cannot tell whether the draft may be confirmed, and reads again", async () => {
    getProjectStatusMock.mockRejectedValueOnce(new Error("down")).mockResolvedValue(status({}));
    renderConfirm();

    const retry = await screen.findByRole("button", { name: /重\s*试/ });
    expect(screen.getByRole("button", { name: "确认草稿" })).toBeDisabled();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "确认草稿" }).parentElement!);
    expect(await screen.findByText("确认情况暂时读取不到")).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "确认草稿" })).toBeEnabled());
  });

  it("keeps only the newest status when reads answer out of order", async () => {
    let answerFirst: (value: ProjectStatus) => void = () => undefined;
    getProjectStatusMock
      .mockImplementationOnce(
        () =>
          new Promise<ProjectStatus>((resolve) => {
            answerFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(status({}));
    const view = renderConfirm();
    view.rerender(
      <ConfirmDraft
        draft={{ ...draft, updateTime: draft.updateTime + 1 }}
        onConfirmed={onConfirmed}
        onShowPending={onShowPending}
        onStale={onStale}
        projectId="p1"
      />,
    );
    expect(await screen.findByRole("button", { name: "确认草稿" })).toBeEnabled();

    // The read for the older draft answers last: it no longer counts.
    answerFirst(status({ allowed: false, reason: "not_owner" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("button", { name: "确认草稿" })).toBeEnabled();
  });

  it("leads to the items to settle, or reloads a changed draft", async () => {
    getProjectStatusMock.mockResolvedValue(status({}));
    confirmDraftMock.mockRejectedValueOnce(refusal("Draft.HasPending", { needs_identity: ["a"] }));
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    await screen.findByRole("dialog");
    fireEvent.click(okButton());
    await waitFor(() => expect(onShowPending).toHaveBeenCalled());
    expect(messageMock.warning).toHaveBeenCalledWith(
      "还有需要先处理的项，请在“变更”中处理后再确认",
    );

    confirmDraftMock.mockRejectedValueOnce(refusal("Draft.Stale"));
    fireEvent.click(screen.getByRole("button", { name: "确认草稿" }));
    await screen.findByRole("dialog");
    fireEvent.click(okButton());
    await waitFor(() => expect(onStale).toHaveBeenCalled());
  });

  it("asks again when new items wait, and names definitions that already exist", async () => {
    getProjectStatusMock
      .mockResolvedValueOnce(status({}))
      .mockResolvedValue(status({ accepts: ["undecided_items"] }));
    confirmDraftMock
      .mockRejectedValueOnce(refusal("Draft.UndecidedNotAccepted", ["relation_types/r9"]))
      .mockRejectedValueOnce(refusal("Lineage.DefinitionsExist", ["object_types/customers.bkn"]));
    renderConfirm();

    fireEvent.click(await screen.findByRole("button", { name: "确认草稿" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(okButton());
    // The dialog stays open with what to accept now.
    expect(await dialog.findByText("暂不纳入这些项")).toBeInTheDocument();
    expect(messageMock.warning).toHaveBeenCalledWith("有新的未决项，请查看后再确认");

    fireEvent.click(dialog.getByText("暂不纳入这些项"));
    fireEvent.click(okButton());
    const customers = draft.items.objectTypes.find((item) => item.id === "customers")!;
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith(
        `项目中已有同名的定义，不能覆盖：${customers.name}`,
      ),
    );
  });
});
