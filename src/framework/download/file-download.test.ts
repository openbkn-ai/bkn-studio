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

describe("parseContentDispositionFilename", () => {
  it("parses attachment filenames from Content-Disposition", () => {
    expect(
      parseContentDispositionFilename('attachment; filename="toolbox_export_20240607.adp"'),
    ).toBe("toolbox_export_20240607.adp");
  });

  it("reads an unquoted filename, as the BKN package export sends it", () => {
    expect(parseContentDispositionFilename("attachment; filename=crm-management-main.tar")).toBe(
      "crm-management-main.tar",
    );
  });

  it("prefers the encoded filename* over a plain filename", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=fallback.tar; filename*=UTF-8''%E4%BE%9B%E5%BA%94%E9%93%BE.tar",
      ),
    ).toBe("供应链.tar");
  });

  it("decodes the skill download header for a chinese skill name", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"skill.zip\"; filename*=UTF-8''%E9%87%91%E9%A2%9D%E6%A0%B8%E5%AF%B9%E5%87%BD%E6%95%B0.zip",
      ),
    ).toBe("金额核对函数.zip");
  });

  it("decodes filename* regardless of parameter order and charset case", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=utf-8''%E6%8A%A5%E5%91%8A.tar; filename=\"report.tar\"",
      ),
    ).toBe("报告.tar");
  });

  it("decodes mixed names with spaces and parentheses", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"check (v2).zip\"; filename*=UTF-8''%E9%87%91%E9%A2%9D%20check%20%28v2%29.zip",
      ),
    ).toBe("金额 check (v2).zip");
  });

  it("decodes emoji and other non-CJK unicode", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"rocket.zip\"; filename*=UTF-8''rocket%20%F0%9F%9A%80.zip",
      ),
    ).toBe("rocket 🚀.zip");
  });

  it("keeps a literal percent sign and handles escaped quotes in plain filename", () => {
    expect(parseContentDispositionFilename('attachment; filename="100% done.zip"')).toBe(
      "100% done.zip",
    );
    expect(parseContentDispositionFilename('attachment; filename="say \\"hi\\".zip"')).toBe(
      "say _hi_.zip",
    );
  });

  it("falls back to plain filename when filename* is undecodable", () => {
    expect(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.zip\"; filename*=iso-8859-1''caf%E9.zip",
      ),
    ).toBe("fallback.zip");
    expect(
      parseContentDispositionFilename("attachment; filename=\"fallback.zip\"; filename*=UTF-8''%E9%ZZ"),
    ).toBe("fallback.zip");
  });

  it("does not percent-decode the plain filename parameter", () => {
    expect(parseContentDispositionFilename('attachment; filename="a%20b.zip"')).toBe("a%20b.zip");
  });

  it("strips path separators and control characters from untrusted headers", () => {
    expect(parseContentDispositionFilename('attachment; filename="../../etc/passwd.zip"')).toBe(
      "etc_passwd.zip",
    );
    expect(parseContentDispositionFilename('attachment; filename="C:\\\\evil\\\\x.zip"')).toBe(
      "C_evil_x.zip",
    );
    expect(parseContentDispositionFilename('attachment; filename="a\r\nb.zip"')).toBe("a_b.zip");
  });

  it("leaves naming to the caller when the header carries no usable name", () => {
    expect(parseContentDispositionFilename(undefined)).toBeUndefined();
    expect(parseContentDispositionFilename("")).toBeUndefined();
    expect(parseContentDispositionFilename("attachment")).toBeUndefined();
    expect(parseContentDispositionFilename('attachment; filename=""')).toBeUndefined();
    expect(parseContentDispositionFilename('attachment; filename="///"')).toBeUndefined();
  });
});

describe("sanitizeDownloadFilename", () => {
  it("replaces path separators but keeps spaces", () => {
    expect(sanitizeDownloadFilename("demo toolbox/1", "fallback")).toBe("demo toolbox_1");
  });

  it("preserves chinese, mixed and emoji names", () => {
    expect(sanitizeDownloadFilename("金额核对函数", "fallback")).toBe("金额核对函数");
    expect(sanitizeDownloadFilename("金额核对 check (v2)", "fallback")).toBe("金额核对 check (v2)");
    expect(sanitizeDownloadFilename("rocket 🚀", "fallback")).toBe("rocket 🚀");
  });

  it("replaces platform-illegal characters and strips control characters", () => {
    expect(sanitizeDownloadFilename('a:b*c?d"e<f>g|h', "fallback")).toBe("a_b_c_d_e_f_g_h");
    expect(sanitizeDownloadFilename("a\u0000b\u001fc\u007fd", "fallback")).toBe("a_b_c_d");
  });

  it("trims leading dots so the result is never a hidden or relative path", () => {
    expect(sanitizeDownloadFilename("..hidden", "fallback")).toBe("hidden");
    expect(sanitizeDownloadFilename("  spaced  ", "fallback")).toBe("spaced");
  });

  it("falls back when nothing usable remains", () => {
    expect(sanitizeDownloadFilename("", "fallback")).toBe("fallback");
    expect(sanitizeDownloadFilename("///", "fallback")).toBe("fallback");
  });
});
