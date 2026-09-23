/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OAuthAccessOrigin } from "@/modules/system-admin/types/oauth-access-origin";

const createMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());
const reconcileMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
const modalConfirmMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: messageMock,
    modal: { confirm: modalConfirmMock },
  }),
}));

vi.mock("@/modules/system-admin/services/oauth-access-origin.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/system-admin/services/oauth-access-origin.service")
  >()),
  createOAuthAccessOrigin: createMock,
  deleteOAuthAccessOrigin: deleteMock,
  listOAuthAccessOrigins: listMock,
  reconcileOAuthAccessOrigins: reconcileMock,
}));

import { OAuthAccessOriginsScene } from "./OAuthAccessOriginsScene";

const entries: OAuthAccessOrigin[] = [
  {
    desiredState: "active",
    id: "system-primary",
    origin: "https://public.example.com",
    postLogoutRedirectUri: "https://public.example.com/studio",
    readOnly: true,
    redirectUri: "https://public.example.com/studio/callback",
    source: "system",
    syncState: "synced",
  },
  {
    desiredState: "active",
    id: "runtime-private",
    lastSyncError: "hydra unavailable",
    origin: "http://10.0.0.20:30080",
    postLogoutRedirectUri: "http://10.0.0.20:30080/studio",
    readOnly: false,
    redirectUri: "http://10.0.0.20:30080/studio/callback",
    source: "runtime",
    syncState: "error",
  },
];

function renderScene() {
  render(<OAuthAccessOriginsScene />);
}

describe("OAuthAccessOriginsScene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    listMock.mockResolvedValue(entries);
    createMock.mockResolvedValue({ entry: entries[1], pending: false });
    deleteMock.mockResolvedValue({ pending: false });
    reconcileMock.mockResolvedValue({ entries: [entries[0]], pending: false });
  });

  it("shows origin provenance, generated URIs, sync errors, HTTP warning, and only runtime deletion", async () => {
    renderScene();

    await screen.findByText("https://public.example.com");

    expect(screen.getByText("https://public.example.com/studio/callback")).toBeTruthy();
    expect(screen.getByText("http://10.0.0.20:30080/studio")).toBeTruthy();
    expect(screen.getByText("hydra unavailable")).toBeTruthy();
    expect(screen.getByText("systemAdmin.accessOrigins.security.http")).toBeTruthy();
    expect(screen.getByText("systemAdmin.accessOrigins.readOnly.label")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "systemAdmin.accessOrigins.delete" }),
    ).toHaveLength(1);
  });

  it("keeps login callback guidance in a focusable tooltip instead of an intro alert", async () => {
    renderScene();
    await screen.findByText("https://public.example.com");

    expect(screen.queryByText("systemAdmin.accessOrigins.introTitle")).toBeNull();
    const guidance = screen.getByLabelText("systemAdmin.accessOrigins.form.helpTooltipLabel");
    expect(guidance).toHaveAttribute("tabindex", "0");
    fireEvent.mouseEnter(guidance);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.closest('[class*="helpTooltip"]')).toBeTruthy();
    expect(tooltip).toHaveTextContent("systemAdmin.accessOrigins.form.helpTooltip");
  });

  it("keeps invalid input local and does not submit it", async () => {
    renderScene();
    await screen.findByText("https://public.example.com");

    fireEvent.change(screen.getByLabelText("systemAdmin.accessOrigins.form.label"), {
      target: { value: "https://example.com/studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.accessOrigins\.add$/ }));

    expect(screen.getByText("systemAdmin.accessOrigins.validation.invalid")).toBeVisible();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("reports asynchronous synchronization after a successful add", async () => {
    createMock.mockResolvedValue({ entry: entries[1], pending: true });
    renderScene();
    await screen.findByText("https://public.example.com");

    fireEvent.change(screen.getByLabelText("systemAdmin.accessOrigins.form.label"), {
      target: { value: "https://proxy.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.accessOrigins\.add$/ }));

    await waitFor(() => expect(createMock).toHaveBeenCalledWith("https://proxy.example.com"));
    expect(messageMock.warning).toHaveBeenCalledWith(
      "systemAdmin.accessOrigins.toast.savedPending",
    );
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("reconciles every access origin and updates the displayed states", async () => {
    renderScene();
    await screen.findByText("https://public.example.com");

    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.accessOrigins\.sync$/ }));

    await waitFor(() => expect(reconcileMock).toHaveBeenCalledOnce());
    expect(messageMock.success).toHaveBeenCalledWith("systemAdmin.accessOrigins.toast.synced");
    await waitFor(() => expect(screen.queryByText("http://10.0.0.20:30080")).toBeNull());
  });

  it("highlights the duplicate row from the backend conflict payload", async () => {
    createMock.mockRejectedValue(
      new axios.AxiosError("conflict", undefined, undefined, undefined, {
        config: { headers: new axios.AxiosHeaders() },
        data: { error_details: { existing_id: "runtime-private" } },
        headers: {},
        status: 409,
        statusText: "Conflict",
      }),
    );
    renderScene();
    await screen.findByText("https://public.example.com");

    fireEvent.change(screen.getByLabelText("systemAdmin.accessOrigins.form.label"), {
      target: { value: "https://proxy.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /systemAdmin\.accessOrigins\.add$/ }));

    await screen.findByText("systemAdmin.accessOrigins.validation.duplicate");
    expect(document.querySelector("tr[class*='duplicateRow']")?.textContent).toContain(
      "http://10.0.0.20:30080",
    );
  });

  it("confirms runtime deletion and retains its pending-sync feedback", async () => {
    deleteMock.mockResolvedValue({ pending: true });
    renderScene();
    await screen.findByText("https://public.example.com");

    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.accessOrigins.delete" }));
    const [[{ onOk }]] = modalConfirmMock.mock.calls as [[{ onOk: () => Promise<void> }]];
    await act(async () => {
      await onOk();
    });

    expect(deleteMock).toHaveBeenCalledWith("runtime-private");
    expect(messageMock.warning).toHaveBeenCalledWith(
      "systemAdmin.accessOrigins.toast.deletePending",
    );
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });
});
