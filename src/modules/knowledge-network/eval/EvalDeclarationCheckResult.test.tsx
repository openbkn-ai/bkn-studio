/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import "@/app/locales/i18n";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { EvalDeclarationCheckResult } from "./EvalDeclarationCheckResult";

it("shows candidate and unknown counts only when the backend supplied them", () => {
  const { container, rerender } = render(
    <EvalDeclarationCheckResult value={{ findings: [], checked: 2, violations: 1 }} />,
  );
  expect(container.querySelectorAll(".ant-typography")).toHaveLength(2);

  rerender(
    <EvalDeclarationCheckResult
      value={{ findings: [], checked: 2, violations: 1, candidates: 0, unknown: 3 }}
    />,
  );
  expect(container.querySelectorAll(".ant-typography")).toHaveLength(4);
  expect(container.textContent).toContain("0");
  expect(container.textContent).toContain("3");
});
