/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import { WorkspaceOverviewSection } from "./WorkspaceOverviewSection";

const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: messageMock }),
}));

vi.mock("@/modules/knowledge-network/components/preview/OverviewOntologyBlock", () => ({
  OverviewOntologyBlock: () => null,
}));

vi.mock("@/modules/system-admin/components/ObjectAuthorizeDrawer", () => ({
  ObjectAuthorizeDrawer: () => null,
}));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

const detail: KnowledgeNetworkRecord = {
  color: "#1677ff",
  createTime: "2026-09-05 10:00:00",
  creatorName: "Builder",
  description: "",
  id: "network-1",
  identifier: "ecommerce_ops_bkn",
  name: "Ecommerce Operations",
  operations: ["view_detail"],
  statistics: {
    actionTypesTotal: 0,
    conceptGroupsTotal: 0,
    metricsTotal: 0,
    objectTypesTotal: 0,
    relationTypesTotal: 0,
  },
  tags: [],
  updateTime: "2026-09-05 10:00:00",
  updaterName: "Builder",
};

function installHttpClipboardFallback(result: boolean) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
  const copiedTexts: string[] = [];
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => {
      const copiedText = document.querySelector("textarea")?.value;
      if (copiedText) {
        copiedTexts.push(copiedText);
      }
      return result;
    }),
  });
  return copiedTexts;
}

function renderOverview() {
  render(
    <MemoryRouter>
      <WorkspaceOverviewSection
        canModify={false}
        detail={detail}
        loadRecentObjects={vi.fn().mockResolvedValue(undefined)}
        networkId="network-1"
        onEdit={vi.fn()}
        recentObjects={[]}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  if (clipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  if (execCommandDescriptor) {
    Object.defineProperty(document, "execCommand", execCommandDescriptor);
  } else {
    Reflect.deleteProperty(document, "execCommand");
  }
});

describe("WorkspaceOverviewSection clipboard fallback", () => {
  it("copies the knowledge-network identifier and reports success on HTTP", async () => {
    const copiedTexts = installHttpClipboardFallback(true);
    renderOverview();

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.copyNetworkIdentifier" }),
    );

    await waitFor(() => {
      expect(copiedTexts).toEqual(["ecommerce_ops_bkn"]);
      expect(messageMock.success).toHaveBeenCalledWith(
        "knowledgeNetwork.networkIdentifierCopied",
      );
    });
    expect(messageMock.error).not.toHaveBeenCalled();
  });

  it("reports a clear error when both clipboard strategies fail", async () => {
    installHttpClipboardFallback(false);
    renderOverview();

    fireEvent.click(
      screen.getByRole("button", { name: "knowledgeNetwork.copyNetworkIdentifier" }),
    );

    await waitFor(() => {
      expect(messageMock.error).toHaveBeenCalledWith(
        "knowledgeNetwork.copyNetworkIdentifierFailed",
      );
    });
    expect(messageMock.success).not.toHaveBeenCalled();
  });
});
