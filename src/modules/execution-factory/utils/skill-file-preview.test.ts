/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  isMarkdownSkillFile,
  isTextPreviewableSkillFile,
  resolveSkillFileFetchUrl,
  resolveSkillFileLanguage,
} from "@/modules/execution-factory/utils/skill-file-preview";

describe("skill-file-preview", () => {
  it("rewrites internal oss-minio URLs to same-origin paths", () => {
    expect(
      resolveSkillFileFetchUrl(
        "http://oss-minio:9000/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc",
      ),
    ).toBe("/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc");
  });

  it("rewrites oss URLs via API gateway when api base is absolute", () => {
    expect(
      resolveSkillFileFetchUrl(
        "http://oss-minio:9000/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc",
        "http://localhost:9010/api",
      ),
    ).toBe(
      "http://localhost:9010/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc",
    );
  });

  it("rewrites oss URLs via API gateway when api base is relative /api (E2E)", () => {
    expect(
      resolveSkillFileFetchUrl(
        "http://oss-minio:9000/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc",
        "/api",
      ),
    ).toBe(
      "http://127.0.0.1:9010/oss-workspace/execution-factory/skill/id/refs/guide.md?X-Amz-Signature=abc",
    );
  });

  it("detects markdown files as text previewable", () => {
    expect(isTextPreviewableSkillFile("text/markdown", "refs/guide.md")).toBe(true);
    expect(isTextPreviewableSkillFile(undefined, "scripts/run.py")).toBe(true);
    expect(isTextPreviewableSkillFile("application/zip", "archive.bin")).toBe(false);
  });

  it("maps file extensions to monaco languages", () => {
    expect(resolveSkillFileLanguage("scripts/pick_substitute.py")).toBe("python");
    expect(resolveSkillFileLanguage("SKILL.md")).toBe("markdown");
    expect(resolveSkillFileLanguage("config/app.YAML")).toBe("yaml");
    expect(resolveSkillFileLanguage("Makefile")).toBe("plaintext");
    expect(resolveSkillFileLanguage("data.unknownext")).toBe("plaintext");
    expect(resolveSkillFileLanguage()).toBe("plaintext");
  });

  it("flags markdown files for the rendered/source toggle", () => {
    expect(isMarkdownSkillFile("refs/guide.markdown")).toBe(true);
    expect(isMarkdownSkillFile("scripts/run.py")).toBe(false);
  });
});
