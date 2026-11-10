/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ActionTypeActionSource,
  ActionTypeExecutionConfig,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ActionTypeToolInputParam } from "@/modules/knowledge-network/utils/tool-input-params";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";

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

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
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

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
    writable: true,
  });
});

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
  const relation = {
    id: "order_supplier",
    sourceObjectTypeId: "orders",
    targetObjectTypeId: "suppliers",
  } as KnowledgeNetworkRelationTypeRecord;
  const schema = [
    { key: "order_id", name: "order_id", type: "string" },
    { key: "supplier_id", name: "supplier_id", type: "string" },
  ];
  const object = (id: string, key: string) => ({
    id,
    name: id,
    primaryKeys: [key],
    dataProperties: [{ name: key, displayName: key, type: "string", primaryKey: true }],
  });

  function RelationEditor({
    selectedRelation,
    onChange,
  }: {
    selectedRelation: KnowledgeNetworkRelationTypeRecord;
    onChange: (value: ActionTypeExecutionConfig) => void;
  }) {
    const [value, setValue] = useState(() => createExecutionConfig(createSource("relation-tool")));
    return (
      <ActionTypeExecutionEditor
        networkId="network-1"
        objectTypeId=""
        relationBinding={{ relation: selectedRelation }}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it("reads each endpoint's configured identity and defaults matching tool inputs", async () => {
    resolveActionTypeToolInputSchema.mockResolvedValue(schema);
    getKnowledgeNetworkObjectTypeDetail.mockImplementation((_network: string, id: string) =>
      Promise.resolve(object(id, id === "orders" ? "order_id" : "supplier_id")),
    );
    const onChange = vi.fn();
    render(<RelationEditor selectedRelation={relation} onChange={onChange} />);
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          parameters: [
            expect.objectContaining({
              name: "order_id",
              valueFrom: "source_identity",
              value: undefined,
            }),
            expect.objectContaining({
              name: "supplier_id",
              valueFrom: "target_identity",
              value: undefined,
            }),
          ],
        }),
      ),
    );
    expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledWith("network-1", "orders");
    expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledWith("network-1", "suppliers");
  });

  it("ignores late identity responses after switching to another relationship", async () => {
    const oldSource = createDeferred<ReturnType<typeof object>>();
    const oldTarget = createDeferred<ReturnType<typeof object>>();
    resolveActionTypeToolInputSchema.mockResolvedValue(schema);
    getKnowledgeNetworkObjectTypeDetail.mockImplementation(async (_network: string, id: string) =>
      id === "orders"
        ? oldSource.promise
        : id === "suppliers"
          ? oldTarget.promise
          : object(id, id === "projects" ? "project_id" : "employee_id"),
    );
    const onChange = vi.fn();
    const { rerender } = render(<RelationEditor selectedRelation={relation} onChange={onChange} />);
    await waitFor(() =>
      expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledWith("network-1", "orders"),
    );
    rerender(
      <RelationEditor
        selectedRelation={{
          ...relation,
          id: "project_employee",
          sourceObjectTypeId: "projects",
          targetObjectTypeId: "employees",
        }}
        onChange={onChange}
      />,
    );
    await waitFor(() =>
      expect(getKnowledgeNetworkObjectTypeDetail).toHaveBeenCalledWith("network-1", "employees"),
    );
    await act(async () => {
      oldSource.resolve(object("orders", "order_id"));
      oldTarget.resolve(object("suppliers", "supplier_id"));
      await Promise.all([oldSource.promise, oldTarget.promise]);
    });
    expect(
      onChange.mock.calls.some(([value]) =>
        (value as ActionTypeExecutionConfig).parameters.some(
          (parameter) =>
            parameter.valueFrom === "source_identity" || parameter.valueFrom === "target_identity",
        ),
      ),
    ).toBe(false);
  });
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
