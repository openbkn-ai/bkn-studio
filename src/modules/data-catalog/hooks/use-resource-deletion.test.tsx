/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { render, renderHook, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataCatalogEnUS } from "@/modules/data-catalog/locales/en-US";
import { dataCatalogZhCN } from "@/modules/data-catalog/locales/zh-CN";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import type { CatalogRecord } from "@/shared/catalog";

const { confirmMock, translateMock, deleteResourceMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  translateMock: vi.fn(),
  deleteResourceMock: vi.fn(),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: translateMock }),
}));

vi.mock("@/framework/context/use-app-services", () => ({
  useAppServices: () => ({
    message: { error: vi.fn(), success: vi.fn() },
    modal: { confirm: confirmMock },
  }),
}));

vi.mock("@/modules/data-catalog/services/resource.service", () => ({
  deleteCatalogResource: deleteResourceMock,
  getCatalogResource: vi.fn(),
}));

import { useResourceDeletion } from "./use-resource-deletion";

describe.each([
  {
    language: "en-US",
    impact: /deletes all bound build schedules.*retains existing build task history/i,
  },
  {
    language: "zh-CN",
    impact: /删除所有绑定的构建计划.*保留已有构建任务历史/,
  },
])("useResourceDeletion ($language)", ({ language, impact }) => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const i18n = createInstance();
    await i18n.init({
      lng: language,
      resources: {
        "en-US": { translation: dataCatalogEnUS },
        "zh-CN": { translation: dataCatalogZhCN },
      },
    });
    translateMock.mockImplementation((key: string) => i18n.t(key));
  });

  it("discloses schedule deletion and retained task history before confirmation", () => {
    const { result } = renderHook(() => useResourceDeletion());
    result.current.confirmDeleteResource(
      { id: "resource-1", name: "orders", category: "table" } as CatalogResource,
      { id: "catalog-1", name: "warehouse" } as CatalogRecord,
      vi.fn(),
    );
    const confirmation = confirmMock.mock.calls[0][0] as { content: ReactNode };
    render(confirmation.content);

    expect(screen.getByText(impact)).toBeVisible();
    expect(deleteResourceMock).not.toHaveBeenCalled();
  });
});
