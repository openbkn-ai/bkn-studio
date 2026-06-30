import { describe, expect, it } from "vitest";

import {
  buildAuditUserDirectory,
  formatAuditUserDisplay,
} from "@/modules/execution-factory-lab/utils/audit-user-display";

describe("formatAuditUserDisplay", () => {
  it("shows a user name instead of the current user's id", () => {
    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "Alice Zhang",
        currentUser: {
          id: "266c6a42-6131-4d62-8f39-853e7093701c",
          name: "Alice Zhang",
        },
      }),
    ).toBe("Alice Zhang");
  });

  it("prefers backend-provided user names over ids", () => {
    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        name: "Operator Owner",
        currentUser: {
          id: "someone-else",
          name: "Alice Zhang",
        },
      }),
    ).toBe("Operator Owner");
  });

  it("keeps non-id account names readable", () => {
    expect(formatAuditUserDisplay({ id: "local-admin" })).toBe("local-admin");
  });

  it("does not expose unresolved uuid values as user names", () => {
    expect(formatAuditUserDisplay({ id: "266c6a42-6131-4d62-8f39-853e7093701c" })).toBe("-");
  });

  it("resolves arbitrary audit user ids from the user directory", () => {
    const directory = buildAuditUserDirectory([
      { id: "266c6a42-6131-4d62-8f39-853e7093701c", name: "Chen Yanqiu" },
    ]);

    expect(
      formatAuditUserDisplay({
        id: "266c6a42-6131-4d62-8f39-853e7093701c",
        directory,
      }),
    ).toBe("Chen Yanqiu");
  });
});
