/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalCaseDetailTabs } from "./EvalCaseDetailTabs";

vi.mock("react-i18next", async (original) => ({
  ...(await original<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

it("shows result and execution tabs alongside AI repair", async () => {
  const onRepair = vi.fn();
  render(
    <EvalCaseDetailTabs
      networkId="kn"
      runId="run"
      caseRunId="case"
      resultRevision={1}
      eligible
      onRepair={onRepair}
      executionDetails={<p>Frozen execution</p>}
    >
      <p>Original result</p>
    </EvalCaseDetailTabs>,
  );
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "knowledgeNetwork.eval.detailTabs.resultTab",
    "knowledgeNetwork.eval.detailTabs.executionTab",
  ]);
  fireEvent.click(
    screen.getByRole("button", { name: "knowledgeNetwork.eval.resourceOverview.aiRepair" }),
  );
  await waitFor(() => expect(onRepair).toHaveBeenCalledOnce());
  expect(screen.getByText("Original result")).toBeVisible();
  fireEvent.click(
    screen.getByRole("tab", { name: "knowledgeNetwork.eval.detailTabs.executionTab" }),
  );
  expect(screen.getByText("Frozen execution")).toBeVisible();
});
