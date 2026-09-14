/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { commonEnUS } from "@/app/locales/resources/common/en-US";
import { commonZhCN } from "@/app/locales/resources/common/zh-CN";
import { systemAdminEnUS } from "@/modules/system-admin/locales/en-US";
import { systemAdminZhCN } from "@/modules/system-admin/locales/zh-CN";
import type { AdminRole } from "@/modules/system-admin/types/admin";

let language = "zh-CN";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    i18n: { language },
    t: (key: string, options?: { name?: string }) => {
      const locale = language === "zh-CN"
        ? { common: commonZhCN.common, systemAdmin: systemAdminZhCN.systemAdmin }
        : { common: commonEnUS.common, systemAdmin: systemAdminEnUS.systemAdmin };
      if (key === "common.custom") return locale.common.custom;
      if (key === "systemAdmin.roles.builtin") return locale.systemAdmin.roles.builtin;
      if (key === "common.basicInfo") return locale.common.basicInfo;
      if (key === "systemAdmin.roles.detail.title") return options?.name ?? "";
      return key;
    },
  }),
}));

import { RoleDetailDrawer } from "./RoleDetailDrawer";

function role(builtin: boolean): AdminRole {
  return {
    accessorIds: [],
    builtin,
    description: "",
    id: builtin ? "builtin-role" : "custom-role",
    name: builtin ? "admin" : "custom-role",
    permissions: [],
  };
}

function renderDrawer(builtin: boolean) {
  return render(<RoleDetailDrawer onClose={vi.fn()} open role={role(builtin)} />);
}

afterEach(() => {
  cleanup();
  language = "zh-CN";
});

describe("RoleDetailDrawer role type label", () => {
  it.each([
    ["zh-CN", "内置", "自定义"],
    ["en-US", "Built-in", "Custom"],
  ])("renders translated built-in and custom labels in %s", (locale, builtinLabel, customLabel) => {
    language = locale;

    renderDrawer(true);
    expect(screen.getByText(builtinLabel)).toBeTruthy();

    cleanup();
    renderDrawer(false);
    expect(screen.getByText(customLabel)).toBeTruthy();
    expect(screen.queryByText("common.custom")).toBeNull();
  });
});
