/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entitlement } from "@/framework/entitlement/types";
import type {
  SSOProvider,
  SSOProviderInput,
  SSOProviderPage,
} from "@/modules/system-admin/services/sso-provider.service";
import adminStyles from "../scenes/admin.module.css";
const state = vi.hoisted(() => ({ loading: false, snapshot: null as Entitlement | null }));
type ConfirmationOptions = {
  okButtonProps?: { danger?: boolean };
  onOk: () => Promise<void>;
};
const api = vi.hoisted(() => ({
  list: vi.fn<(cursor?: string) => Promise<SSOProviderPage>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
  save: vi.fn<(input: Partial<SSOProviderInput>, id?: string) => Promise<SSOProvider>>(),
  test: vi.fn<(input: SSOProviderInput) => Promise<void>>(),
  error: vi.fn(),
  success: vi.fn(),
  confirm: vi.fn<(options: ConfirmationOptions) => void>(),
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
  deleteSSOProvider: api.remove,
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
  api.remove.mockResolvedValue(undefined);
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
  it("uses the shared admin surface, toolbar, table and overlay with readable adapter labels", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [
        provider,
        { ...provider, id: "generic", display_name: "OIDC sign-in", adapter: "generic" },
      ],
      total: 2,
      next_cursor: null,
    });
    const { container } = renderPage();
    await screen.findByText("Company sign-in");
    expect(container.querySelector("section")).toHaveClass(
      adminStyles.contentSurface,
      adminStyles.contentSurfacePlain,
    );
    expect(
      screen
        .getByRole("button", { name: "systemAdmin.sso.add" })
        .closest(`.${adminStyles.operationBar}`),
    ).not.toBeNull();
    expect(screen.getByRole("table").closest(`.${adminStyles.tableSurface}`)).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "systemAdmin.sso.title" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Casdoor")).toBeInTheDocument();
    expect(screen.getByText("systemAdmin.sso.generic")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.add" }));
    expect(screen.getByRole("dialog").closest(`.${adminStyles.adminOverlay}`)).not.toBeNull();
  });
  it("loads all cursor pages without showing pagination controls", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValueOnce({ entries: [provider], total: 2, next_cursor: "page-2" });
    api.list.mockResolvedValueOnce({
      entries: [{ ...provider, id: "other", display_name: "Other provider" }],
      total: 2,
      next_cursor: null,
    });
    renderPage();
    await screen.findByText("Company sign-in");
    expect(screen.getByText("Other provider")).toBeInTheDocument();
    expect(api.list).toHaveBeenNthCalledWith(1, undefined);
    expect(api.list).toHaveBeenNthCalledWith(2, "page-2");
    expect(
      screen.queryByRole("button", { name: "systemAdmin.sso.previous" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "systemAdmin.sso.next" })).not.toBeInTheDocument();
  });
  it("stops loading when the backend repeats a pagination cursor", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({ entries: [provider], total: 2, next_cursor: "same-cursor" });
    renderPage();
    expect(await screen.findByText("systemAdmin.sso.paginationFailed")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "systemAdmin.sso.refresh" })).not.toHaveClass(
      "ant-btn-loading",
    );
  });
  it("limits loading even when the backend keeps returning new cursors", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    let pageNumber = 0;
    api.list.mockImplementation(() => {
      pageNumber += 1;
      return Promise.resolve({
        entries: [],
        total: 3000,
        next_cursor: pageNumber > 100 ? null : String(pageNumber),
      });
    });
    renderPage();
    expect(await screen.findByText("systemAdmin.sso.paginationFailed")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(100);
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
    expect(screen.getByLabelText("systemAdmin.sso.client_secret")).toHaveAttribute(
      "placeholder",
      "********",
    );
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
  it("confirms deletion of a disabled provider and refreshes the list", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [{ ...provider, enabled: false }],
      total: 1,
      next_cursor: null,
    });
    renderPage();
    await screen.findByText("Company sign-in");
    expect(screen.getByText("casdoor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "systemAdmin.sso.next" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.more" }));
    fireEvent.click(await screen.findByText("systemAdmin.sso.delete"));
    expect(api.remove).not.toHaveBeenCalled();
    const confirmation = api.confirm.mock.calls[0][0];
    expect(confirmation.okButtonProps?.danger).toBe(true);
    await act(async () => {
      await confirmation.onOk();
    });
    expect(api.remove).toHaveBeenCalledWith("casdoor");
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it.each([
    { enabled: true, default_for_login: false },
    { enabled: false, default_for_login: true },
  ])("blocks deletion of an active or default provider: %j", async (flags) => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [{ ...provider, ...flags }],
      total: 1,
      next_cursor: null,
    });
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.more" }));
    const item = await screen.findByRole("menuitem", { name: "systemAdmin.sso.delete" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item);
    expect(api.confirm).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });
  it("keeps a bound provider visible and explains the deletion conflict", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [{ ...provider, enabled: false }],
      total: 1,
      next_cursor: null,
    });
    const conflict = Object.assign(new Error("conflict"), {
      isAxiosError: true,
      response: { data: { error_code: "SSO_PROVIDER_IN_USE" } },
    });
    api.remove.mockRejectedValue(conflict);
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.more" }));
    fireEvent.click(await screen.findByText("systemAdmin.sso.delete"));
    await act(async () => {
      await expect(api.confirm.mock.calls[0][0].onOk()).rejects.toBe(conflict);
    });
    expect(api.error).toHaveBeenCalledWith("systemAdmin.sso.errors.SSO_PROVIDER_IN_USE");
    expect(screen.getByText("Company sign-in")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(1);
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
      enabled: true,
      login_enabled: false,
      exchange_enabled: false,
      allow_insecure_http: true,
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
  it("groups provider settings and expands advanced settings on demand", async () => {
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
    expect(
      screen.getByRole("region", { name: "systemAdmin.sso.sections.provider" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /systemAdmin.sso.sections.login/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /systemAdmin.sso.sections.exchange/ }),
    ).not.toBeInTheDocument();
    const advanced = screen.getByRole("button", { name: /systemAdmin.sso.sections.advanced/ });
    expect(advanced).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(advanced);
    expect(advanced).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("systemAdmin.sso.department_claim")).toHaveValue("groups");
  });
  it("opens advanced settings when the server reports an error in that section", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.test.mockRejectedValue(
      Object.assign(new Error("invalid field"), {
        isAxiosError: true,
        response: { data: { field: "allow_insecure_http", error_code: "INVALID_PARAMETER" } },
      }),
    );
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.edit" }));
    const advanced = screen.getByRole("button", { name: /systemAdmin.sso.sections.advanced/ });
    expect(advanced).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.test" }));
    await waitFor(() => expect(advanced).toHaveAttribute("aria-expanded", "true"));
    expect(api.error).toHaveBeenCalledWith("systemAdmin.sso.errors.INVALID_PARAMETER");
  });
  it("clears default sign-in when browser sign-in is disabled", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [{ ...provider, default_for_login: true }],
      total: 1,
      next_cursor: null,
    });
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.edit" }));
    const defaultSwitch = screen.getByLabelText("systemAdmin.sso.default_for_login");
    expect(defaultSwitch).toBeChecked();
    expect(
      screen.queryByRole("switch", { name: "systemAdmin.sso.enabled" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("systemAdmin.sso.login_enabled"));
    expect(
      screen.queryByRole("switch", { name: "systemAdmin.sso.default_for_login" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("systemAdmin.sso.login_enabled"));
    expect(screen.getByLabelText("systemAdmin.sso.default_for_login")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.save" }));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0].default_for_login).toBe(false);
    expect(api.confirm).not.toHaveBeenCalled();
  });
  it("preserves manually configured URLs while updating generated defaults", async () => {
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
    const issuer = screen.getByLabelText("systemAdmin.sso.issuer");
    const discovery = screen.getByLabelText("systemAdmin.sso.discovery_url");
    const id = screen.getByLabelText("systemAdmin.sso.id");
    expect(
      screen.queryByRole("switch", { name: "systemAdmin.sso.default_for_login" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("systemAdmin.sso.login_enabled"));
    const callback = screen.getByLabelText("systemAdmin.sso.redirect_uri");
    fireEvent.change(issuer, { target: { value: "https://idp.example/" } });
    expect(discovery).toHaveValue("https://idp.example/.well-known/openid-configuration");
    fireEvent.change(id, { target: { value: "first" } });
    expect(callback).toHaveValue(`${window.location.origin}/sso/callback/first`);
    fireEvent.change(discovery, { target: { value: "https://idp.example/custom" } });
    fireEvent.change(callback, { target: { value: "https://public.example/sso/callback/second" } });
    fireEvent.change(issuer, { target: { value: "https://other.example" } });
    fireEvent.change(id, { target: { value: "second" } });
    expect(discovery).toHaveValue("https://idp.example/custom");
    expect(callback).toHaveValue("https://public.example/sso/callback/second");
  });
  it("edits multiple client IDs as tags and saves the existing string contract", async () => {
    state.snapshot = {
      ...state.snapshot!,
      licensed: true,
      edition: "professional",
      extensions: ["sso"],
      capabilities: ["sso"],
    };
    api.list.mockResolvedValue({
      entries: [
        {
          ...provider,
          exchange_enabled: true,
          allowed_client_ids: "agentflow",
          exchange_audience: "aud-one aud-two",
        },
      ],
      total: 1,
      next_cursor: null,
    });
    renderPage();
    await screen.findByText("Company sign-in");
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.edit" }));
    const input = screen.getByRole("combobox", { name: /systemAdmin.sso.allowed_client_ids/ });
    fireEvent.change(input, { target: { value: "another-client" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", keyCode: 13 });
    expect(await screen.findByText("another-client")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("systemAdmin.sso.exchange_enabled"));
    fireEvent.click(screen.getByLabelText("systemAdmin.sso.exchange_enabled"));
    expect(screen.getByText("another-client")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "systemAdmin.sso.save" }));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(api.save.mock.calls[0][0]).toMatchObject({
      allowed_client_ids: "agentflow another-client",
      exchange_audience: "aud-one aud-two",
      scopes: "openid profile email",
      external_required_scope: "read",
      hydra_issue_scope: "openid",
    });
  });
});
