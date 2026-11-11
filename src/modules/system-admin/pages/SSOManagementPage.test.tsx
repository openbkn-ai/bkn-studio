/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entitlement } from "@/framework/entitlement/types";
import type { SSOProvider } from "@/modules/system-admin/services/sso-provider.service";
const state = vi.hoisted(() => ({ loading: false, snapshot: null as Entitlement | null }));
const api = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/framework/entitlement/use-entitlement", () => ({ useEntitlementContext: () => state }));
vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: api.error, success: api.success },
    modal: { confirm: api.confirm },
  }),
}));
vi.mock("@/modules/system-admin/services/sso-provider.service", () => ({
  listSSOProviders: api.list,
  saveSSOProvider: api.save,
  testSSOProvider: api.test,
}));
import { SSOManagementPage } from "./SSOManagementPage";
const provider: SSOProvider = {
  id: "casdoor",
  display_name: "Company sign-in",
  protocol: "oidc",
  adapter: "casdoor",
  issuer: "https://idp.example",
  discovery_url: "https://idp.example/discovery",
  client_id: "safe",
  client_secret_env: "",
  redirect_uri: "https://safe.example/sso/callback/casdoor",
  scopes: "openid profile email",
  department_claim: "groups",
  allowed_client_ids: "",
  exchange_audience: "",
  external_required_scope: "read",
  hydra_issue_scope: "openid",
  enabled: true,
  login_enabled: true,
  exchange_enabled: false,
  default_for_login: false,
  allow_insecure_http: false,
  has_client_secret: true,
};
function renderPage() {
  return render(
    <MemoryRouter>
      <SSOManagementPage />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
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
  state.snapshot = {
    edition: "community",
    licensed: false,
    extensions: [],
    capabilities: [],
    features: [],
    limits: {},
    state: "unlicensed",
  };
  api.list.mockResolvedValue({ entries: [provider], total: 1, next_cursor: null });
  api.save.mockResolvedValue(provider);
  api.test.mockResolvedValue(undefined);
});
describe("SSO management edition and credentials", () => {
  it("shows a community unlock page without fetching configuration", () => {
    renderPage();
    expect(screen.getByText("common.entitlement.unlockTitle")).toBeTruthy();
    expect(api.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "systemAdmin.sso.add" })).toBeNull();
  });
  it.each(["professional", "enterprise", "industry"] as const)(
    "opens management for %s",
    async (edition) => {
      state.snapshot = {
        ...state.snapshot!,
        licensed: true,
        edition,
        extensions: ["sso"],
        capabilities: ["sso"],
      };
      renderPage();
      await screen.findByText("Company sign-in");
      expect(api.list).toHaveBeenCalledWith(undefined);
    },
  );
  it("does not mount management with a community backend", () => {
    state.snapshot = { ...state.snapshot!, licensed: true, edition: "professional" };
    renderPage();
    expect(api.list).not.toHaveBeenCalled();
    expect(screen.getByText("common.entitlement.imageMissingTitle")).toBeTruthy();
  });
  it("preserves a blank existing secret and omits metadata when editing", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.edit" }));
    expect(screen.getByLabelText("systemAdmin.sso.client_secret")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.display_name"), {
      target: { value: "Updated name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.save" }));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    const body = api.save.mock.calls[0][0] as Record<string, unknown>;
    expect(body.display_name).toBe("Updated name");
    expect(body.has_client_secret).toBeUndefined();
    expect(body.client_secret).toBeUndefined();
    expect(api.save.mock.calls[0][1]).toBe("casdoor");
  });
  it("creates a provider with callback defaults and a new secret", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.add" }));
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.id"), { target: { value: "company" } });
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.display_name"), {
      target: { value: "Company" },
    });
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.issuer"), {
      target: { value: "https://login.example" },
    });
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.client_id"), {
      target: { value: "safe" },
    });
    fireEvent.change(screen.getByLabelText("systemAdmin.sso.client_secret"), {
      target: { value: "new-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.save" }));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).toMatchObject({
      id: "company",
      protocol: "oidc",
      client_secret: "new-secret",
      discovery_url: "https://login.example/.well-known/openid-configuration",
      redirect_uri: `${window.location.origin}/sso/callback/company`,
    });
    expect(api.save.mock.calls[0][1]).toBeUndefined();
  });
  it("tests without persisting configuration", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.edit" }));
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.test" }));
    await waitFor(() => expect(api.test).toHaveBeenCalled());
    expect(api.save).not.toHaveBeenCalled();
  });
});
