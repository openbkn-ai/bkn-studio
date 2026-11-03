/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";
import type { Edition } from "@/framework/entitlement/edition";
import { EntitlementContext } from "@/framework/entitlement/entitlement-context";
import { FALLBACK_ENTITLEMENT } from "@/framework/entitlement/types";
import { mergeKnownConnectorTypes } from "@/modules/data-connect/lib/connector-template";
import type { DataConnectConnectorType } from "@/modules/data-connect/types/data-connect";
import { ConnectorTypePicker } from "./ConnectorTypePicker";

function renderPicker(edition: Edition | null, connector: Partial<DataConnectConnectorType> = {}) {
  const onChange = vi.fn();
  render(
    <EntitlementContext.Provider
      value={{
        loading: false,
        refresh: async () => {},
        snapshot: edition === null ? null : { ...FALLBACK_ENTITLEMENT, edition },
      }}
    >
      <MemoryRouter basename="/studio" initialEntries={["/studio/data-connect/new"]}>
        <Routes>
          <Route
            path="data-connect/new"
            element={
              <ConnectorTypePicker
                onChange={onChange}
                options={[
                  {
                    available: false,
                    category: "table",
                    description: "",
                    enabled: true,
                    fieldConfig: {},
                    mode: "local",
                    name: "Test connector",
                    type: "sqlserver",
                    ...connector,
                  },
                ]}
              />
            }
          />
          <Route path="system/subscription" element={<h1>Subscription page</h1>} />
        </Routes>
      </MemoryRouter>
    </EntitlementContext.Provider>,
  );
  const button = screen.getByText("Test connector").closest("button");
  if (!button) throw new Error("Connector selection button missing");
  return { button, onChange };
}

describe("ConnectorTypePicker edition guidance", () => {
  beforeEach(async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }));
    await i18n.changeLanguage("zh-CN");
  });

  it.each([
    ["sqlserver", "专业版"],
    ["oracle", "专业版"],
    ["doris", "专业版"],
    ["hana", "企业版"],
  ])("shows availability and an edition dialog action for %s", (type, edition) => {
    const { button, onChange } = renderPicker("community", { type });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("不可用");
    const action = screen.getByRole("button", { name: `需要${edition}及以上` });
    expect(action).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).not.toContainElement(action);
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(action);
    const dialog = screen.getByRole("dialog", { name: `解锁${edition}能力` });
    expect(screen.queryByRole("heading", { name: "Subscription page" })).not.toBeInTheDocument();
    expect(
      within(within(dialog).getByRole("list")).getByText(/SQL Server、Oracle、Doris/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/包含对应连接器实现的 Vega 部署镜像/)).toBeInTheDocument();
    const upgrade = within(dialog).getByRole("link", { name: `升级到${edition}` });
    expect(upgrade).toHaveAttribute("href", "https://license.openbkn.ai/");
    expect(upgrade).toHaveAttribute("target", "_blank");
    fireEvent.click(within(dialog).getByRole("button", { name: "查看版本对比" }));
    expect(screen.getByRole("heading", { name: "Subscription page" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["professional", "enterprise", "industry"] as const)(
    "keeps an unassembled professional connector disabled without upselling %s",
    (edition) => {
      const { button } = renderPicker(edition, { type: "doris" });
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent("不可用");
      expect(
        screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("requires Enterprise for HANA in Professional", () => {
    renderPicker("professional", { type: "hana" });
    expect(screen.getByRole("button", { name: "需要企业版及以上" })).toBeInTheDocument();
  });

  it.each(["enterprise", "industry"] as const)("does not upsell HANA in %s", (edition) => {
    const { button } = renderPicker(edition, { type: "hana" });
    expect(button).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
    ).not.toBeInTheDocument();
  });

  it("does not infer edition insufficiency from an unknown snapshot", () => {
    const { button } = renderPicker(null);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("不可用");
    expect(
      screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
    ).not.toBeInTheDocument();
  });

  it.each([true, false])("prioritizes administrator disablement when available=%s", (available) => {
    const { button, onChange } = renderPicker("community", { available, enabled: false });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("停用");
    expect(button).not.toHaveTextContent("不可用");
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("distinguishes missing backend records from explicitly disabled connectors", () => {
    const onChange = vi.fn();
    render(
      <ConnectorTypePicker
        onChange={onChange}
        options={mergeKnownConnectorTypes([
          {
            available: false,
            category: "table",
            description: "",
            enabled: false,
            fieldConfig: {},
            mode: "local",
            name: "Oracle",
            type: "oracle",
          },
        ])}
      />,
    );
    const missing = screen.getByText("SQL Server", { exact: true }).closest("button");
    const disabled = screen.getByText("Oracle", { exact: true }).closest("button");
    expect(missing).toBeDisabled();
    expect(missing).toHaveTextContent("不可用");
    expect(missing).not.toHaveTextContent("停用");
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveTextContent("停用");
    expect(disabled).not.toHaveTextContent("不可用");
    fireEvent.click(missing!);
    fireEvent.click(disabled!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses backend metadata ahead of the product fallback", () => {
    renderPicker("professional", { requiredEdition: "enterprise" });
    expect(screen.getByRole("button", { name: "需要企业版及以上" })).toBeInTheDocument();
  });

  it("does not replace a backend Community requirement with the fallback", () => {
    renderPicker("community", { requiredEdition: "community" });
    expect(
      screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
    ).not.toBeInTheDocument();
  });

  it.each([{ type: "custom" }, { type: "sqlserver", mode: "remote" }])(
    "does not invent edition metadata for $type in $mode mode",
    (connector) => {
      renderPicker("community", connector);
      expect(
        screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps confirmed insufficient editions disabled even if available=true", () => {
    const { button, onChange } = renderPicker("community", { available: true });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("allows selection when server state and edition permit it", () => {
    const { button, onChange } = renderPicker("professional", { available: true });
    expect(button).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /需要.*及以上|Requires .* or higher/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("sqlserver");
  });

  it("closes the dialog without selecting the unavailable connector", () => {
    const { button, onChange } = renderPicker("community");
    fireEvent.click(screen.getByRole("button", { name: "需要专业版及以上" }));
    const dialog = screen.getByRole("dialog", { name: "解锁专业版能力" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("localizes the upgrade dialog action in English", async () => {
    await i18n.changeLanguage("en-US");
    renderPicker("community", { type: "hana" });
    expect(
      screen.getByRole("button", { name: "Requires Enterprise standard or higher" }),
    ).toBeInTheDocument();
  });
});
