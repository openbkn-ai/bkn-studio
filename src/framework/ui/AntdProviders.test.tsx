/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "antd";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/providers/AppProviders";
import { contrastRatio } from "@/app/theme/semantic-colors";
import { AntdProviders } from "@/framework/ui/AntdProviders";
import { createRuntimeConfig } from "@/framework/runtime/config";

afterEach(cleanup);

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

  it("publishes accessible semantic CSS roles for a custom runtime brand", () => {
    const runtimeConfig = createRuntimeConfig({
      theme: { primaryColor: "#facc15" },
    });

    render(
      <AppProviders runtimeConfig={runtimeConfig} updateLocale={vi.fn()}>
        <AntdProviders runtimeConfig={runtimeConfig}>content</AntdProviders>
      </AppProviders>,
    );

    const rootStyle = document.documentElement.style;
    const action = rootStyle.getPropertyValue("--color-action-primary");
    const actionText = rootStyle.getPropertyValue("--color-action-primary-text");
    const link = rootStyle.getPropertyValue("--color-link");

    expect(action).toBe("#facc15");
    expect(contrastRatio(actionText, action)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(link, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(link).not.toBe(action);
  });
});
