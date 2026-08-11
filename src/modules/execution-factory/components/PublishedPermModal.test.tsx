/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublishedPermModal } from "@/modules/execution-factory/components/PublishedPermModal";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PublishedPermModal", () => {
  // Regression #156: the confirmation button formerly showed a permission-center placeholder and closed, leaving users stranded.
  it("hands the configure click to onConfigure instead of silently closing", () => {
    const onConfigure = vi.fn();
    const onClose = vi.fn();
    render(
      <PublishedPermModal
        activeTab="toolbox"
        onClose={onClose}
        onConfigure={onConfigure}
        open
        resourceName="订单工具箱"
      />,
    );

    fireEvent.click(screen.getByText("executionFactory.publishedPermConfigure"));

    expect(onConfigure).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without configuring when the user picks later", () => {
    const onConfigure = vi.fn();
    const onClose = vi.fn();
    render(
      <PublishedPermModal
        activeTab="toolbox"
        onClose={onClose}
        onConfigure={onConfigure}
        open
        resourceName="订单工具箱"
      />,
    );

    fireEvent.click(screen.getByText("executionFactory.publishedPermLater"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfigure).not.toHaveBeenCalled();
  });
});
