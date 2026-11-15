/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { JsonSchemaIoPanel } from "./JsonSchemaIoPanel";
import { JsonCodeBlock } from "./JsonCodeBlock";
import { JsonTextBlock } from "@/framework/json/JsonTextBlock";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});
it("preserves factory contract fields, wrapping, and raw input/output schemas after extraction", () => {
  const input = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "integer", description: "identifier" } },
  };
  const output = { type: "object", properties: { rows: { type: ["array", "null"] } } };
  const { container } = render(<JsonSchemaIoPanel schema={input} outputSchema={output} />);
  expect(screen.getByText("id")).toBeVisible();
  expect(screen.getByText("identifier")).toBeVisible();
  expect(screen.getByText("array | null")).toBeVisible();
  expect(container.querySelector(".ant-table-cell-ellipsis")).toBeNull();
  expect(container.querySelectorAll("pre")[0]?.textContent).toBe(JSON.stringify(input, null, 2));
  expect(container.querySelectorAll("pre")[1]?.textContent).toBe(JSON.stringify(output, null, 2));
});
it("keeps the factory missing-output hint and value formatting policy", () => {
  const view = render(<JsonSchemaIoPanel schema={{ type: "object" }} />);
  expect(screen.getByText("executionFactory.mcpToolOutputSchemaUndeclared")).toBeVisible();
  view.rerender(<JsonCodeBlock value='{ "ok": false }' />);
  expect(view.container.querySelector("pre")?.textContent).toBe('{\n  "ok": false\n}');
  expect(view.container.querySelector("pre")).not.toHaveStyle({ maxHeight: "360px" });
  view.rerender(<JsonCodeBlock value={null} />);
  expect(view.container.querySelector("pre")?.textContent).toBe("-");
});
it("makes bounded result height explicit for consumers without changing factory defaults", () => {
  const view = render(<JsonTextBlock text="{}" />);
  expect(view.container.querySelector("pre")?.style.maxHeight).toBe("");
  view.rerender(<JsonTextBlock text="{}" maxHeight={360} />);
  expect(view.container.querySelector("pre")).toHaveStyle({ maxHeight: "360px", overflow: "auto" });
});
