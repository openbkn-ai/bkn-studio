/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { getModelViewAccess } from "@/modules/model-resources/utils/model-access";

describe("getModelViewAccess", () => {
  it("只授予大模型查看时不展示小模型", () => {
    expect(getModelViewAccess(["model-resources:large-model:view"])).toEqual({
      canViewLargeModel: true,
      canViewSmallModel: false,
    });
  });

  it("分别识别小模型查看授权", () => {
    expect(getModelViewAccess(["model-resources:small-model:view"])).toEqual({
      canViewLargeModel: false,
      canViewSmallModel: true,
    });
  });
});
