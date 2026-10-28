/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SmallModelFormModal } from "./SmallModelFormModal";

const { testModel, updateModel, error, success } = vi.hoisted(() => ({
  testModel: vi.fn(),
  updateModel: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error, success }, modal: {} }),
}));
vi.mock("@/modules/model-resources/services/small-model.service", () => ({
  testSmallModel: testModel,
  updateSmallModel: updateModel,
  createSmallModel: vi.fn(),
  setDefaultSmallModel: vi.fn(),
}));
vi.mock("./AdaptationCodeEditor", () => ({
  AdaptationCodeEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Adapter code"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

function renderModal() {
  render(
    <SmallModelFormModal
      mode="edit"
      open
      onClose={vi.fn()}
      record={{
        modelId: "1234567890123456789",
        modelName: "Python embedding",
        modelType: "embedding",
        adapter: true,
        adapterCode: "saved code",
        batchSize: 2,
        maxTokens: 128,
        embeddingDim: 4,
      }}
    />,
  );
}

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  updateModel.mockResolvedValue({ status: "ok" });
});

describe("Python adapter draft save", () => {
  it("tests and saves the same snapshot and locks the editor while testing", async () => {
    let finishTest: ((value: { status: string }) => void) | undefined;
    testModel.mockReturnValue(
      new Promise<{ status: string }>((resolve) => {
        finishTest = resolve;
      }),
    );
    renderModal();
    fireEvent.change(screen.getByLabelText("Adapter code"), { target: { value: "current draft" } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => expect(testModel).toHaveBeenCalledOnce());
    expect(testModel.mock.calls[0][0]).toMatchObject({
      adapterCode: "current draft",
      change: false,
    });
    expect(screen.getByLabelText<HTMLTextAreaElement>("Adapter code").readOnly).toBe(true);
    finishTest?.({ status: "ok" });
    await waitFor(() => expect(updateModel).toHaveBeenCalledOnce());
    expect(updateModel.mock.calls[0][0]).toBe(testModel.mock.calls[0][0]);
  }, 30_000);

  it("shows the test failure and does not save an invalid draft", async () => {
    testModel.mockRejectedValue(new Error("Adapter syntax error"));
    renderModal();
    fireEvent.change(screen.getByLabelText("Adapter code"), { target: { value: "return {" } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Adapter syntax error"));
    expect(updateModel).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("tests the current editor code when Test connection is clicked", async () => {
    testModel.mockResolvedValue({ status: "ok" });
    renderModal();
    fireEvent.change(screen.getByLabelText("Adapter code"), { target: { value: "fixed code" } });
    fireEvent.click(screen.getByText("modelResources.models.modal.testConnection"));
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(testModel.mock.calls[0][0]).toMatchObject({ adapterCode: "fixed code" });
    expect(updateModel).not.toHaveBeenCalled();
  });
});
