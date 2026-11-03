/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KnowledgeNetworkIntegrationPage } from "./KnowledgeNetworkIntegrationPage";

const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("antd", () => ({
  App: { useApp: () => ({ message: messageMock }) },
  Tooltip: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/auth/oauth", () => ({ gatewayOrigin: () => "" }));

vi.mock("@/modules/knowledge-network/scenes/ExperienceScene", () => ({
  ExperienceScene: () => null,
}));

vi.mock("./SdkAppDevelopmentPanel", () => ({
  SdkAppDevelopmentPanel: () => <div>sdk-app-development</div>,
}));

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand");

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

function renderPage(path = "/knowledge-network/integration") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <KnowledgeNetworkIntegrationPage />
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

describe("KnowledgeNetworkIntegrationPage clipboard fallback", () => {
  it("restores the integration tab from the URL", () => {
    renderPage("/knowledge-network/integration?tab=sdk");

    expect(
      screen.getByRole("tab", { name: /knowledgeNetwork\.integration\.tabs\.sdk/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("sdk-app-development")).toBeTruthy();
  });

  it("copies CLI commands when the Clipboard API is unavailable on HTTP", async () => {
    const copiedTexts = installHttpClipboardFallback(true);
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /knowledgeNetwork\.integration\.tabs\.cli/ }));
    fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork\.integration\.copy/ }));

    await waitFor(() => {
      expect(copiedTexts).toEqual(["knowledgeNetwork.integration.cli.examples.setup.code"]);
      expect(messageMock.success).toHaveBeenCalledTimes(1);
    });
    expect(messageMock.error).not.toHaveBeenCalled();
  });

  it("reports a clear error when HTTP fallback copying is rejected", async () => {
    installHttpClipboardFallback(false);
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /knowledgeNetwork\.integration\.tabs\.cli/ }));
    fireEvent.click(screen.getByRole("button", { name: /knowledgeNetwork\.integration\.copy/ }));

    await waitFor(() => {
      expect(messageMock.error).toHaveBeenCalledWith("knowledgeNetwork.integration.copyFailed");
    });
    expect(messageMock.success).not.toHaveBeenCalled();
  });
});
