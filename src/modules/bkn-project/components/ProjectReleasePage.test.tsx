/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { OntologyCheck, ProjectStatus } from "@/modules/bkn-project/types/publish";

const getProjectStatusMock = vi.hoisted(() => vi.fn());
const getOntologyCheckMock = vi.hoisted(() => vi.fn());
const runOntologyCheckMock = vi.hoisted(() => vi.fn());
const getDraftMock = vi.hoisted(() => vi.fn());
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
  getOntologyCheck: getOntologyCheckMock,
  // The local indexes have their own tests.
  getOntologyIndex: () => Promise.resolve(null),
  getProjectStatus: getProjectStatusMock,
  runOntologyCheck: runOntologyCheckMock,
}));

vi.mock("@/modules/bkn-project/services/draft.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/bkn-project/services/draft.service")>()),
  getDraft: getDraftMock,
}));

import { mapDraft, mockDraft } from "@/modules/bkn-project/services/draft.service";
import { CHECK_POLL_MS } from "@/modules/bkn-project/services/publish.service";
import type { Project } from "@/modules/bkn-project/types/project";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ProjectReleasePage } from "./ProjectReleasePage";

const draft = mapDraft(mockDraft("p1"));
const customers = draft.items.objectTypes.find((item) => item.id === "customers")!;
const relation = draft.items.relationTypes[0];

const project: Project = {
  archived: false,
  baselineNetworkId: "n",
  branch: "project/p1",
  catalogIds: ["cat-001"],
  createTime: 1,
  id: "p1",
  knId: "n",
  name: "p",
  otherProjects: 0,
  owner: { id: "me", type: "user" },
  updateTime: 1,
};

const confirmedAt = Date.parse("2026-10-29T08:30:00");

function status(extra: Partial<ProjectStatus> = {}): ProjectStatus {
  return {
    blockers: [],
    check: { current: true, status: "passed" },
    confirmation: { current: true, time: confirmedAt },
    draft: { decisions: 0, placeholders: 0, status: "ready", updateTime: 1 },
    nextActions: [],
    stage: "confirmed",
    stale: [],
    undecided: 0,
    ...extra,
  };
}

function check(extra: Partial<OntologyCheck> = {}): OntologyCheck {
  return {
    attempt: 1,
    error: "",
    finishTime: 2,
    results: {
      coverage: { counted: 2, total: 3 },
      excludedMapped: [],
      keys: [
        {
          duplicates: 0,
          fields: ["customer_id"],
          nulls: 0,
          objectType: "customers",
          rows: 120,
          state: "counted",
        },
      ],
      relations: [
        {
          joins: [
            {
              hitRate: 0.995,
              nulls: 0,
              objectType: "customers",
              orphans: 4,
              rows: 800,
              state: "counted",
            },
          ],
          relationType: relation.id,
        },
      ],
    },
    startTime: 1,
    status: "passed",
    ...extra,
  };
}

const onGoToModel = vi.fn();

function renderRelease(override: { archived?: boolean; ownerIsCaller?: boolean } = {}) {
  return renderWithoutAntdStyles(
    <ProjectReleasePage
      onGoToModel={onGoToModel}
      ownerIsCaller={override.ownerIsCaller ?? true}
      project={{ ...project, archived: override.archived ?? false }}
    />,
  );
}

describe("ProjectReleasePage", () => {
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

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("zh-CN");
    getDraftMock.mockResolvedValue(draft);
    getProjectStatusMock.mockResolvedValue(status());
    getOntologyCheckMock.mockResolvedValue(check());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("leads to ontology modeling before the draft is confirmed", async () => {
    getProjectStatusMock.mockResolvedValue(status({ check: null, confirmation: null }));
    renderRelease();

    expect(await screen.findByText("草稿还没有确认")).toBeInTheDocument();
    expect(getOntologyCheckMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "去本体建模" }));
    expect(onGoToModel).toHaveBeenCalled();
  });

  it("shows when the draft was confirmed and what the check found, by name", async () => {
    renderRelease();

    expect(await screen.findByText(/^已于 2026\/10\/29 08:30 确认$/)).toBeInTheDocument();
    const section = within(screen.getByRole("region", { name: "数据校验" }));
    expect(section.getByText("通过")).toBeInTheDocument();
    expect(section.getByText("已核对 2 / 3 项")).toBeInTheDocument();
    expect(section.getAllByText(customers.name).length).toBeGreaterThan(0);
    expect(section.getByText(relation.name)).toBeInTheDocument();
    expect(section.getByText("99.5%")).toBeInTheDocument();
    expect(section.getByText("找不到对应记录只作提示，不影响校验结果。")).toBeInTheDocument();
  });

  it("explains issues and counts that were not made, without raw reasons", async () => {
    getOntologyCheckMock.mockResolvedValue(
      check({
        results: {
          coverage: { counted: 1, total: 3 },
          excludedMapped: [{ field: "phone", objectType: "customers", property: "phone" }],
          keys: [
            {
              duplicates: 3,
              fields: ["customer_id"],
              nulls: 1,
              objectType: "customers",
              rows: 120,
              state: "counted",
            },
            {
              duplicates: 0,
              fields: [],
              nulls: 0,
              objectType: "sales_orders",
              reason: "timeout",
              rows: 0,
              state: "failed",
            },
          ],
          relations: [
            {
              joins: [
                {
                  hitRate: 0,
                  nulls: 0,
                  objectType: "customers",
                  orphans: 0,
                  reason: "cross_catalog",
                  rows: 0,
                  state: "not_counted",
                },
              ],
              relationType: relation.id,
            },
          ],
        },
        status: "issues",
      }),
    );
    renderRelease();

    const section = within(await screen.findByRole("region", { name: "数据校验" }));
    expect(await section.findByText("发现问题")).toBeInTheDocument();
    expect(section.getByText("有重复或空值")).toBeInTheDocument();
    expect(section.getByText("读取数据超时")).toBeInTheDocument();
    expect(section.getByText("两张表在不同的数据目录，无法核对")).toBeInTheDocument();
    expect(
      section.getByText(`对象类 ${customers.name} 的属性 phone 对应了因隐私规则排除的字段 phone`),
    ).toBeInTheDocument();
    expect(section.queryByText(/timeout|cross_catalog/)).toBeNull();
    // Counts stay on one line; a reason is a sentence and wraps in its cell.
    expect(section.getByText("读取数据超时").closest("td")?.className).not.toMatch(/nowrap/);
    expect(section.getAllByText("结果")[0].closest("th")?.className).toMatch(/nowrap/);
    expect(section.getAllByText("重复")[0].closest("th")?.className).toMatch(/nowrap/);
  });

  it("says when the draft changed after it was confirmed, and leads back to confirm", async () => {
    getProjectStatusMock.mockResolvedValue(
      status({
        check: { current: false, status: "passed" },
        confirmation: { current: false, time: confirmedAt },
        stale: ["confirmation_outdated", "check_outdated"],
      }),
    );
    renderRelease();

    expect(
      await screen.findByText("确认之后草稿又有修改，这些修改还没有确认。"),
    ).toBeInTheDocument();
    expect(screen.getByText("这是上次确认时的校验结果。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去确认" }));
    expect(onGoToModel).toHaveBeenCalled();
  });

  it("shows no tag for a check status it does not know", async () => {
    getOntologyCheckMock.mockResolvedValue({
      ...check(),
      status: "queued" as OntologyCheck["status"],
    });
    renderRelease();

    const section = within(await screen.findByRole("region", { name: "数据校验" }));
    expect(await section.findByText("已核对 2 / 3 项")).toBeInTheDocument();
    expect(section.queryByText(/bknProject\./)).toBeNull();
  });

  it("says when the check has not started, or was interrupted", async () => {
    getOntologyCheckMock.mockResolvedValueOnce(null);
    const view = renderRelease();
    expect(await screen.findByText("校验还没有开始")).toBeInTheDocument();
    view.unmount();

    getOntologyCheckMock.mockResolvedValueOnce(
      check({ error: "interrupted", results: null, status: "failed" }),
    );
    renderRelease();
    expect(await screen.findByText("校验被中断了，可以重新校验。")).toBeInTheDocument();
  });

  it("lets the owner check again, follows the running check until it ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    runOntologyCheckMock.mockResolvedValue(check({ results: null, status: "running" }));
    getOntologyCheckMock.mockResolvedValue(check());
    renderRelease();

    fireEvent.click(await screen.findByRole("button", { name: "重新校验" }));
    await waitFor(() => expect(runOntologyCheckMock).toHaveBeenCalledWith("p1"));
    expect(messageMock.success).toHaveBeenCalledWith("已开始重新校验");
    expect(await screen.findByText("校验中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新校验" })).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(CHECK_POLL_MS));
    expect(await screen.findByText("通过")).toBeInTheDocument();
    const reads = getOntologyCheckMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(CHECK_POLL_MS * 3));
    expect(getOntologyCheckMock.mock.calls.length).toBe(reads);
  });

  it("explains a refused check", async () => {
    runOntologyCheckMock.mockRejectedValue(
      new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { description: "raw", error_code: "BknProject.Check.ConfirmAgain" },
        status: 409,
      } as AxiosResponse),
    );
    renderRelease();

    fireEvent.click(await screen.findByRole("button", { name: "重新校验" }));
    await waitFor(() =>
      expect(messageMock.error).toHaveBeenCalledWith("确认之后草稿又改过，请先重新确认"),
    );
  });

  it("offers nothing to run to others or on an archived project", async () => {
    const view = renderRelease({ ownerIsCaller: false });
    expect(await screen.findByText("只有项目负责人可以重新校验或重新构建")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新校验" })).toBeNull();
    view.unmount();

    renderRelease({ archived: true });
    expect(await screen.findByText("通过")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新校验" })).toBeNull();
  });

  it("shows the check is being read again while retrying", async () => {
    let answer: (value: OntologyCheck) => void = () => undefined;
    getOntologyCheckMock.mockRejectedValueOnce(new Error("down")).mockImplementationOnce(
      () =>
        new Promise<OntologyCheck>((resolve) => {
          answer = resolve;
        }),
    );
    renderRelease();

    expect(await screen.findByText("校验结果暂时读取不到")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /重\s*试/ });
    fireEvent.click(retry);
    await waitFor(() => expect(retry).toHaveClass("ant-btn-loading"));
    answer(check());
    expect(await screen.findByText("通过")).toBeInTheDocument();
    expect(screen.queryByText("校验结果暂时读取不到")).toBeNull();
  });

  it("offers to read the confirmation again when it cannot be read", async () => {
    getProjectStatusMock.mockRejectedValueOnce(new Error("down")).mockResolvedValue(status());
    renderRelease();

    expect(await screen.findByText("确认情况暂时读取不到")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重\s*试/ }));
    expect(await screen.findByText("通过")).toBeInTheDocument();
  });
});
