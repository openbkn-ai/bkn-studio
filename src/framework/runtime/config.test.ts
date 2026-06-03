import { describe, expect, it } from "vitest";

import { createRuntimeConfig } from "@/framework/runtime/config";

describe("createRuntimeConfig", () => {
  it("merges runtime user permissions and theme overrides", () => {
    const runtimeConfig = createRuntimeConfig({
      currentUser: {
        name: "Operator",
        permissions: ["starter:create"],
      },
      theme: {
        primaryColor: "#123456",
      },
    });

    expect(runtimeConfig.currentUser.name).toBe("Operator");
    expect(runtimeConfig.currentUser.permissions).toEqual(["starter:create"]);
    expect(runtimeConfig.currentUser.roles).toEqual(["admin"]);
    expect(runtimeConfig.theme.primaryColor).toBe("#123456");
  });
});
