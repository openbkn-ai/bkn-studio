/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { resolveAuditActionFilter } from "./audit-action-filter";

const labels: Record<string, string> = {
  "bknTrace.logs.accessActions.login": "用户登录",
  "bknTrace.logs.auditActions.create": "新建",
  "bknTrace.logs.systemManagementActions.createUser": "新建用户",
  "bknTrace.logs.auditActions.update": "更新",
  "bknTrace.logs.auditActions.grant": "更新对象授权",
  "bknTrace.logs.auditActions.update_profile": "更新个人资料",
};
function translate(key: string, options?: Record<string, unknown>) { return labels[key] ?? String(options?.defaultValue ?? key); }

describe("resolveAuditActionFilter", () => {
  it("resolves a localized access action label to its stored action code", () => { expect(resolveAuditActionFilter("用户登录", translate)).toBe("login"); });
  it("resolves a localized system-management action label to its stored action code", () => { expect(resolveAuditActionFilter("新建用户", translate)).toBe("create"); });
  it("keeps a technical action code unchanged", () => { expect(resolveAuditActionFilter("login", translate)).toBe("login"); });
  it("prefers an exact label over longer labels containing it", () => { expect(resolveAuditActionFilter("更新", translate)).toBe("update"); });
  it("keeps unknown action text unchanged", () => { expect(resolveAuditActionFilter("同步目录", translate)).toBe("同步目录"); });
});
