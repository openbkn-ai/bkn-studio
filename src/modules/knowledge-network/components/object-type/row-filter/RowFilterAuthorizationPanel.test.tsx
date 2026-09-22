/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RowFilterExplain,
  RowFilterSnapshot,
} from "@/modules/knowledge-network/types/row-filter-authorization";

const mocks = vi.hoisted(() => ({
  explain: vi.fn(),
  getSnapshot: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), warning: vi.fn() },
    modal: { confirm: vi.fn() },
  }),
}));

vi.mock("@/modules/system-admin", () => ({
  DirectoryUserPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <div>
      <button onClick={() => onChange("user-a")} type="button">
        select-user-a
      </button>
      <button onClick={() => onChange("user-b")} type="button">
        select-user-b
      </button>
    </div>
  ),
}));

vi.mock("@/modules/knowledge-network/services/row-filter-authorization.service", () => ({
  explainRowFilter: mocks.explain,
  getRowFilterSnapshot: mocks.getSnapshot,
  patchRowFilterPolicy: mocks.patch,
}));

import {
  RowFilterAuthorizationPanel,
  rowFilterFieldBusinessLabel,
  rowFilterFieldOptionLabel,
  parseRowFilterValues,
} from "./RowFilterAuthorizationPanel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function snapshot(subjectId: string): RowFilterSnapshot {
  return {
    availableFields: [{ name: "region", type: "string" }],
    objectTypeRef: "network-1/object-1",
    policy: {
      conditions: [{ operator: "in", propertyName: "region", values: ["east"] }],
      relation: "and",
    },
    revision: `${subjectId}-revision`,
    subject: { id: subjectId, type: "user" },
  };
}

function emptySnapshot(subjectId: string): RowFilterSnapshot {
  return {
    availableFields: [{ name: "region", type: "string" }],
    objectTypeRef: "network-1/object-1",
    policy: null,
    revision: null,
    subject: { id: subjectId, type: "user" },
  };
}

function explain(value: RowFilterSnapshot): RowFilterExplain {
  return {
    directPolicy: value.policy ?? undefined,
    effectiveRowFilterDigest: `${value.subject.id}-digest`,
    rolePolicies: [],
    rolePolicyOnly: false,
    snapshot: value,
  };
}

function renderPanel() {
  return render(
    <RowFilterAuthorizationPanel
      discardNonce={0}
      objectTypeRef="network-1/object-1"
      onBeforeSubjectChange={(next) => next()}
      onDirtyChange={vi.fn()}
      roles={[]}
      users={[]}
    />,
  );
}

describe("RowFilterAuthorizationPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the business field label next to its persisted technical name", () => {
    const field = {
      displayName: "Sales order number",
      name: "sales_order_id",
      type: "string" as const,
    };
    expect(rowFilterFieldBusinessLabel(field)).toBe("Sales order number (sales_order_id)");
    expect(rowFilterFieldOptionLabel(field)).toBe("Sales order number (sales_order_id) · string");
    expect(rowFilterFieldOptionLabel({ name: "sales_order_id", type: "string" })).toBe(
      "sales_order_id · string",
    );
  });

  it("accepts Chinese and English commas when parsing condition values", () => {
    expect(parseRowFilterValues("aa,bb，cc\ndd,", "string")).toEqual(["aa", "bb", "cc", "dd"]);
  });

  it("configures only fixed conditions and does not expose automatic matching", async () => {
    const value = emptySnapshot("user-a");
    mocks.getSnapshot.mockResolvedValue(value);
    mocks.explain.mockResolvedValue(explain(value));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "select-user-a" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "knowledgeNetwork.rowFilterConfigure" }),
    );

    expect(screen.getByText("knowledgeNetwork.rowFilterAddCondition")).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.rowFilterAutomaticStrategy")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.rowFilterAutomaticScopeLabel")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.rowFilterUserIDFieldLabel")).toBeNull();
    expect(screen.queryByText("knowledgeNetwork.rowFilterFixedConditionsLabel")).toBeNull();
  });

  it("shows a retryable error instead of spinning forever when loading fails", async () => {
    mocks.getSnapshot.mockRejectedValue(new Error("backend unavailable"));
    mocks.explain.mockRejectedValue(new Error("backend unavailable"));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "select-user-a" }));

    expect(await screen.findByText("knowledgeNetwork.rowFilterLoadFailed")).not.toBeNull();
    expect(screen.getByText("backend unavailable")).not.toBeNull();
    expect(screen.getByRole("button", { name: "common.retry" })).not.toBeNull();
  });

  it("ignores a stale response after the selected subject changes", async () => {
    const aSnapshot = deferred<RowFilterSnapshot>();
    const aExplain = deferred<RowFilterExplain>();
    const bSnapshot = deferred<RowFilterSnapshot>();
    const bExplain = deferred<RowFilterExplain>();
    mocks.getSnapshot.mockImplementation(({ id }: { id: string }) =>
      id === "user-a" ? aSnapshot.promise : bSnapshot.promise,
    );
    mocks.explain.mockImplementation(({ id }: { id: string }) =>
      id === "user-a" ? aExplain.promise : bExplain.promise,
    );
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "select-user-a" }));
    fireEvent.click(screen.getByRole("button", { name: "select-user-b" }));

    const selectedB = snapshot("user-b");
    bSnapshot.resolve(selectedB);
    bExplain.resolve(explain(selectedB));
    expect(
      (await screen.findAllByText("knowledgeNetwork.rowFilterEffectFixedConditions")).length,
    ).toBeGreaterThan(0);

    const staleA = snapshot("user-a");
    aSnapshot.resolve(staleA);
    aExplain.resolve(explain(staleA));
    await waitFor(() =>
      expect(screen.queryAllByText("knowledgeNetwork.rowFilterEffectBasePermission")).toHaveLength(
        0,
      ),
    );
    expect(
      screen.getAllByText("knowledgeNetwork.rowFilterEffectFixedConditions").length,
    ).toBeGreaterThan(0);
  });
});
