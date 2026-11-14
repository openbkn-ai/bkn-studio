/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { BuildScheduleFormModal } from "./BuildScheduleFormModal";
import type { BuildSchedule, BuildScheduleInput } from "@/shared/schedule";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

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

const resource = {
  id: "res-orders",
  catalogId: "cat-orders",
  name: "Orders",
  category: "table",
} as CatalogResource;
const schedule: BuildSchedule = {
  id: "schedule-orders",
  name: "Hourly orders",
  resourceId: resource.id,
  catalogId: resource.catalogId,
  cronExpr: "15 * * * *",
  executeType: "incremental",
  enabled: true,
  startTime: 0,
  endTime: 0,
  lastRun: 0,
  nextRun: 0,
  lastStatus: "never",
  lastMessage: "",
  updateTime: 100,
};

function renderForm(
  options: {
    initialValue?: BuildSchedule;
    onSubmit?: (input: BuildScheduleInput) => Promise<void>;
  } = {},
) {
  const onSubmit = options.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <BuildScheduleFormModal
      initialValue={options.initialValue}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
      open
      resource={resource}
      submitting={false}
    />,
  );
  return onSubmit;
}

describe("BuildScheduleFormModal", () => {
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
  it("creates a schedule for the bound resource disabled by default", async () => {
    const onSubmit = renderForm();
    fireEvent.change(await screen.findByLabelText("dataCatalog.buildSchedule.name"), {
      target: { value: "  Daily orders  " },
    });
    const resourceInput = screen.getByLabelText("dataCatalog.taskManagement.columns.resource");
    expect(resourceInput).toBeDisabled();
    expect(resourceInput).toHaveValue("res-orders");
    expect(screen.getByRole("switch")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        resourceId: "res-orders",
        name: "Daily orders",
        cronExpr: "0 2 * * *",
        executeType: "full",
        enabled: false,
        startTime: 0,
        endTime: 0,
      }),
    );
    expect(
      screen.queryByRole("combobox", { name: "dataCatalog.taskManagement.columns.catalog" }),
    ).not.toBeInTheDocument();
  });

  it("locks the resource and enabled state and preserves both on edit", async () => {
    const onSubmit = renderForm({ initialValue: schedule });
    expect(
      await screen.findByLabelText("dataCatalog.taskManagement.columns.resource"),
    ).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByRole("switch")).toBeChecked();
    fireEvent.change(screen.getByLabelText("dataCatalog.buildSchedule.name"), {
      target: { value: "Updated orders" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        resourceId: "res-orders",
        name: "Updated orders",
        cronExpr: "15 * * * *",
        executeType: "incremental",
        enabled: true,
        startTime: 0,
        endTime: 0,
      }),
    );
  });

  it.each(["invalid", "*/30 * * * *"])(
    "blocks an invalid or too frequent cron: %s",
    async (cron) => {
      const onSubmit = renderForm({ initialValue: schedule });
      fireEvent.change(await screen.findByLabelText("dataCatalog.buildSchedule.cron"), {
        target: { value: cron },
      });
      fireEvent.click(screen.getByRole("button", { name: "common.save" }));
      expect(await screen.findByText("dataCatalog.buildSchedule.invalidCron")).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("blocks an end time earlier than the start time", async () => {
    const onSubmit = renderForm({ initialValue: schedule });
    fireEvent.change(await screen.findByLabelText("dataCatalog.buildSchedule.startTime"), {
      target: { value: "2026-12-02 10:00" },
    });
    fireEvent.change(screen.getByLabelText("dataCatalog.buildSchedule.endTime"), {
      target: { value: "2026-12-01 10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(
      await screen.findByText("dataCatalog.buildSchedule.invalidTimeRange"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
