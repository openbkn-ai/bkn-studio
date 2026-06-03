import { describe, expect, it } from "vitest";

import { hasPermissions } from "@/framework/permission/has-permissions";

describe("hasPermissions", () => {
  it("returns true when all required permissions exist", () => {
    expect(
      hasPermissions({
        currentPermissions: ["starter:create", "starter:edit"],
        requiredPermissions: ["starter:create", "starter:edit"],
      }),
    ).toBe(true);
  });

  it("returns false when one required permission is missing", () => {
    expect(
      hasPermissions({
        currentPermissions: ["starter:create"],
        requiredPermissions: ["starter:create", "starter:edit"],
      }),
    ).toBe(false);
  });

  it("supports any mode", () => {
    expect(
      hasPermissions({
        currentPermissions: ["starter:toggle"],
        mode: "any",
        requiredPermissions: ["starter:create", "starter:toggle"],
      }),
    ).toBe(true);
  });
});

