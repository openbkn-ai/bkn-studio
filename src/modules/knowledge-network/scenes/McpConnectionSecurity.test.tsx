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
      t: (key: string) => key,
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
        allowInsecureTls
        onAllowInsecureTlsChange={vi.fn()}
      />,
    );

    const key = "knowledgeNetwork.contextLoaderPanel.mcpSecurity";
    expect(screen.queryByText(`${key}.launchCommandWindows`)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: `${key}.launchTipsTrigger` }));

    expect(await screen.findByText(`${key}.launchCommandMac`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchCommandWindows`)).toBeTruthy();
    expect(screen.getByText(`${key}.launchCommandLinux`)).toBeTruthy();
  });

  it("copies a platform's launch command from the tip", async () => {
    render(
      <McpConnectionSecurity
        protocol="https"
        authMode="oauth"
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

    expect(writeTextToClipboard).toHaveBeenCalledWith(`${key}.launchCommandWindows`);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: /knowledgeNetwork\.contextLoaderPanel\.experience\.copied/,
        }),
      ).toBeTruthy(),
    );
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
