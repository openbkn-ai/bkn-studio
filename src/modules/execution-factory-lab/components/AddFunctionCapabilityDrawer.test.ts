import { describe, expect, it } from "vitest";

import { generateFunctionCode } from "@/modules/execution-factory-lab/utils/function-code-template";

describe("AddFunctionCapabilityDrawer", () => {
  it("generates function code that binds input example fields from event", () => {
    const code = generateFunctionCode({
      intent: "Add two numbers",
      inputExample: '{\n  "x": 1,\n  "y": 2\n}',
      outputExample: '{\n  "result": 3\n}',
    });

    expect(code).toContain('x = event.get("x", 1)');
    expect(code).toContain('y = event.get("y", 2)');
    expect(code).toContain('return {"result": x + y}');
  });
});
