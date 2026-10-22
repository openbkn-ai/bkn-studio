/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { objectTypePropertySample, relationTypePropertySample } from "./cypher-samples";

describe("samples with properties in place of nodes", () => {
  it("returns an object type's properties, quoting what needs it, at most eight", () => {
    expect(objectTypePropertySample("skill", ["name", "version"])).toBe(
      "MATCH (n:skill) RETURN n.name AS n_name, n.version AS n_version LIMIT 25",
    );
    expect(objectTypePropertySample("my-type", ["a-b"])).toBe(
      "MATCH (n:`my-type`) RETURN n.`a-b` AS `n_a-b` LIMIT 25",
    );
    const many = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(objectTypePropertySample("t", many).match(/ AS /g)).toHaveLength(8);
  });

  it("counts when no property is known", () => {
    expect(objectTypePropertySample("skill", [])).toBe("MATCH (n:skill) RETURN count(*) AS total");
  });

  it("returns both ends of a relation type, half each", () => {
    expect(
      relationTypePropertySample(
        { id: "uses", sourceId: "cap", targetId: "skill" },
        ["name", "a", "b", "c", "d"],
        ["version"],
      ),
    ).toBe(
      "MATCH (a:cap)-[:uses]->(b:skill) RETURN a.name AS a_name, a.a AS a_a, a.b AS a_b, a.c AS a_c, b.version AS b_version LIMIT 25",
    );
  });
});
