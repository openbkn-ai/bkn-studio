import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_APP_BASENAME,
  buildAppPath,
  resolveAppBasename,
} from "@/app/router/app-paths";

describe("app-paths", () => {
  afterEach(() => {
    window.__BKN_STUDIO_RUNTIME__ = undefined;
  });

  it("uses /studio as the default app basename", () => {
    expect(DEFAULT_APP_BASENAME).toBe("/studio");
    expect(resolveAppBasename()).toBe("/studio");
  });

  it("builds callback paths under the configured basename", () => {
    window.__BKN_STUDIO_RUNTIME__ = { router: { basename: "/studio" } };

    expect(buildAppPath("/")).toBe("/studio");
    expect(buildAppPath("/callback")).toBe("/studio/callback");
  });
});
