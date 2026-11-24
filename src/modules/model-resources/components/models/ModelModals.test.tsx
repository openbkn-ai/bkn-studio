/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import type { LlmModel } from "@/modules/model-resources/types/llm";
import { LlmModelFormModal } from "./ModelModals";

const { testModel, updateModel } = vi.hoisted(() => ({ testModel: vi.fn(), updateModel: vi.fn() }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn(), success: vi.fn() }, modal: {} }),
}));
vi.mock("@/modules/model-resources/services/llm.service", () => ({
  testLlmModel: testModel,
  updateLlmModel: updateModel,
  createLlmModel: vi.fn(),
  setDefaultLlmModel: vi.fn(),
}));
const model: LlmModel = {
  modelId: "model-1",
  modelName: "Test model",
  modelType: "llm",
  modelSeries: "deepseek",
  maxModelLen: 32,
  modelParameters: 7,
  modelConfig: { apiModel: "test-model", apiUrl: "https://model.example.com/" },
};
let consoleError: MockInstance<typeof console.error>;
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, "error");
  testModel.mockResolvedValue({ status: "ok" });
  updateModel.mockResolvedValue({ status: "ok" });
});
afterEach(() => {
  cleanup();
  const addonWarnings = consoleError.mock.calls.filter((args) => {
    const message: unknown = args[0];
    return (
      typeof message === "string" &&
      message.includes("[antd: InputNumber]") &&
      /addonAfter|addonBefore/.test(message)
    );
  });
  consoleError.mockRestore();
  expect(addonWarnings).toEqual([]);
});

describe("LlmModelFormModal numeric units", () => {
  it("keeps numeric fields bound when their units are displayed", async () => {
    const onClose = vi.fn();
    render(<LlmModelFormModal mode="edit" open record={model} onClose={onClose} />);
    const context = screen.getByRole("spinbutton", {
      name: "modelResources.models.columns.maximumContext",
    });
    const parameters = screen.getByRole("spinbutton", {
      name: "modelResources.models.columns.parameterQuantity",
    });
    expect(context).toHaveValue("32");
    expect(parameters).toHaveValue("7");
    expect(screen.getByText("K", { exact: true })).toBeVisible();
    expect(screen.getByText("B", { exact: true })).toBeVisible();
    fireEvent.change(context, { target: { value: "64" } });
    fireEvent.blur(context);
    fireEvent.change(parameters, { target: { value: "13" } });
    fireEvent.blur(parameters);
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(updateModel).toHaveBeenCalledTimes(1));
    expect(updateModel.mock.calls[0][0]).toMatchObject({ maxModelLen: 64, modelParameters: 13 });
    expect(onClose).toHaveBeenCalledWith(true);
  });
  it("keeps numeric fields disabled in read-only mode", () => {
    render(<LlmModelFormModal mode="view" open record={model} onClose={vi.fn()} />);
    expect(
      screen.getByRole("spinbutton", { name: "modelResources.models.columns.maximumContext" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("spinbutton", { name: "modelResources.models.columns.parameterQuantity" }),
    ).toBeDisabled();
  });
});
