/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/app/locales/i18n";

const testCatalogConnectionMock = vi.hoisted(() => vi.fn());
const testCatalogConnectionConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/catalog", () => ({
  testCatalogConnection: testCatalogConnectionMock,
  testCatalogConnectionConfig: testCatalogConnectionConfigMock,
}));

describe("data-connect.service · test connection", () => {
  beforeEach(() => {
    testCatalogConnectionMock.mockReset();
    testCatalogConnectionConfigMock.mockReset();
  });

  it("rejects an existing catalog business failure with the backend message", async () => {
    testCatalogConnectionMock.mockResolvedValue({
      message: "Connection refused.",
      success: false,
    });
    const { testDataConnectRecord } = await import(
      "@/modules/data-connect/services/data-connect.service"
    );

    await expect(testDataConnectRecord("catalog-1")).rejects.toThrow(
      "Connection refused.",
    );
  });

  it("uses the localized fallback when the backend failure message is empty", async () => {
    testCatalogConnectionConfigMock.mockResolvedValue({
      message: "  ",
      success: false,
    });
    const { testDataConnectConfig } = await import(
      "@/modules/data-connect/services/data-connect.service"
    );

    await expect(
      testDataConnectConfig({
        connectorConfig: { host: "db.example.com" },
        connectorType: "postgresql",
      }),
    ).rejects.toThrow(i18n.t("dataConnect.testConnectionFailed"));
  });

  it("resolves a successful preflight without creating or updating a catalog", async () => {
    testCatalogConnectionConfigMock.mockResolvedValue({
      message: "Connection test succeeded.",
      success: true,
    });
    const { testDataConnectConfig } = await import(
      "@/modules/data-connect/services/data-connect.service"
    );
    const input = {
      connectorConfig: { host: "db.example.com" },
      connectorType: "postgresql",
    };

    await expect(testDataConnectConfig(input)).resolves.toBeUndefined();
    expect(testCatalogConnectionConfigMock).toHaveBeenCalledWith(input);
    expect(testCatalogConnectionMock).not.toHaveBeenCalled();
  });
});
