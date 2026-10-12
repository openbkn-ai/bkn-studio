/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ResourcePermissionRequestAction } from "./ResourcePermissionRequestAction";

const mocks = vi.hoisted(() => ({
  capability: "unknown",
  getPermissionRequestProposalPreview: vi.fn(),
  message: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
  registry: {
    catalogError: null,
    catalogLoading: false,
    operationsForType: () => [],
    retryAuthorizationRegistry: vi.fn(),
  },
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message }),
}));

vi.mock("@/framework/entitlement/use-entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/entitlement/use-entitlement")>()),
  useCapability: () => mocks.capability,
  useEntitlement: () => ({ extensions: ["perm_object_level"] }),
}));

vi.mock("@/framework/runtime/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/framework/runtime/config")>()),
  getRuntimeConfig: () => ({ currentUser: { isSuperAdmin: false } }),
}));

vi.mock("@/modules/account/services/permission-requests.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/account/services/permission-requests.service")
  >()),
  getPermissionRequestProposalPreview: mocks.getPermissionRequestProposalPreview,
  listPermissionRequests: () => Promise.resolve({ entries: [] }),
}));

vi.mock("@/modules/knowledge-network/services/object-type.service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/knowledge-network/services/object-type.service")
  >()),
  getKnowledgeNetworkObjectTypeDetail: () => Promise.resolve({ dataProperties: [] }),
}));

vi.mock("@/modules/system-admin/components/AuthorizationRegistryFailureAlert", () => ({
  AuthorizationRegistryFailureAlert: () => null,
}));

vi.mock("@/modules/system-admin/hooks/use-authorization-registry", () => ({
  useAuthorizationRegistry: () => mocks.registry,
}));

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  mocks.capability = "unknown";
  mocks.getPermissionRequestProposalPreview.mockReset();
  vi.unstubAllGlobals();
});

it("preserves an open operation request when policy preview becomes available", async () => {
  mocks.getPermissionRequestProposalPreview.mockResolvedValue({});
  const props = {
    initialReason: "original reason",
    open: true,
    operations: ["view_detail"],
    resourceID: "network-1/object-1",
    resourceName: "Order",
    resourceType: "object_type",
    trigger: "none" as const,
  };
  const view = render(<ResourcePermissionRequestAction {...props} />);

  const reason = await screen.findByRole("textbox", {
    name: "knowledgeNetwork.permissionRequestReason",
  });
  fireEvent.change(reason, { target: { value: "edited reason" } });
  const operation = screen.getByRole("button", {
    name: "knowledgeNetwork.permissionOperation.query_data (query_data)",
  });
  fireEvent.click(operation);
  expect(operation.getAttribute("aria-pressed")).toBe("true");

  mocks.capability = "available";
  view.rerender(<ResourcePermissionRequestAction {...props} />);

  await waitFor(() => expect(mocks.getPermissionRequestProposalPreview).toHaveBeenCalledOnce());
  expect((reason as HTMLInputElement).value).toBe("edited reason");
  expect(operation.getAttribute("aria-pressed")).toBe("true");
});
