/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { renderWithoutAntdStyles } from "@/test/render-without-antd-styles";

import { ObjectTypeDataAttributeEditor } from "./ObjectTypeDataAttributeEditor";
import { ObjectTypeDataAttributePickModal } from "./ObjectTypeDataAttributePickModal";

const mocks = vi.hoisted(() => ({
  message: { error: vi.fn(), success: vi.fn() },
  modal: { confirm: vi.fn() },
  t: (key: string) => key,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.t }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: mocks.message, modal: mocks.modal }),
}));

vi.mock("./ObjectTypeDataAttributeFormDrawer", () => ({
  ObjectTypeDataAttributeFormDrawer: () => null,
}));

vi.mock("./ObjectTypeResourceDescriptionFillModal", () => ({
  ObjectTypeResourceDescriptionFillModal: () => null,
}));

vi.mock("./ObjectTypeResourceSelectModal", () => ({
  ObjectTypeResourceSelectModal: () => null,
}));

const originalMatchMedia = window.matchMedia;
const fields = Array.from({ length: 13 }, (_, index) => ({
  displayName: `Field ${index + 1}`,
  name: `field_${index + 1}`,
  type: "string" as const,
}));

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  }));
});

afterAll(() => {
  window.matchMedia = originalMatchMedia;
});

describe("ObjectTypeDataAttributeEditor with its real pick modal", () => {
  it("keeps mapped connections updating through repeated native canvas drags while the modal is closed", async () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const className = typeof this.className === "string" ? this.className : "";
        if (className.includes("panelHandleRight") || className.includes("panelHandleLeft")) {
          const viewport = this.closest<HTMLElement>('[class*="canvasViewport"]');
          const transform = viewport?.style.transform ?? "";
          const match = /translate\((-?\d+)px, (-?\d+)px\)/.exec(transform);
          const panX = Number(match?.[1] ?? 0);
          const panY = Number(match?.[2] ?? 0);
          const zoom = Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1);
          return new DOMRect(
            (className.includes("panelHandleRight") ? 450 : 760) * zoom + panX,
            100 * zoom + panY,
            8 * zoom,
            8 * zoom,
          );
        }
        return new DOMRect();
      });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { container } = renderWithoutAntdStyles(
        <ObjectTypeDataAttributeEditor
          basicValue={{ color: "#1677ff", name: "Sales orders" }}
          dataProperties={fields.map((field) => ({
            displayKey: false,
            displayName: field.displayName,
            incrementalKey: false,
            mappedField: field,
            name: field.name,
            primaryKey: false,
            type: field.type,
          }))}
          dataSource={{ id: "orders", name: "Orders" }}
          networkId="network-1"
          onChange={vi.fn()}
          readResourceFields={vi.fn().mockResolvedValue(fields)}
        />,
      );
      const viewport = container.querySelector<HTMLElement>('[class*="canvasViewport"]');
      const canvas = viewport?.parentElement;
      const connectionLayer = container.querySelector<SVGSVGElement>(
        'svg[class*="connectionLayer"]',
      );
      expect(canvas).not.toBeNull();
      expect(connectionLayer).not.toBeNull();
      if (!canvas || !connectionLayer) return;

      const connectionPaths = () => [...connectionLayer.querySelectorAll("path")];
      await waitFor(() => expect(connectionPaths()).toHaveLength(13));
      const firstPath = connectionPaths()[0];
      const pathValues = new Set([firstPath.getAttribute("d")]);

      canvas.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      for (let step = 1; step <= 160; step += 1) {
        canvas.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: 10 + step,
            clientY: 10 + step,
          }),
        );
        await new Promise((resolve) => window.setTimeout(resolve, 2));
        pathValues.add(firstPath.getAttribute("d"));
      }
      canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      expect(connectionPaths()).toHaveLength(13);
      expect(pathValues.size).toBeGreaterThan(50);
      const beforeZoom = firstPath.getAttribute("d");
      fireEvent.click(screen.getByRole("button", { name: "common.zoomIn" }));
      await waitFor(() => expect(firstPath.getAttribute("d")).not.toBe(beforeZoom));

      const viewHandle = container.querySelector<HTMLElement>('span[class*="panelHandleRight"]');
      const propertyHandle = container.querySelector<HTMLElement>('span[class*="panelHandleLeft"]');
      const coordinates =
        /^M ([-\d.]+) ([-\d.]+) C [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+, ([-\d.]+) ([-\d.]+)$/.exec(
          firstPath.getAttribute("d") ?? "",
        );
      if (!viewHandle || !propertyHandle || !coordinates) {
        throw new Error("Mapped connection endpoints are missing");
      }
      const canvasRect = canvas.getBoundingClientRect();
      const viewRect = viewHandle.getBoundingClientRect();
      const propertyRect = propertyHandle.getBoundingClientRect();
      expect(Number(coordinates[1])).toBeCloseTo(
        viewRect.left + viewRect.width / 2 - canvasRect.left + canvas.scrollLeft,
      );
      expect(Number(coordinates[2])).toBeCloseTo(
        viewRect.top + viewRect.height / 2 - canvasRect.top + canvas.scrollTop,
      );
      expect(Number(coordinates[3])).toBeCloseTo(
        propertyRect.left + propertyRect.width / 2 - canvasRect.left + canvas.scrollLeft,
      );
      expect(Number(coordinates[4])).toBeCloseTo(
        propertyRect.top + propertyRect.height / 2 - canvasRect.top + canvas.scrollTop,
      );
      expect(
        consoleError.mock.calls.some((parts) =>
          parts.some((part) =>
            /Maximum update depth exceeded|Minified React error #185/.test(String(part)),
          ),
        ),
      ).toBe(false);
    } finally {
      rect.mockRestore();
      consoleError.mockRestore();
    }
  }, 60_000);
});

describe("ObjectTypeDataAttributePickModal lifecycle", () => {
  it("opens, cancels, confirms a selection, and resets it when reopened", async () => {
    const onConfirm = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Open picker
          </button>
          <ObjectTypeDataAttributePickModal
            fields={fields.slice(0, 1)}
            onCancel={() => setOpen(false)}
            onOk={(names) => {
              onConfirm(names);
              setOpen(false);
            }}
            open={open}
          />
        </>
      );
    }

    renderWithoutAntdStyles(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open picker" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Open picker" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.ok" })).toBeDisabled();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByRole("button", { name: "common.ok" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));
    expect(onConfirm).toHaveBeenCalledWith(["field_1"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Open picker" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.ok" })).toBeDisabled();
  });
});
