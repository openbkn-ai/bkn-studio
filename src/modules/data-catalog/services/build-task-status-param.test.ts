import { describe, expect, it } from "vitest";

import { backendStatusParam } from "@/modules/data-catalog/services/build-task.service";

// 锁定前端归一状态 → 后端枚举映射(后端真实接口我本地无法验证,靠此守住映射)。
describe("backendStatusParam — 前端状态 → 后端枚举(逗号多值)", () => {
  it("paused 必须同时展开为 stopping,stopped", () => {
    expect(backendStatusParam(["paused"])).toBe("stopping,stopped");
  });

  it("pending→init, running→running, succeeded→completed, failed→failed", () => {
    expect(backendStatusParam(["pending"])).toBe("init");
    expect(backendStatusParam(["running"])).toBe("running");
    expect(backendStatusParam(["succeeded"])).toBe("completed");
    expect(backendStatusParam(["failed"])).toBe("failed");
  });

  it("listening 也映射到后端 running,与 running 去重", () => {
    expect(backendStatusParam(["running", "listening"])).toBe("running");
  });

  it("多状态拼接、去重", () => {
    expect(backendStatusParam(["running", "paused", "failed"])).toBe(
      "running,stopping,stopped,failed",
    );
  });
});
