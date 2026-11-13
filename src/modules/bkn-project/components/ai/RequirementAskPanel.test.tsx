/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AskConversation,
  AskRef,
  AskTurn,
  Proposal,
} from "@/modules/bkn-project/types/conversations";
import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

const translate = vi.hoisted(
  () => (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key,
);
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translate }),
}));

const mocks = vi.hoisted(() => ({
  askInConversation: vi.fn(),
  confirm: vi.fn(),
  decideProposals: vi.fn(),
  deleteConversation: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  startConversation: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message, modal: { confirm: mocks.confirm } }),
}));

vi.mock("@/modules/bkn-project/services/conversations.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/bkn-project/services/conversations.service")
  >()),
  askInConversation: mocks.askInConversation,
  decideProposals: mocks.decideProposals,
  deleteConversation: mocks.deleteConversation,
  getConversation: mocks.getConversation,
  listConversations: mocks.listConversations,
  startConversation: mocks.startConversation,
}));

import { RequirementAskPanel } from "./RequirementAskPanel";

const P = "bknProject.ask.proposal";
const PANEL = "bknProject.ask.panel";

const proposal = (extra: Partial<Proposal>): Proposal => ({
  before: null,
  intoBefore: null,
  intoId: "",
  item: { logicKind: "metric", name: "Line load" },
  kind: "logic_needs",
  networkItem: null,
  op: "add",
  parts: [],
  reason: "",
  resultId: "",
  status: "",
  targetId: "",
  ...extra,
});

const turn = (extra: Partial<AskTurn>): AskTurn => ({
  answer: "Here is what I suggest.",
  createTime: 1,
  dropped: 0,
  error: "",
  id: "t1",
  proposals: [],
  question: "Add a load metric",
  refs: [] as AskRef[],
  status: "ready",
  ...extra,
});

const conversation = (turns: AskTurn[], extra: Partial<AskConversation> = {}): AskConversation => ({
  createTime: 1,
  id: "c1",
  page: "kinetic",
  title: "Add a load metric",
  turns,
  updateTime: Date.parse("2026-11-13T10:00:00Z"),
  ...extra,
});

const refused = (code: string) =>
  new AxiosError(code, "ERR_BAD_REQUEST", undefined, undefined, {
    data: { error_code: `BknProject.${code}` },
    status: 409,
  } as AxiosResponse);

const props = {
  names: { logicNeed: () => "", objectType: () => "", scenario: () => "" },
  onClose: vi.fn(),
  onDecided: vi.fn(),
  onRemoveRef: vi.fn(),
  onSent: vi.fn(),
  onStale: vi.fn(),
  page: "kinetic" as const,
  projectId: "p1",
  refs: [] as AskRef[],
  subtitle: "Kinetic modeling",
  updateTime: 7,
};

const render = (extra: Partial<typeof props> = {}) =>
  renderWithoutAntdStyles(<RequirementAskPanel {...props} {...extra} />);

const twoProposals = [
  proposal({ item: { logicKind: "metric", name: "Line load" } }),
  proposal({ before: { name: "Old" }, op: "delete", targetId: "n2" }),
];

describe("RequirementAskPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with the page's intro and examples when there is no conversation", async () => {
    mocks.listConversations.mockResolvedValue([]);
    render();
    expect(await screen.findByText(`${PANEL}.intro.kinetic`)).toBeInTheDocument();
    expect(screen.getByText(`${PANEL}.examples.kinetic.0`)).toBeInTheDocument();
    expect(screen.getByText(`${PANEL}.carries`)).toBeInTheDocument();
    expect(mocks.listConversations).toHaveBeenCalledWith("p1", "kinetic");
  });

  it("adopts one proposal with the specification read, and says what changed", async () => {
    mocks.listConversations.mockResolvedValue([conversation([turn({ proposals: twoProposals })])]);
    const after = conversation([
      turn({
        proposals: [{ ...twoProposals[0], resultId: "n12", status: "adopted" }, twoProposals[1]],
      }),
    ]);
    const requirements = { updateTime: 8 };
    mocks.decideProposals.mockResolvedValue({ conversation: after, requirements });
    render();

    expect(await screen.findByText(`${P}.op.add`)).toBeInTheDocument();
    expect(screen.getByText(`${P}.pending:${JSON.stringify({ count: 2 })}`)).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: /^bknProject\.ask\.proposal\.adoptItem/ })[0],
    );

    await waitFor(() =>
      expect(mocks.decideProposals).toHaveBeenCalledWith("p1", "c1", "t1", {
        adopt: [0],
        decline: [],
        updateTime: 7,
      }),
    );
    expect(props.onDecided).toHaveBeenCalledWith(requirements, [
      { id: "n12", kind: "logic_needs" },
    ]);
    expect(await screen.findByText(`${P}.adoptedTag`)).toBeInTheDocument();
    expect(mocks.message.success).toHaveBeenCalled();
    // One left: adopting all of them is not offered for one.
    expect(
      screen.queryByRole("button", { name: /^bknProject\.ask\.proposal\.adoptAll/ }),
    ).toBeNull();
  });

  it("adopts all of an answer's pending proposals at once, and declines without adopting", async () => {
    mocks.listConversations.mockResolvedValue([conversation([turn({ proposals: twoProposals })])]);
    mocks.decideProposals.mockResolvedValue({
      conversation: conversation([
        turn({ proposals: twoProposals.map((item) => ({ ...item, status: "adopted" as const })) }),
      ]),
      requirements: null,
    });
    render();

    fireEvent.click(
      await screen.findByRole("button", {
        name: `${P}.adoptAll:${JSON.stringify({ count: 2 })}`,
      }),
    );
    await waitFor(() =>
      expect(mocks.decideProposals).toHaveBeenCalledWith("p1", "c1", "t1", {
        adopt: [0, 1],
        decline: [],
        updateTime: 7,
      }),
    );
    expect(mocks.message.success).toHaveBeenCalledWith(
      `${PANEL}.adoptedAll:${JSON.stringify({ count: 2 })}`,
    );
    expect(await screen.findByText(`${P}.allDone`)).toBeInTheDocument();
  });

  it("declines a proposal on its own", async () => {
    mocks.listConversations.mockResolvedValue([conversation([turn({ proposals: twoProposals })])]);
    mocks.decideProposals.mockResolvedValue({
      conversation: conversation([
        turn({ proposals: [{ ...twoProposals[0], status: "declined" }, twoProposals[1]] }),
      ]),
      requirements: null,
    });
    render();

    fireEvent.click(
      (
        await screen.findAllByRole("button", { name: /^bknProject\.ask\.proposal\.declineItem/ })
      )[0],
    );
    await waitFor(() =>
      expect(mocks.decideProposals).toHaveBeenCalledWith("p1", "c1", "t1", {
        adopt: [],
        decline: [0],
        updateTime: 7,
      }),
    );
    expect(await screen.findByText(`${P}.declinedTag`)).toBeInTheDocument();
    expect(mocks.message.success).not.toHaveBeenCalled();
  });

  it("says to ask again when the item changed, and reads the list again when it is stale", async () => {
    mocks.listConversations.mockResolvedValue([conversation([turn({ proposals: twoProposals })])]);
    mocks.decideProposals.mockRejectedValueOnce(refused("Requirement.ProposalChanged"));
    render();

    const adopt = await screen.findAllByRole("button", {
      name: /^bknProject\.ask\.proposal\.adoptItem/,
    });
    fireEvent.click(adopt[0]);
    await waitFor(() =>
      expect(mocks.message.warning).toHaveBeenCalledWith(`${PANEL}.proposalChanged`),
    );

    mocks.decideProposals.mockRejectedValueOnce(refused("Requirement.Stale"));
    await waitFor(() => expect(adopt[0]).not.toBeDisabled());
    fireEvent.click(adopt[0]);
    await waitFor(() => expect(props.onStale).toHaveBeenCalled());
    expect(mocks.message.warning).toHaveBeenCalledWith(`${PANEL}.stale`);
  });

  it("asks with the ticked items, waits for the answer, and shows it when it comes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mocks.listConversations.mockResolvedValue([]);
      const refs = [{ id: "n7", kind: "logic_needs" as const, name: "Late rate" }];
      const pending = conversation([turn({ answer: "", refs, status: "pending" })]);
      mocks.startConversation.mockResolvedValue(pending);
      mocks.getConversation.mockResolvedValue(
        conversation([turn({ answer: "Merged.", refs, status: "ready" })]),
      );
      render({ refs });

      expect(await screen.findByText("Late rate")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("textbox", { name: `${PANEL}.question` }), {
        target: { value: "Merge these two" },
      });
      fireEvent.click(screen.getByRole("button", { name: `${PANEL}.submit` }));

      await waitFor(() =>
        expect(mocks.startConversation).toHaveBeenCalledWith(
          "p1",
          "kinetic",
          "Merge these two",
          refs,
        ),
      );
      expect(props.onSent).toHaveBeenCalled();
      expect(await screen.findByText(`${PANEL}.thinking`)).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2100);
      });
      expect(await screen.findByText("Merged.")).toBeInTheDocument();
      expect(mocks.getConversation).toHaveBeenCalledWith("p1", "c1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("says why a question failed and asks it again in the same conversation", async () => {
    const refs = [{ id: "n7", kind: "logic_needs" as const, name: "Late rate" }];
    mocks.listConversations.mockResolvedValue([
      conversation([turn({ error: "agent_timeout", refs, status: "failed" })]),
    ]);
    mocks.askInConversation.mockResolvedValue(conversation([turn({})]));
    render();

    expect(await screen.findByText(`${PANEL}.turnError.agent_timeout`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${PANEL}.retry` }));
    await waitFor(() =>
      expect(mocks.askInConversation).toHaveBeenCalledWith("p1", "c1", "Add a load metric", refs),
    );
  });

  it("lists the conversations and deletes a whole one after asking", async () => {
    mocks.listConversations.mockResolvedValue([
      conversation([turn({})]),
      conversation([turn({}), turn({ id: "t2" })], { id: "c0", title: "Why this function?" }),
    ]);
    mocks.deleteConversation.mockResolvedValue(undefined);
    render();

    fireEvent.click(
      await screen.findByRole("button", {
        name: `${PANEL}.history:${JSON.stringify({ count: 2 })}`,
      }),
    );
    expect(screen.getByText("Why this function?")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `${PANEL}.deleteItem:${JSON.stringify({ name: "Why this function?" })}`,
      }),
    );
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `${PANEL}.deleteContent:${JSON.stringify({ count: 2, title: "Why this function?" })}`,
        title: `${PANEL}.deleteTitle`,
      }),
    );
    await act(async () => {
      await (mocks.confirm.mock.calls[0][0] as { onOk: () => Promise<void> }).onOk();
    });
    expect(mocks.deleteConversation).toHaveBeenCalledWith("p1", "c0");
    expect(screen.queryByText("Why this function?")).toBeNull();
    expect(mocks.message.success).toHaveBeenCalledWith(`${PANEL}.deleted`);
  });
});
