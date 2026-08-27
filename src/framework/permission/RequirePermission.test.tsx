/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/AppProviders";
import { DEFAULT_APP_ENTRY_PATH } from "@/app/router/app-paths";
import { RequirePermission } from "@/framework/permission/RequirePermission";
import { createRuntimeConfig } from "@/framework/runtime/config";

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

  it("redirects an unauthorized standalone user through the default entry route", async () => {
    renderGuard(
      [],
      <MemoryRouter initialEntries={["/knowledge-network"]}>
        <Routes>
          <Route
            path="/knowledge-network"
            element={(
              <RequirePermission permissions="knowledge-network:view">
                <div>standalone content</div>
              </RequirePermission>
            )}
          />
          <Route path={DEFAULT_APP_ENTRY_PATH}>
            <Route index element={<Navigate replace to="/custom-default" />} />
          </Route>
          <Route path="/custom-default" element={<div>default entry content</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("standalone content")).toBeNull();
    expect(await screen.findByText("default entry content")).toBeTruthy();
  });
});
