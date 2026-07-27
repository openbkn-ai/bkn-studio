/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ActionTypeActionSource,
  ActionTypeExecutionConfig,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";

const {
  getKnowledgeNetworkObjectTypeDetail,
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
  resolveActionTypeToolInputSchema,
} = vi.hoisted(() => ({
  getKnowledgeNetworkObjectTypeDetail: vi.fn(),
  needsActionTypeActionSourceDisplayResolution: vi.fn(),
  resolveActionTypeActionSourceDisplayWithTimeout: vi.fn(),
  resolveActionTypeToolInputSchema: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getKnowledgeNetworkObjectTypeDetail,
}));

vi.mock("@/modules/knowledge-network/services/action-type-tool.service", () => ({
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
  resolveActionTypeToolInputSchema,
}));

vi.mock("./ActionTypeSourcePicker", () => ({
  ActionTypeSourcePicker: () => null,
}));

vi.mock("./ActionTypeToolParamsTable", () => ({
  ActionTypeToolParamsTable: () => null,
}));

import { ActionTypeExecutionEditor } from "./ActionTypeExecutionEditor";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function createSource(toolId: string): ActionTypeActionSource {
  return {
    boxId: "box-1",
    boxName: "Demo Box",
    toolId,
    toolName: toolId,
    type: "tool",
  };
}

function createExecutionConfig(actionSource: ActionTypeActionSource): ActionTypeExecutionConfig {
  return {
    actionSource,
    parameters: [],
    sourceName: actionSource.toolName ?? "",
    sourceType: actionSource.type,
  };
}

beforeEach(() => {
  getKnowledgeNetworkObjectTypeDetail.mockResolvedValue({ dataProperties: [] });
  needsActionTypeActionSourceDisplayResolution.mockReturnValue(false);
  resolveActionTypeActionSourceDisplayWithTimeout.mockResolvedValue(undefined);
  resolveActionTypeToolInputSchema.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ActionTypeExecutionEditor schema loading", () => {
  it("ignores stale schema responses after the selected source changes", async () => {
    const noInputSchema = createDeferred<ActionTypeToolInputParam[]>();
    const requiredInputSchema = createDeferred<ActionTypeToolInputParam[]>();
    resolveActionTypeToolInputSchema
      .mockReturnValueOnce(noInputSchema.promise)
      .mockReturnValueOnce(requiredInputSchema.promise);

    const onChange = vi.fn();
    const onParameterSchemaStateChange = vi.fn();
    const { rerender } = render(
      <ActionTypeExecutionEditor
        networkId="network-1"
        objectTypeId="object-type-1"
        onChange={onChange}
        onParameterSchemaStateChange={onParameterSchemaStateChange}
        value={createExecutionConfig(createSource("tool-a"))}
      />,
    );

    await waitFor(() => {
      expect(resolveActionTypeToolInputSchema).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ActionTypeExecutionEditor
        networkId="network-1"
        objectTypeId="object-type-1"
        onChange={onChange}
        onParameterSchemaStateChange={onParameterSchemaStateChange}
        value={createExecutionConfig(createSource("tool-b"))}
      />,
    );

    await waitFor(() => {
      expect(resolveActionTypeToolInputSchema).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      noInputSchema.resolve([]);
      await noInputSchema.promise;
    });

    expect(onParameterSchemaStateChange).not.toHaveBeenLastCalledWith({
      loaded: true,
      parameterCount: 0,
    });
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      requiredInputSchema.resolve([
        {
          key: "amount",
          name: "amount",
          required: true,
          source: "Body",
          type: "number",
        },
      ]);
      await requiredInputSchema.promise;
    });

    await waitFor(() => {
      expect(onParameterSchemaStateChange).toHaveBeenLastCalledWith({
        loaded: true,
        parameterCount: 1,
      });
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: [
          expect.objectContaining({
            name: "amount",
          }),
        ],
      }),
    );
  });
});
