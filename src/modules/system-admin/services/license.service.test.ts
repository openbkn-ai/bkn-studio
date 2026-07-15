/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { describe, expect, it } from "vitest";

import {
  mapActivationCode,
  mapLicenseDetail,
  resolveLicenseRequestErrorCode,
} from "@/modules/system-admin/services/license.service";

describe("license.service", () => {
  it("maps backend license detail to frontend shape", () => {
    const mapped = mapLicenseDetail({
      activated: true,
      contract_expires_at: 1815579753,
      customer: { email: "ops@example.com", name: "Acme", project: "BKN" },
      edition: "enterprise",
      features: ["rbac_basic"],
      grace_remaining_days: 12,
      instance_fp: "fp_001",
      issued_at: 1784043753,
      lic_id: "lic-1",
      limits: { max_users: 100 },
      renew_error: "issuer timeout",
      state: "grace",
    });

    expect(mapped).toMatchObject({
      activated: true,
      contractExpiresAt: 1815579753,
      customer: { email: "ops@example.com", name: "Acme", project: "BKN" },
      edition: "enterprise",
      features: ["rbac_basic"],
      graceRemainingDays: 12,
      instanceFp: "fp_001",
      issuedAt: 1784043753,
      licId: "lic-1",
      limits: { max_users: 100 },
      renewError: "issuer timeout",
      state: "grace",
    });
  });

  it("maps activation code response", () => {
    expect(
      mapActivationCode({
        activation_code: "code",
        instance_fp: "fp_001",
        lic_id: "lic-1",
      }),
    ).toEqual({
      activationCode: "code",
      instanceFp: "fp_001",
      licId: "lic-1",
    });
  });

  it("classifies import and activation errors", () => {
    expect(
      resolveLicenseRequestErrorCode(
        new axios.AxiosError(
          "bad request",
          undefined,
          undefined,
          undefined,
          {
            config: { headers: new axios.AxiosHeaders() },
            data: { error: "bad signature" },
            headers: {},
            status: 400,
            statusText: "Bad Request",
          },
        ),
      ),
    ).toBe("invalidLicense");

    expect(
      resolveLicenseRequestErrorCode(
        new axios.AxiosError(
          "conflict",
          undefined,
          undefined,
          undefined,
          {
            config: { headers: new axios.AxiosHeaders() },
            data: { error: "activation rejected", stored: true },
            headers: {},
            status: 409,
            statusText: "Conflict",
          },
        ),
      ),
    ).toBe("activationConflict");
  });
});
