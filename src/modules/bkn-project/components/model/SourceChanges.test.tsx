/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { Draft, SourceChanges } from "@/modules/bkn-project/types/draft";
import type { ProjectStatus } from "@/modules/bkn-project/types/publish";

const getProjectStatusMock = vi.hoisted(() => vi.fn());
const getSourceChangesMock = vi.hoisted(() => vi.fn());
const draftSourceChangesMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/bkn-project/services/publish.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/publish.service")>()),
  getProjectStatus: getProjectStatusMock,
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  draftSourceChanges: draftSourceChangesMock,
  getSourceChanges: getSourceChangesMock,
}));

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { SourceChangesNotice } from "./SourceChanges";

function status(changed: boolean, allowed = true, reason = "not_owner"): ProjectStatus {
  return {
    blockers: [],
    check: null,
    confirmation: null,
    draft: null,
    nextActions: changed
      ? [
          {
            accepts: [],
            action: "draft_source_changes",
            allowed,
            discardsDecisions: 0,
            ...(allowed ? {} : { reason }),
          },
        ]
      : [],
    release: null,
    stage: "confirmed",
    stale: changed ? ["source_changed"] : [],
    undecided: 0,
    unresolvedConflicts: 0,
    unreviewed: 0,
  } as unknown as ProjectStatus;
}

function changes(extra: Partial<SourceChanges> = {}): SourceChanges {
  return {
    missingTables: [],
    objectTypes: [
      {
        changes: [
          {
            change: "added",
            excluded: "",
            field: "credit_limit",
            fieldName: "信用额度",
            fromType: "",
            key: false,
            property: "",
            propertyName: "",
            relations: [],
            toType: "",
            unsupported: false,
          },
          {
            change: "removed",
            excluded: "",
            field: "customer_code",
            fieldName: "",
            fromType: "",
            key: true,
            property: "customer_code",
            propertyName: "客户编码",
            relations: [{ id: "r1", name: "销售订单的客户" }],
            toType: "",
            unsupported: false,
          },
          {
            change: "retyped",
            excluded: "",
            field: "level",
            fieldName: "",
            fromType: "string",
            key: false,
            property: "level",
            propertyName: "客户等级",
            relations: [],
            toType: "integer",
            unsupported: false,
          },
        ],
        id: "customer",
        inDraft: true,
        name: "客户",
        published: true,
        table: "customer_entity",
      },
    ],
    relationTypes: [],
    signature: "sig-1",
    state: "changed",
    ...extra,
  };
}

const refusal = (status: number, code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { error_code: `BknProject.${code}` },
    status,
  } as AxiosResponse);

function renderNotice(archived = false) {
  const onDrafted = vi.fn();
  const view = renderWithoutAntdStyles(
    <SourceChangesNotice
      archived={archived}
      draftUpdateTime={1}
      onDrafted={onDrafted}
      projectId="p1"
    />,
  );
  return { onDrafted, view };
}

const draftButton = () => screen.getByRole("button", { name: "把变化写入草稿" });

describe("SourceChangesNotice", () => {
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

  it("says nothing while the tables are as drafted", async () => {
    getProjectStatusMock.mockResolvedValue(status(false));
    renderNotice();
    await waitFor(() => expect(getProjectStatusMock).toHaveBeenCalled());
    expect(screen.queryByText(/数据表的结构有变化/)).toBeNull();
  });

  it("lists the changes by business name, and writes them into the draft with the read", async () => {
    getProjectStatusMock.mockResolvedValue(status(true));
    getSourceChangesMock.mockResolvedValue(changes());
    const draft = { updateTime: 2 } as Draft;
    draftSourceChangesMock.mockResolvedValue(draft);
    const { onDrafted } = renderNotice();

    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    expect(await screen.findByText("客户（数据表 customer_entity）")).toBeInTheDocument();
    expect(screen.getByText("新增列「信用额度」")).toBeInTheDocument();
    expect(
      screen.getByText(
        "属性「客户编码」对应的列已删除；它是唯一标识或显示字段；依赖这一列的关系类：销售订单的客户",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/属性「客户等级」的类型从.+变为.+/)).toBeInTheDocument();
    expect(screen.getByText(/写入后需要重新确认并发布/)).toBeInTheDocument();
    expect(screen.queryByText(/sig-1|retyped|string|integer/)).toBeNull();

    fireEvent.click(draftButton());
    await waitFor(() => expect(draftSourceChangesMock).toHaveBeenCalledWith("p1", "sig-1"));
    expect(onDrafted).toHaveBeenCalledWith(draft);
    expect(messageMock.success).toHaveBeenCalledWith("变化已写入草稿，请重新确认并发布。");
  });

  it("reads again when the draft or a table moved since", async () => {
    getProjectStatusMock.mockResolvedValue(status(true));
    getSourceChangesMock
      .mockResolvedValueOnce(changes())
      .mockResolvedValueOnce(changes({ signature: "sig-2" }));
    draftSourceChangesMock.mockRejectedValueOnce(refusal(409, "Draft.SourceChangesOutdated"));
    renderNotice();

    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    await screen.findByText("新增列「信用额度」");
    fireEvent.click(draftButton());
    await waitFor(() =>
      expect(messageMock.warning).toHaveBeenCalledWith(
        "草稿或数据表在这之后又有变化，已重新读取，请再确认一次。",
      ),
    );
    await waitFor(() => expect(getSourceChangesMock).toHaveBeenCalledTimes(2));
    await screen.findByText("新增列「信用额度」");
    fireEvent.click(draftButton());
    await waitFor(() => expect(draftSourceChangesMock).toHaveBeenLastCalledWith("p1", "sig-2"));
  });

  it("lets only the owner write, and says when the tables cannot be read", async () => {
    getProjectStatusMock.mockResolvedValue(status(true, false));
    getSourceChangesMock.mockResolvedValueOnce(changes());
    const { view } = renderNotice();
    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    expect(await screen.findByText("只有项目负责人可以把变化写入草稿。")).toBeInTheDocument();
    expect(draftButton()).toBeDisabled();
    view.unmount();

    getProjectStatusMock.mockResolvedValue(status(true));
    getSourceChangesMock.mockResolvedValueOnce(changes({ objectTypes: [], state: "unreachable" }));
    renderNotice();
    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    expect(await screen.findByText("暂时读不到数据表的结构，请稍后再试。")).toBeInTheDocument();
    expect(draftButton()).toBeDisabled();
  });

  it("says why writing is off, as the owner can act on it", async () => {
    getProjectStatusMock.mockResolvedValue(status(true));
    getSourceChangesMock.mockResolvedValue(changes());
    const archived = renderNotice(true);
    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    expect(await screen.findByText("项目已归档，不能修改草稿。")).toBeInTheDocument();
    expect(screen.queryByText("只有项目负责人可以把变化写入草稿。")).toBeNull();
    archived.view.unmount();

    getProjectStatusMock.mockResolvedValue(status(true, false, "running"));
    renderNotice();
    fireEvent.click(await screen.findByRole("button", { name: "查看变化" }));
    expect(await screen.findByText("现在还不能把变化写入草稿，请稍后再试。")).toBeInTheDocument();
    expect(draftButton()).toBeDisabled();
  });

  it("says it in English", async () => {
    await i18n.changeLanguage("en-US");
    getProjectStatusMock.mockResolvedValue(status(true));
    getSourceChangesMock.mockResolvedValue(changes());
    renderNotice();
    fireEvent.click(await screen.findByRole("button", { name: "View changes" }));
    expect(await screen.findByText('New column "信用额度"')).toBeInTheDocument();
    await i18n.changeLanguage("zh-CN");
  });
});
