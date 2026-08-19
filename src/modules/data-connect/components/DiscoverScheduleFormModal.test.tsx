/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DiscoverScheduleFormModal } from "@/modules/data-connect/components/DiscoverScheduleFormModal";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

describe("DiscoverScheduleFormModal", () => {
  beforeAll(() => {
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
  });

  it("rejects a discover schedule that runs more than once per hour", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <DiscoverScheduleFormModal
        catalogs={[]}
        defaultCatalogId="catalog-1"
        mode="create"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        open
        submitting={false}
      />,
    );

    const cronInput = await screen.findByPlaceholderText(
      "dataConnect.discoverCronExprPlaceholder",
    );
    fireEvent.change(cronInput, { target: { value: "*/30 * * * *" } });
    fireEvent.change(
      screen.getByPlaceholderText("dataConnect.discoverScheduleNamePlaceholder"),
      { target: { value: "Too frequent" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(screen.getByText("dataConnect.discoverCronInvalid")).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects an end time before the start time", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <DiscoverScheduleFormModal
        catalogs={[]}
        defaultCatalogId="catalog-1"
        mode="create"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        open
        submitting={false}
      />,
    );
    fireEvent.change(
      screen.getByPlaceholderText("dataConnect.discoverScheduleNamePlaceholder"),
      { target: { value: "Invalid time range" } },
    );
    const timeInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );
    fireEvent.change(timeInputs[0], { target: { value: "2026-08-20T10:00" } });
    fireEvent.change(timeInputs[1], { target: { value: "2026-08-20T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(screen.getAllByText("dataConnect.discoverTimeRangeInvalid")).toHaveLength(2);
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
