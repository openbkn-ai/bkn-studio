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

import { RowFilterAuthorizationPanel } from "./RowFilterAuthorizationPanel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function snapshot(subjectId: string, template: "all_rows" | "no_rows"): RowFilterSnapshot {
  return {
    availableFields: [],
    availableTemplates: ["all_rows", "no_rows"],
    objectTypeRef: "network-1/object-1",
    policy: { template },
    revision: `${subjectId}-revision`,
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

    const selectedB = snapshot("user-b", "no_rows");
    bSnapshot.resolve(selectedB);
    bExplain.resolve(explain(selectedB));
    expect(
      (await screen.findAllByText("knowledgeNetwork.rowFilterTemplate.no_rows")).length,
    ).toBeGreaterThan(0);

    const staleA = snapshot("user-a", "all_rows");
    aSnapshot.resolve(staleA);
    aExplain.resolve(explain(staleA));
    await waitFor(() =>
      expect(screen.queryAllByText("knowledgeNetwork.rowFilterTemplate.all_rows")).toHaveLength(0),
    );
    expect(
      screen.getAllByText("knowledgeNetwork.rowFilterTemplate.no_rows").length,
    ).toBeGreaterThan(0);
  });
});
