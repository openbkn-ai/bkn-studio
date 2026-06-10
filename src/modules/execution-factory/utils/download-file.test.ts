import { describe, expect, it } from "vitest";

import {
  parseContentDispositionFilename,
  sanitizeDownloadFilename,
} from "@/modules/execution-factory/utils/download-file";

describe("download-file", () => {
  it("parses attachment filenames from Content-Disposition", () => {
    expect(
      parseContentDispositionFilename('attachment; filename="toolbox_export_20240607.adp"'),
    ).toBe("toolbox_export_20240607.adp");
  });

  it("sanitizes unsafe download names", () => {
    expect(sanitizeDownloadFilename("demo toolbox/1", "fallback")).toBe("demo_toolbox_1");
  });
});
