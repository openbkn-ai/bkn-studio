/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

import { BuildProgress } from "./BuildProgress";
import styles from "./shared.module.css";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    i18n: { language: "zh-CN" },
    t: (key: string) => key,
  }),
}));

function buildTask(overrides: Partial<BuildTask> = {}): BuildTask {
  return {
    primaryKeyFields: [],
    incrementalFields: [],
    createTime: 0,
    embeddingFields: [],
    embeddingModel: "",
    error: null,
    finishTime: 0,
    fulltextAnalyzer: "",
    fulltextFields: [],
    id: "task-1",
    lastProgressTime: null,
    mode: "batch",
    modelDimensions: 0,
    resourceId: "resource-1",
    startTime: 0,
    status: "completed",
    syncedCount: 0,
    totalCount: 0,
    ...overrides,
  };
}

describe("BuildProgress", () => {
  it("renders an empty completed batch task as complete", () => {
    const { container } = render(<BuildProgress task={buildTask()} />);

    expect(container.querySelector('span[style="width: 100%;"]')).not.toBeNull();
  });

  it("does not mark an empty active batch task as complete", () => {
    const { container } = render(
      <BuildProgress task={buildTask({ finishTime: null, status: "running" })} />,
    );

    expect(container.querySelector('span[style="width: 0%;"]')).not.toBeNull();
  });

  it.each(["cancelled", "pending", "stopped"] as const)(
    "renders a %s batch task with a muted progress bar",
    (status) => {
      const { container } = render(
        <BuildProgress task={buildTask({ status, syncedCount: 24, totalCount: 60 })} />,
      );

      expect(container.querySelector(`span.${styles.progressFillMuted}`)).not.toBeNull();
    },
  );
});
