/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getKnowledge: vi.fn(),
  getSupplement: vi.fn(),
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  saveSupplement: vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message }),
}));

vi.mock("@/modules/bkn-project/services/conversations.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/bkn-project/services/conversations.service")
  >()),
  getKnowledge: mocks.getKnowledge,
  getSupplement: mocks.getSupplement,
  saveSupplement: mocks.saveSupplement,
}));

import { AskSources } from "./AskSources";

const S = "bknProject.ask.sources";
const N = "bknProject.ask.supplement";

const base = {
  canEdit: true,
  documents: [],
  hasBackground: false,
  model: { confirmed: true, network: 0, project: 3 },
  networkItems: [],
  onGoToModel: vi.fn(),
  onOpenDocuments: vi.fn(),
  onViewBackground: vi.fn(),
  onViewRules: vi.fn(),
  page: "kinetic" as const,
  projectId: "p1",
  rules: 2,
};

describe("AskSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupplement.mockResolvedValue({ by: null, text: "", time: 0 });
    mocks.getKnowledge.mockResolvedValue({ concepts: [], files: 0, rules: [] });
  });

  it("lists what the knowledge base holds, with its rules by name, on both pages", async () => {
    mocks.getKnowledge.mockResolvedValue({
      concepts: [{ adopted: true, description: "", kind: "object", name: "Purchase invoice" }],
      files: 6,
      rules: [
        { adopted: false, description: "", kind: "kinetic", name: "Invoicing terms" },
        { adopted: false, description: "", kind: "kinetic", name: "Price change check" },
      ],
    });
    for (const page of ["kinetic", "scenarios"] as const) {
      const { unmount } = renderWithoutAntdStyles(<AskSources {...base} page={page} />);
      expect(
        await screen.findByText(
          `${S}.knowledge:${JSON.stringify({
            concepts: `${S}.knowledgeConcepts:${JSON.stringify({ count: 1 })}`,
            files: `${S}.knowledgeFiles:${JSON.stringify({ count: 6 })}`,
            rules: `${S}.knowledgeRules:${JSON.stringify({ count: 2 })}`,
          })}`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `${S}.knowledgeRuleNames:${JSON.stringify({
            names: "Invoicing termsbknProject.listSeparatorPrice change check",
          })}`,
        ),
      ).toBeInTheDocument();
      unmount();
    }
    expect(mocks.getKnowledge).toHaveBeenCalledWith("p1");
  });

  it("lists no knowledge base without one, as in the open edition", async () => {
    renderWithoutAntdStyles(<AskSources {...base} />);
    await screen.findByText(`${N}.empty`);
    expect(screen.queryByText(new RegExp(`^${S}\\.knowledge:`))).toBeNull();
  });

  it("says what is missing without documents and offers to upload them", async () => {
    renderWithoutAntdStyles(<AskSources {...base} />);

    expect(screen.getByText(`${S}.noDocuments.kinetic`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${S}.uploadDocuments` }));
    expect(base.onOpenDocuments).toHaveBeenCalled();
    expect(screen.getByText(`${S}.model:${JSON.stringify({ count: 3 })}`)).toBeInTheDocument();
    // A network with nothing of its own lists nothing of it.
    expect(screen.queryByText(`${S}.background`)).toBeNull();
    expect(await screen.findByText(`${N}.empty`)).toBeInTheDocument();
  });

  it("counts the network's object types apart and says when the project confirmed none", async () => {
    const onGoToModel = vi.fn();
    renderWithoutAntdStyles(
      <AskSources
        {...base}
        model={{ confirmed: false, network: 41, project: 0 }}
        onGoToModel={onGoToModel}
      />,
    );

    expect(
      screen.getByText(`${S}.networkObjectTypes:${JSON.stringify({ count: 41 })}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${S}.notConfirmed`)).toBeInTheDocument();
    // The network's object types are never counted as the project's confirmed model.
    expect(screen.queryByText(new RegExp(`^${S}\\.model:`))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${S}.confirmModel` }));
    expect(onGoToModel).toHaveBeenCalled();
    await screen.findByText(`${N}.empty`);
  });

  it("counts the project's confirmed object types beside the network's", async () => {
    renderWithoutAntdStyles(
      <AskSources {...base} model={{ confirmed: true, network: 41, project: 2 }} />,
    );

    expect(
      screen.getByText(`${S}.networkObjectTypes:${JSON.stringify({ count: 41 })}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${S}.model:${JSON.stringify({ count: 2 })}`)).toBeInTheDocument();
    expect(screen.queryByText(`${S}.notConfirmed`)).toBeNull();
    await screen.findByText(`${N}.empty`);
  });

  it("names the documents, and marks what the network already has", async () => {
    renderWithoutAntdStyles(
      <AskSources
        {...base}
        documents={[
          {
            createTime: 1,
            docType: "prd",
            format: "markdown",
            id: "d1",
            name: "plan.md",
            size: 1,
            uploaderId: "u",
          },
        ]}
        hasBackground
        networkItems={[
          {
            boxId: "",
            description: "",
            id: "f1",
            kind: "function",
            name: "Kit check",
            needIds: [],
            ownerObjectTypeId: "",
            ownerObjectTypeName: "",
            type: "function",
          },
        ]}
      />,
    );

    expect(screen.queryByText(`${S}.noDocuments.kinetic`)).toBeNull();
    expect(
      screen.getByText(`${S}.names:${JSON.stringify({ names: "plan.md" })}`),
    ).toBeInTheDocument();
    expect(screen.getByText(`${S}.background`)).toBeInTheDocument();
    expect(screen.getByText(`${S}.backgroundNew`)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "bknProject.kinetic.panel.inNetwork" })).toHaveLength(
      2,
    );
    await screen.findByText(`${N}.empty`);
  });

  it("writes the supplement note and says who changed it last", async () => {
    mocks.saveSupplement.mockResolvedValue({
      by: { id: "u1", name: "Ann" },
      text: "Focus on stock",
      time: Date.parse("2026-11-13T10:20:00"),
    });
    renderWithoutAntdStyles(<AskSources {...base} />);

    fireEvent.click(await screen.findByRole("button", { name: `${N}.write` }));
    fireEvent.change(screen.getByRole("textbox", { name: `${N}.title` }), {
      target: { value: "  Focus on stock " },
    });
    fireEvent.click(screen.getByRole("button", { name: `${N}.save` }));

    await waitFor(() => expect(mocks.saveSupplement).toHaveBeenCalledWith("p1", "Focus on stock"));
    expect(await screen.findByText("Focus on stock")).toBeInTheDocument();
    expect(mocks.message.success).toHaveBeenCalledWith(`${N}.saved`);
    expect(
      screen.getByText(
        `${N}.lastChanged:${JSON.stringify({ name: "Ann", time: "2026/11/13 10:20" })}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${N}.edit` })).toBeInTheDocument();
  });

  it("never shows a note it could not read as none, nor lets it be written over", async () => {
    mocks.getSupplement.mockRejectedValueOnce(new Error("timeout"));
    mocks.getSupplement.mockResolvedValueOnce({ by: null, text: "Kept", time: 1 });
    renderWithoutAntdStyles(<AskSources {...base} />);

    // While it is being read, it is not said to be empty.
    expect(screen.queryByText(`${N}.empty`)).toBeNull();
    expect(await screen.findByText(`${N}.loadFailed`)).toBeInTheDocument();
    expect(screen.queryByText(`${N}.empty`)).toBeNull();
    expect(screen.queryByRole("button", { name: `${N}.write` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(await screen.findByText("Kept")).toBeInTheDocument();
    expect(mocks.saveSupplement).not.toHaveBeenCalled();
  });

  it("only shows the note to others", async () => {
    mocks.getSupplement.mockResolvedValue({ by: null, text: "Focus", time: 1 });
    renderWithoutAntdStyles(<AskSources {...base} canEdit={false} />);
    expect(await screen.findByText("Focus")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${N}.edit` })).toBeNull();
  });
});
