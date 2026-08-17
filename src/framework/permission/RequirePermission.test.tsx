/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/AppProviders";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { createRuntimeConfig } from "@/framework/runtime/config";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

function renderGuard(permissions: string[], children: ReactNode) {
  const runtimeConfig = createRuntimeConfig({
    currentUser: { permissions },
  });

  return render(
    <AppProviders runtimeConfig={runtimeConfig} updateLocale={vi.fn()}>
      {children}
    </AppProviders>,
  );
}

describe("RequirePermission", () => {
  it("can guard a standalone route without the page-level app provider", () => {
    renderGuard(
      ["knowledge-network:view"],
      <RequirePermission permissions="knowledge-network:view">
        <div>standalone content</div>
      </RequirePermission>,
    );

    expect(screen.getByText("standalone content")).toBeTruthy();
  });

  it("renders the permission result when the standalone user is unauthorized", () => {
    renderGuard(
      [],
      <RequirePermission permissions="knowledge-network:view">
        <div>standalone content</div>
      </RequirePermission>,
    );

    expect(screen.queryByText("standalone content")).toBeNull();
    expect(screen.getByText("403")).toBeTruthy();
  });
});
