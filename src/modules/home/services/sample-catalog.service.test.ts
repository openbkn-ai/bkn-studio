/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

import {
  createSampleInstallation,
  listSamples,
  SampleRequestError,
} from "@/modules/home/services/sample-catalog.service";

const installation = {
  id: "inst-1",
  sample: "northwind",
  stages: [],
  status: "installing",
  version: "0.1.0",
};

describe("sample catalog service", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("loads the studio sample catalog", async () => {
    getMock.mockResolvedValue({ data: { samples: [] } });

    await expect(listSamples()).resolves.toEqual({ samples: [], sourceRejected: false });
    expect(getMock).toHaveBeenCalledWith("/api/studio/samples", { skipErrorToast: true });
  });

  it("creates an installation without a request body", async () => {
    postMock.mockResolvedValue({ data: installation });

    await expect(createSampleInstallation("northwind")).resolves.toMatchObject({ id: "inst-1" });
    expect(postMock).toHaveBeenCalledWith(
      "/api/studio/samples/northwind/installations",
      {},
      { skipErrorToast: true },
    );
  });

  it("surfaces already_installed from a conflict response", async () => {
    postMock.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: "already_installed", message: "Installed" }, status: 409 },
    });

    await expect(createSampleInstallation("northwind")).rejects.toMatchObject({
      code: "already_installed",
      message: "Installed",
    });
    await expect(createSampleInstallation("northwind")).rejects.toBeInstanceOf(SampleRequestError);
  });
});
