/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: vi.fn() } }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Drawer: ({
      children,
      footer,
      open,
    }: {
      children?: ReactNode;
      footer?: ReactNode;
      open?: boolean;
    }) =>
      open ? (
        <div>
          {children}
          {footer}
        </div>
      ) : null,
  };
});

import type { ObjectTypeLogicProperty } from "@/modules/knowledge-network/types/knowledge-network";

import { ObjectTypeLogicAttributeEditDrawer } from "./ObjectTypeLogicAttributeEditDrawer";

const originalMatchMedia = window.matchMedia;

beforeAll(() => {
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
  window.matchMedia = originalMatchMedia;
});

afterEach(() => {
  cleanup();
});

describe("ObjectTypeLogicAttributeEditDrawer", () => {
  it("rejects a logic-property display name over 128 Unicode code points", async () => {
    const onOk = vi.fn();

    render(
      <ObjectTypeLogicAttributeEditDrawer
        allData={[]}
        attrInfo={{} as ObjectTypeLogicProperty}
        logicFields={[]}
        onClose={vi.fn()}
        onOk={onOk}
        open
      />,
    );

    fireEvent.change(
      await screen.findByLabelText("knowledgeNetwork.objectTypePropertyDisplayName"),
      { target: { value: "😀".repeat(129) } },
    );
    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    expect(
      await screen.findByText("knowledgeNetwork.objectTypePropertyDisplayNameMaxLength"),
    ).not.toBeNull();
    expect(onOk).not.toHaveBeenCalled();
  });
});
