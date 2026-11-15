/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EvalCaseContract } from "./EvalCaseContract";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({ t: (key: string) => key.split(".").at(-1) }),
}));

it("renders only the existing contract, including raw complex schemas and undeclared output", () => {
  const input = {
    oneOf: [{ type: "object", properties: { id: { type: "integer" } } }, { type: "string" }],
  };
  const { container } = render(<EvalCaseContract contract={{ input }} />);
  expect(container.querySelector("pre")).toBeNull();
  fireEvent.click(screen.getByText("contractTitle"));
  expect(screen.getByText("contractUndeclared")).toBeVisible();
  expect(container.querySelector("pre")?.textContent).toContain('"oneOf"');
  expect(container.querySelectorAll("input,button[type=submit]")).toHaveLength(0);
});
it("does not invent a contract for resources without one", () => {
  const { container } = render(<EvalCaseContract contract={{}} />);
  expect(container).toBeEmptyDOMElement();
});
