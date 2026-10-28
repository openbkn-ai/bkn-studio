/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeTextToClipboard } from "@/framework/compat/clipboard";

import { LlmApiGuideDrawer } from "./LlmApiGuideDrawer";
import { SmallModelApiGuideDrawer } from "./SmallModelApiGuideDrawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { success: vi.fn(), error: vi.fn() } }),
}));

vi.mock("@/framework/compat/clipboard", () => ({
  writeTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ModelApiGuideMonacoEditor", () => ({
  ModelApiGuideMonacoEditor: ({ value }: { value: string }) => (
    <pre data-testid="guide-code">{value}</pre>
  ),
}));

vi.mock("./ModelApiGuideTable", () => ({
  ModelApiGuideTable: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(["llm", "embedding", "reranker"] as const)("%s API guide", (modelType) => {
  it.each([
    ["different upstream name", "upstream-model"],
    ["same upstream name", "Registered model"],
    ["empty upstream name", ""],
    ["missing model configuration", undefined],
  ])("uses the registered name for displayed and copied examples with %s", async (_, apiModel) => {
    const record = {
      modelId: "registered-id",
      modelName: "Registered model",
      modelType,
      modelSeries: "openai",
      modelConfig:
        apiModel === undefined
          ? undefined
          : { apiModel, apiUrl: "https://provider.example/v1", apiKey: "provider-secret" },
    };

    if (modelType === "llm") {
      render(<LlmApiGuideDrawer open onClose={vi.fn()} record={record} />);
    } else {
      render(<SmallModelApiGuideDrawer open onClose={vi.fn()} record={record} />);
    }

    const codeBlocks = screen.getAllByTestId("guide-code");
    expect(codeBlocks).toHaveLength(modelType === "llm" ? 2 : 1);
    for (const [index, codeBlock] of codeBlocks.entries()) {
      const example = codeBlock.textContent;
      expect(example).toMatch(/(?:"model"\s*:\s*|model=)"Registered model"/);
      expect(example).not.toContain("upstream-model");
      expect(example).not.toContain("provider-secret");
      expect(example).toContain("$api_key");
      expect(example).toContain("/api/mf-model-api/v1/");

      fireEvent.click(within(codeBlock.parentElement!).getByRole("button"));
      await waitFor(() => {
        expect(writeTextToClipboard).toHaveBeenNthCalledWith(index + 1, example);
      });
    }
  });
});
