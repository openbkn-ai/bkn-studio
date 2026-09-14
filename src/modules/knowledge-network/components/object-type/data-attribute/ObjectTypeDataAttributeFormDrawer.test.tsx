/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capability: "available",
  messageError: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/framework/entitlement/use-entitlement", () => ({
  useCapability: () => mocks.capability,
  useEntitlementContext: () => ({ snapshot: null }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({ message: { error: mocks.messageError } }),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Drawer: ({ children, footer, open, title }: {
      children?: ReactNode;
      footer?: ReactNode;
      open?: boolean;
      title?: ReactNode;
    }) => open ? <div><h1>{title}</h1>{children}{footer}</div> : null,
  };
});

import { ObjectTypeDataAttributeFormDrawer } from "./ObjectTypeDataAttributeFormDrawer";

const property = {
  displayKey: false,
  displayName: "手机号",
  incrementalKey: false,
  maskRule: { kind: "partial" as const, keepEnd: 4, keepStart: 3, replacement: "*" },
  name: "mobile",
  primaryKey: false,
  type: "string",
};

const originalMatchMedia = window.matchMedia;
const originalConsoleError = console.error;

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (
      args.some((argument) => String(argument).includes("invalid value for the")) &&
      args.some((argument) => String(argument).includes("height"))
    ) {
      return;
    }
    originalConsoleError(...args);
  });
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
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mocks.capability = "available";
  mocks.messageError.mockReset();
});

describe("ObjectTypeDataAttributeFormDrawer modes", () => {
  it("mounts the configured mask rule and preview in mask-rule mode", async () => {
    const onSubmit = vi.fn();

    render(
      <ObjectTypeDataAttributeFormDrawer
        mode="mask-rule"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        open
        property={property}
      />,
    );

    expect(await screen.findByText("knowledgeNetwork.objectTypeMaskRuleTitle")).not.toBeNull();
    expect(await screen.findByText("common.entitlement.editionsShort.enterprise")).not.toBeNull();
    expect(await screen.findByText("knowledgeNetwork.objectTypeMaskRulePreview")).not.toBeNull();
    expect(await screen.findByText("138****5678")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.ok" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining(property));
  });

  it("switches to an email example when email masking is selected", async () => {
    render(
      <ObjectTypeDataAttributeFormDrawer
        mode="mask-rule"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
        property={property}
      />,
    );

    const ruleTypeLabel = await screen.findByText("knowledgeNetwork.objectTypeMaskRuleType");
    const ruleTypeSelect = ruleTypeLabel
      .closest(".ant-form-item")
      ?.querySelector(".ant-select-selector");

    expect(ruleTypeSelect).toBeTruthy();
    fireEvent.mouseDown(ruleTypeSelect!);
    fireEvent.click(screen.getByText("knowledgeNetwork.objectTypeMaskRuleKind.email"));

    expect(await screen.findByDisplayValue("zhangsan@example.com")).not.toBeNull();
    expect(await screen.findByText("z*******@example.com")).not.toBeNull();
  });

  it("offers masking rules for an unconfigured string property", async () => {
    render(
      <ObjectTypeDataAttributeFormDrawer
        mode="mask-rule"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
        property={{ ...property, maskRule: undefined }}
      />,
    );

    expect(
      screen.queryByText("knowledgeNetwork.objectTypeMaskRuleUnsupported"),
    ).toBeNull();

    const ruleTypeLabel = await screen.findByText("knowledgeNetwork.objectTypeMaskRuleType");
    const ruleTypeSelect = ruleTypeLabel
      .closest(".ant-form-item")
      ?.querySelector(".ant-select-selector");

    fireEvent.mouseDown(ruleTypeSelect!);
    expect(screen.getByText("knowledgeNetwork.objectTypeMaskRuleKind.fixed")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.objectTypeMaskRuleKind.partial")).not.toBeNull();
    expect(screen.getByText("knowledgeNetwork.objectTypeMaskRuleKind.email")).not.toBeNull();
  });

  it("does not mount mask configuration when the capability is unavailable", async () => {
    mocks.capability = "not-licensed";

    render(
      <ObjectTypeDataAttributeFormDrawer
        mode="mask-rule"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
        property={property}
      />,
    );

    expect(
      await screen.findByText("knowledgeNetwork.objectTypeMaskRuleDrawerTitle"),
    ).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.objectTypeMaskRuleTitle")).toBeNull();
  });

  it("hides mask-rule controls in the standard attribute editor", async () => {
    render(
      <ObjectTypeDataAttributeFormDrawer
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
        property={property}
      />,
    );

    expect(await screen.findByText("knowledgeNetwork.objectTypeEditDataProperty")).not.toBeNull();
    expect(screen.queryByText("knowledgeNetwork.objectTypeMaskRuleTitle")).toBeNull();
    expect(screen.getByText("knowledgeNetwork.objectTypePropertyName")).not.toBeNull();
  });

  it("keeps the drawer open and reports a rejected submission", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(
      <ObjectTypeDataAttributeFormDrawer
        onClose={onClose}
        onSubmit={onSubmit}
        open
        property={property}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "common.ok" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ maskRule: property.maskRule }),
    );
    expect(mocks.messageError).toHaveBeenCalledWith("Save failed");
    expect(onClose).not.toHaveBeenCalled();
  });
});
