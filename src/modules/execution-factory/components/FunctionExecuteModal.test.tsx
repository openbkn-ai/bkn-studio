/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { FunctionExecuteModal } from "@/modules/execution-factory/components/FunctionExecuteModal";
import type { FunctionAiApplyResult } from "@/modules/execution-factory/utils/function-ai-content";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/execution-factory/services/function.service", () => ({
  executeFunction: vi.fn(),
}));

vi.mock("@/modules/execution-factory/components/FunctionAiGenerateModal", () => ({
  FunctionAiGenerateModal: ({ onApply, open }: {
    onApply?: (result: FunctionAiApplyResult) => void;
    open: boolean;
  }) => open ? (
    <>
      <button
        onClick={() => onApply?.({ type: "metadata", name: "ignored_name" })}
        type="button"
      >
        apply-metadata
      </button>
      <button
        onClick={() => onApply?.({ type: "code", code: "def generated(event):\n    return 1\n" })}
        type="button"
      >
        apply-code
      </button>
    </>
  ) : null,
}));

const INITIAL_CODE = "def handler(event):\n    return event\n";

describe("FunctionExecuteModal", () => {
  beforeAll(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })));
  });

  afterEach(cleanup);

  it("writes AI-generated code into the code field and ignores metadata results", async () => {
    render(<FunctionExecuteModal canGenerate initialCode={INITIAL_CODE} onClose={vi.fn()} open />);

    await waitFor(() => expect(screen.getByDisplayValue(/def handler/)).toBeTruthy());
    fireEvent.click(screen.getByText("executionFactory.functionAiGenerate"));

    fireEvent.click(screen.getByText("apply-metadata"));
    expect(screen.getByDisplayValue(/def handler/)).toBeTruthy();

    fireEvent.click(screen.getByText("apply-code"));
    await waitFor(() => expect(screen.getByDisplayValue(/def generated/)).toBeTruthy());
  });

  it("does not offer AI generation without the Function create grant", async () => {
    render(<FunctionExecuteModal canGenerate={false} initialCode={INITIAL_CODE} onClose={vi.fn()} open />);

    await waitFor(() => expect(screen.getByDisplayValue(/def handler/)).toBeTruthy());
    expect(screen.queryByText("executionFactory.functionAiGenerate")).toBeNull();
  });
});
