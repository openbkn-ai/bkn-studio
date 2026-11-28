/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildDefaultLogicStatement,
  localStatementProblem,
  syncLogicParameters,
} from "./constants";

let counter = 0;
const createId = () => `id-${++counter}`;

describe("buildDefaultLogicStatement", () => {
  it("starts from the instance by its primary key", () => {
    const statement = buildDefaultLogicStatement({ objectTypeId: "person", primaryKeys: ["pid"] });
    expect(statement).toContain("MATCH (n:person)");
    expect(statement).toContain("n.pid = $id");
  });

  it("takes one parameter per key of a composite primary key", () => {
    const statement = buildDefaultLogicStatement({
      objectTypeId: "order",
      primaryKeys: ["a", "b"],
    });
    expect(statement).toContain("n.a = $a AND n.b = $b");
  });
});

describe("syncLogicParameters", () => {
  it("binds $id to the primary key by default and leaves the rest as input", () => {
    expect(
      syncLogicParameters({
        createId,
        current: [],
        primaryKeys: ["pid"],
        statement: "MATCH (n:person) WHERE n.pid = $id AND n.age > $min RETURN n.x",
      }),
    ).toMatchObject([
      { name: "id", value: "pid", valueFrom: "property" },
      { name: "min", valueFrom: "input" },
    ]);
  });

  it("keeps what the user set and drops parameters no longer used", () => {
    const current = [
      { id: "p1", name: "min", value: "3", valueFrom: "const" as const },
      { id: "p2", name: "gone", valueFrom: "input" as const },
    ];
    expect(
      syncLogicParameters({ createId, current, primaryKeys: [], statement: "RETURN $min" }),
    ).toEqual([current[0]]);
  });
});

describe("localStatementProblem", () => {
  it("refuses an empty statement and positional parameters", () => {
    expect(localStatementProblem("  ")).toBe("objectTypeLogicStatementRequired");
    expect(localStatementProblem("RETURN $0")).toBe("objectTypeLogicStatementPositional");
    expect(localStatementProblem("RETURN $id")).toBeNull();
  });
});
