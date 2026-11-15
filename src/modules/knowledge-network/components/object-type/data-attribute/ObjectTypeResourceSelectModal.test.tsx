/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ObjectTypeDataSource,
  ObjectTypeResourceListResult,
} from "@/modules/knowledge-network/types/knowledge-network";

const { getObjectTypeResourcePreview, listObjectTypeResourceGroups, queryObjectTypeResources } =
  vi.hoisted(() => ({
    getObjectTypeResourcePreview: vi.fn(),
    listObjectTypeResourceGroups: vi.fn(),
    queryObjectTypeResources: vi.fn(),
  }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/ui/common/BusinessTreePanel", () => ({
  BusinessTree: () => <div />,
}));

vi.mock("@/modules/knowledge-network/services/knowledge-network.service", () => ({
  getObjectTypeResourcePreview,
  listObjectTypeResourceGroups,
  queryObjectTypeResources,
}));

import { ObjectTypeResourceSelectModal } from "./ObjectTypeResourceSelectModal";

const nativeGetComputedStyle = window.getComputedStyle;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createResource(id: string, name: string): ObjectTypeDataSource {
  return { dataSourceId: "catalog-1", id, name };
}

beforeAll(() => {
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    nativeGetComputedStyle.call(window, element),
  );
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  getObjectTypeResourcePreview.mockReset();
  listObjectTypeResourceGroups.mockReset();
  queryObjectTypeResources.mockReset();
  getObjectTypeResourcePreview.mockResolvedValue(null);
  listObjectTypeResourceGroups.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe("ObjectTypeResourceSelectModal search", () => {
  it("keeps the latest search result when an older request resolves last", async () => {
    const staleResult = createDeferred<ObjectTypeResourceListResult>();
    const latestResult = createDeferred<ObjectTypeResourceListResult>();
    queryObjectTypeResources.mockImplementation((_networkId: string, query: { name?: string }) => {
      if (query.name === "t") {
        return staleResult.promise;
      }
      if (query.name === "test") {
        return latestResult.promise;
      }
      return Promise.resolve({ items: [], total: 0 });
    });

    render(
      <ObjectTypeResourceSelectModal networkId="kn-1" onCancel={vi.fn()} onOk={vi.fn()} open />,
    );

    const searchInput = screen.getByPlaceholderText("common.search");
    fireEvent.change(searchInput, { target: { value: "t" } });
    await waitFor(() => {
      expect(queryObjectTypeResources).toHaveBeenCalledWith(
        "kn-1",
        expect.objectContaining({ name: "t" }),
      );
    });

    fireEvent.change(searchInput, { target: { value: "test" } });
    await waitFor(() => {
      expect(queryObjectTypeResources).toHaveBeenCalledWith(
        "kn-1",
        expect.objectContaining({ name: "test" }),
      );
    });

    await act(async () => {
      latestResult.resolve({ items: [createResource("test-1", "test.reviews")], total: 1 });
      await latestResult.promise;
    });
    expect(await screen.findByText("test.reviews")).toBeTruthy();

    await act(async () => {
      staleResult.resolve({
        items: [createResource("stale-1", "public.coupon_templates")],
        total: 1,
      });
      await staleResult.promise;
    });

    expect(screen.getByText("test.reviews")).toBeTruthy();
    expect(screen.queryByText("public.coupon_templates")).toBeNull();
  });

  it("keeps an in-flight request valid when raw search trims to the same value", async () => {
    const initialResult = createDeferred<ObjectTypeResourceListResult>();
    queryObjectTypeResources.mockReturnValue(initialResult.promise);

    render(
      <ObjectTypeResourceSelectModal networkId="kn-1" onCancel={vi.fn()} onOk={vi.fn()} open />,
    );

    await waitFor(() => {
      expect(queryObjectTypeResources).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText("common.search"), {
      target: { value: " " },
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    await act(async () => {
      initialResult.resolve({
        items: [createResource("resource-1", "Supply_DEMO")],
        total: 1,
      });
      await initialResult.promise;
    });

    expect(await screen.findByText("Supply_DEMO")).toBeTruthy();
    expect(queryObjectTypeResources).toHaveBeenCalledTimes(1);
  });
});

describe("ObjectTypeResourceSelectModal lifecycle", () => {
  it("keeps its Portal unmounted while closed and resets selection when reopened", async () => {
    const resource = createResource("resource-1", "Supply_DEMO");
    const onOk = vi.fn();
    queryObjectTypeResources.mockResolvedValue({ items: [resource], total: 1 });

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open resource picker
          </button>
          <ObjectTypeResourceSelectModal
            networkId="kn-1"
            onCancel={() => setOpen(false)}
            onOk={(selected) => {
              onOk(selected);
              setOpen(false);
            }}
            open={open}
          />
        </>
      );
    }

    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(queryObjectTypeResources).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open resource picker" }));
    expect(await screen.findByText(resource.name)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "common.ok" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Open resource picker" }));
    expect(await screen.findByText(resource.name)).toBeTruthy();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "common.ok" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));
    expect(onOk).toHaveBeenCalledWith(resource);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
