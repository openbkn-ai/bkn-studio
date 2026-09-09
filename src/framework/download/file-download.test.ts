/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  parseContentDispositionFilename,
  sanitizeDownloadFilename,
} from "@/framework/download/file-download";

describe("download-file", () => {
  it("parses attachment filenames from Content-Disposition", () => {
    expect(
      parseContentDispositionFilename('attachment; filename="toolbox_export_20240607.adp"'),
    ).toBe("toolbox_export_20240607.adp");
  });

  it("prefers the encoded filename* over a plain filename", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=fallback.tar; filename*=UTF-8''%E4%BE%9B%E5%BA%94%E9%93%BE.tar",
      ),
    ).toBe("供应链.tar");
  });

  it("reads an unquoted filename, as the BKN package export sends it", () => {
    expect(parseContentDispositionFilename("attachment; filename=crm-management-main.tar")).toBe(
      "crm-management-main.tar",
    );
  });

  it("leaves naming to the caller when the header carries none", () => {
    expect(parseContentDispositionFilename(undefined)).toBeUndefined();
    expect(parseContentDispositionFilename("attachment")).toBeUndefined();
  });

  it("sanitizes unsafe download names", () => {
    expect(sanitizeDownloadFilename("demo toolbox/1", "fallback")).toBe("demo_toolbox_1");
  });
});
