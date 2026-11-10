/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, screen } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { EvalEvidenceContent } from "./EvalEvidenceContent";
import { parsePrecisionPreservingJSON } from "@/framework/request/precision-safe-json";
vi.mock("./useEvalTranslation", () => ({
  useEvalTranslation: () => ({
    t: (key: string) => key.split(".").at(-1),
    i18n: { language: "zh-CN" },
  }),
}));
it("redacts nested credential fields without losing business identifiers", () => {
  const content = parsePrecisionPreservingJSON(
    '{"id":9007199254740993,"nested":[{"authorization":"private-token","ok":false}],"api_key":"private-key"}',
  );
  const { container } = render(<EvalEvidenceContent id="request" content={content} />);
  expect(container.textContent).not.toContain("private-token");
  expect(container.textContent).not.toContain("private-key");
  expect(container.textContent).toContain("9007199254740993");
  expect(container.textContent).toContain('"ok": false');
});
it.each([
  "Authorization: private-auth-header",
  "Bearer private-bearer-value",
  "password=private-password",
  "https://private-user:private-pass@host/path",
  "-----BEGIN PRIVATE KEY-----private-pem-----END PRIVATE KEY-----",
])("redacts secrets embedded inside a diagnostic string (%s)", (content) => {
  const { container } = render(
    <EvalEvidenceContent id="diagnostic" content={{ message: content }} />,
  );
  expect(container.textContent).toContain("REDACTED");
  for (const secret of [
    "private-auth-header",
    "private-bearer-value",
    "private-password",
    "private-user",
    "private-pass",
    "private-pem",
  ])
    expect(container.textContent).not.toContain(secret);
});
it("bounds recursive and deeply nested evidence", () => {
  const recursive: Record<string, unknown> = {};
  recursive.child = recursive;
  const { container } = render(<EvalEvidenceContent id="diagnostic" content={recursive} />);
  expect(container.textContent).toContain("[truncated]");
});
it("renders run state as readable fields while raw material remains collapsed", () => {
  render(
    <EvalEvidenceContent
      id="run"
      content={{
        execution_status: "completed",
        quality_outcome: "inconclusive",
        runner_type: "external_agent",
        assessment_scope: "runtime",
        finished_at: null,
      }}
    />,
  );
  expect(screen.getByText("completed")).toBeVisible();
  expect(screen.getByText("inconclusive")).toBeVisible();
  expect(screen.getByText("unrecorded")).toBeVisible();
  expect(screen.getByRole("button", { name: /raw/ })).toHaveAttribute("aria-expanded", "false");
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
