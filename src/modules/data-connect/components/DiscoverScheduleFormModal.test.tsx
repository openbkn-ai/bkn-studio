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

vi.mock("antd", async (importOriginal) => {
  const original = await importOriginal<typeof import("antd")>();
  const { default: dayjs } = await import("dayjs");

  return {
    ...original,
    DatePicker: ({
      id,
      onChange,
      value,
    }: {
      id?: string;
      onChange?: (value: ReturnType<typeof dayjs> | null) => void;
      value?: ReturnType<typeof dayjs>;
    }) => (
      <input
        id={id}
        onChange={(event) => onChange?.(event.target.value ? dayjs(event.target.value) : null)}
        value={value?.format("YYYY-MM-DD HH:mm") ?? ""}
      />
    ),
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
    fireEvent.change(screen.getByLabelText(/dataConnect\.discoverScheduleName/), {
      target: { value: "Too frequent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(screen.getByText("dataConnect.discoverCronInvalid")).toBeTruthy();
    }, { timeout: 3_000 });
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
    const startTimeInput = screen.getByLabelText("dataConnect.discoverStartTime");
    const endTimeInput = screen.getByLabelText("dataConnect.discoverEndTime");
    fireEvent.change(startTimeInput, { target: { value: "2026-08-20 10:00" } });
    fireEvent.blur(startTimeInput);
    fireEvent.change(endTimeInput, { target: { value: "2026-08-20 09:00" } });
    fireEvent.blur(endTimeInput);
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(screen.getAllByText("dataConnect.discoverTimeRangeInvalid")).toHaveLength(2);
    }, { timeout: 3_000 });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits selected times with minute precision", async () => {
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
      { target: { value: "Minute precision" } },
    );
    fireEvent.change(screen.getByLabelText("dataConnect.discoverStartTime"), {
      target: { value: "2026-08-20 10:00:59" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        startTime: Date.parse("2026-08-20T10:00:00"),
      }));
    });
  });
});
