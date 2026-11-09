/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectorySyncView, SSOProvider } from "../services/sso-provider.service";
const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  run: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: api.success, error: api.error } }),
}));
vi.mock("../services/sso-provider.service", () => ({
  getDirectorySync: api.get,
  saveDirectorySync: api.save,
  runDirectorySync: api.run,
}));
import { SSODirectorySyncModal } from "./SSODirectorySyncModal";
const provider = {
  id: "casdoor",
  enabled: true,
  redirect_uri: "https://safe.example/sso/callback/casdoor",
} as SSOProvider;
const view: DirectorySyncView = {
  config: {
    provider_id: "casdoor",
    organization: "org",
    enabled: true,
    interval_seconds: 300,
    next_run_at: "",
    last_started_at: null,
    last_finished_at: null,
    last_success_at: null,
    last_error_code: "",
    users: 6,
    departments: 3,
    disabled_users: 0,
    retained_departments: 0,
  },
  has_webhook_secret: true,
  webhook_path: "/api/safe/v1/auth/sso/events/casdoor",
  running: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue(view);
  api.save.mockResolvedValue(view);
  api.run.mockResolvedValue(undefined);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
describe("SSO directory synchronization", () => {
  it("does not read configuration while closed", () => {
    render(<SSODirectorySyncModal onClose={() => undefined} />);
    expect(api.get).not.toHaveBeenCalled();
  });
  it("loads the saved organization and queues a full reconciliation", async () => {
    render(<SSODirectorySyncModal provider={provider} onClose={() => undefined} />);
    expect(await screen.findByLabelText("systemAdmin.sso.sync.organization")).toHaveValue("org");
    expect(screen.getByLabelText("systemAdmin.sso.sync.organization")).toBeDisabled();
    expect(
      screen.getByText(/https:\/\/safe.example\/api\/safe\/v1\/auth\/sso\/events\/casdoor/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.sync.run" }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith("casdoor"));
  });
  it("preserves the write-only secret on an ordinary edit", async () => {
    render(<SSODirectorySyncModal provider={provider} onClose={() => undefined} />);
    await screen.findByLabelText("systemAdmin.sso.sync.organization");
    expect(screen.getByLabelText("systemAdmin.sso.sync.secret")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.sync.save" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith("casdoor", {
        organization: "org",
        enabled: true,
        interval_seconds: 300,
        webhook_secret: undefined,
      }),
    );
  });
  it("does not queue a disabled configuration", async () => {
    api.get.mockResolvedValue({ ...view, config: { ...view.config, enabled: false } });
    render(<SSODirectorySyncModal provider={provider} onClose={() => undefined} />);
    await screen.findByLabelText("systemAdmin.sso.sync.organization");
    expect(screen.getByRole("button", { name: "systemAdmin.sso.sync.run" })).toBeDisabled();
  });
});
