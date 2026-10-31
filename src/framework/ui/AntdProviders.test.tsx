/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { Button } from "antd";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/AppProviders";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { createRuntimeConfig } from "@/framework/runtime/config";

describe("AntdProviders", () => {
  it("keeps two-character Chinese button labels unspaced across modules", () => {
    const runtimeConfig = createRuntimeConfig();

    render(
      <AppProviders runtimeConfig={runtimeConfig} updateLocale={vi.fn()}>
        <AntdProviders runtimeConfig={runtimeConfig}>
          <Button>新建</Button>
        </AntdProviders>
      </AppProviders>,
    );

    const button = screen.getByRole("button", { name: "新建" });
    expect(button).toHaveTextContent(/^新建$/);
    expect(button).not.toHaveClass("ant-btn-two-chinese-chars");
  });
});
