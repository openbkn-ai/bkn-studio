/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { McpConnectionSecurity } from "./McpConnectionSecurity";

const writeTextToClipboard = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/framework/compat/clipboard", () => ({ writeTextToClipboard }));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      // Interpolated values are appended so tests can see which client a string was built for.
      t: (key: string, values?: { client?: string; examplePath?: string }) => {
        if (!values?.client) return key;
        const path = key.endsWith("launchTipsNote") ? `|${values.examplePath}` : "";
        return `${key}|${values.client}${path}`;
      },
    }),
  };
});

describe("McpConnectionSecurity", () => {
  it("shows a fixed warning without a TLS checkbox for HTTP", () => {
    render(
      <McpConnectionSecurity
        protocol="http"
        allowInsecureTls={false}
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("HTTP")).toBeTruthy();
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.httpTitle"),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("lets HTTPS users explicitly allow a self-signed certificate", () => {
    const onChange = vi.fn();
    render(
      <McpConnectionSecurity
        protocol="https"
        allowInsecureTls={false}
        onAllowInsecureTlsChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not show the all-good state when a likely self-signed address is unticked", () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        likelySelfSigned
        allowInsecureTls={false}
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.selfSignedTitle"),
    ).toBeTruthy();
    expect(
      screen.queryByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.httpsTitle"),
    ).toBeNull();
  });

  it("offers the same self-signed checkbox in sign-in mode", () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        allowInsecureTls={false}
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.oauthHttpsDescription"),
    ).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("tells sign-in users how to start the client once self-signed is allowed", () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        likelySelfSigned
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.insecureTitle"),
    ).toBeTruthy();
    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.oauthInsecureDescription"),
    ).toBeTruthy();
  });

  it("shows launch commands for macOS, Windows and Linux behind a tip", async () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        client="workbuddy"
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    const key = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";
    expect(screen.queryByText(`${key}.launchCommandWindows|WorkBuddy`)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));

    expect(await screen.findByText(`${key}.launchCommandMac|WorkBuddy`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchCommandWindows|WorkBuddy`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchCommandLinux|WorkBuddy`)).toBeTruthy();
  });

  it("copies a platform's launch command from the tip", async () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        client="workbuddy"
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    const key = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";
    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));
    const copyButtons = await screen.findAllByRole("button", {
      name: /knowledgeNetwork\.contextLoaderPanel\.common\.copy/,
    });
    expect(copyButtons).toHaveLength(3);

    fireEvent.click(copyButtons[1]);

    expect(writeTextToClipboard).toHaveBeenCalledWith(`${key}.launchCommandWindows|WorkBuddy`);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /knowledgeNetwork\.contextLoaderPanel\.experience\.copied/,
        }),
      ).toBeTruthy(),
    );
  });

  it("shows the commands of the selected client, not always WorkBuddy", async () => {
    const key = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";
    const props = {
      protocol: "https",
      authMode: "oauth",
      allowInsecureTls: true,
      onAllowInsecureTlsChange: vi.fn(),
    } as const;

    const { unmount } = render(<McpConnectionSecurity {...props} client="cursor" />);
    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));
    expect(await screen.findByText(`${key}.launchCommandMac|Cursor`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchTipsIntro|Cursor`)).toBeTruthy();
    expect(screen.queryByText(/WorkBuddy/)).toBeNull();
    // Cursor installs per user, so its example path is not under Program Files.
    expect(
      screen.getByText(
        `${key}.launchTipsNote|Cursor|$env:LOCALAPPDATA\\Programs\\cursor\\Cursor.exe`,
      ),
    ).toBeTruthy();
    unmount();

    render(<McpConnectionSecurity {...props} client="claude" />);
    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));
    expect(await screen.findByText("NODE_TLS_REJECT_UNAUTHORIZED=0 claude")).toBeTruthy();
    expect(screen.getByText(`${key}.launchTipsIntroClaude`)).toBeTruthy();
    expect(
      screen.getAllByRole("button", {
        name: /knowledgeNetwork\.contextLoaderPanel\.common\.copy/,
      }),
    ).toHaveLength(2);
  });

  it("uses placeholder commands for a client without a known app name", async () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        client="generic"
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    const key = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";
    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));

    expect(await screen.findByText(`${key}.launchCommandMacGeneric`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchTipsNoteGeneric`)).toBeTruthy();
  });

  it("keeps the launch tip out of API Key mode", () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "knowledgeNetwork.contextLoaderPanel.mcpSecurity.launchTipsTrigger",
      }),
    ).toBeNull();
  });

  it("warns about a likely self-signed certificate in sign-in mode", () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
        likelySelfSigned
        allowInsecureTls={false}
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.selfSignedTitle"),
    ).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("tells sign-in users on HTTP that most clients need HTTPS", () => {
    render(
      <McpConnectionSecurity
        protocol="http"
        authMode="oauth"
        allowInsecureTls={false}
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("knowledgeNetwork.contextLoaderPanel.mcpSecurity.oauthHttpTitle"),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
