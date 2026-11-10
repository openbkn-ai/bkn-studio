/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  blankCypherLiterals,
  cypherLiteralText,
  cypherParameterReference,
  cypherParameterValues,
  parseCypherLiteral,
  scanCypherParameters,
  suggestCypherParameterName,
} from "./cypher-parameters";

describe("scanCypherParameters", () => {
  // The same cases the execution factory's scanner is tested with, so the parameter table
  // Studio builds is the one the save accepts.
  it.each([
    ["none", "MATCH (s:supplier) RETURN count(s)", []],
    [
      "first use order, distinct",
      "MATCH (o:order {order_id: $order_id, line_no: $line_no}) WHERE o.qty > $min OR o.id = $order_id RETURN o",
      ["order_id", "line_no", "min"],
    ],
    ["list parameter", "MATCH (s:supplier) WHERE s.id IN $ids RETURN s.name", ["ids"]],
    ["escaped name", "MATCH (s:supplier {id: $`supplier id`}) RETURN s", ["supplier id"]],
    ["escaped name with doubled backtick", "RETURN $`a``b`", ["a`b"]],
    ["unicode name", "MATCH (s:supplier {id: $供应商}) RETURN s", ["供应商"]],
    [
      "dollar in single-quoted string",
      "MATCH (s:supplier) WHERE s.note = 'costs $id' RETURN s",
      [],
    ],
    [
      "dollar in double-quoted string with escape",
      'MATCH (s) WHERE s.note = "say \\"$x\\"" AND s.id = $id RETURN s',
      ["id"],
    ],
    ["dollar in escaped identifier", "MATCH (s) RETURN s.`$weird` AS v, $real", ["real"]],
    ["line comment", "MATCH (s) // filter by $old\nWHERE s.id = $id RETURN s", ["id"]],
    ["block comment", "MATCH (s) /* was $old\n still */ WHERE s.id = $id RETURN s", ["id"]],
    ["unterminated block comment", "MATCH (s) WHERE s.id = $id /* $later", ["id"]],
    ["bare dollar at end", "RETURN $", []],
  ])("%s", (_name, query, names) => {
    const scan = scanCypherParameters(query);
    expect(scan.names).toEqual(names);
    expect(scan.positional).toBe(false);
  });

  it("marks where each use is written, from the $ to the end of the name", () => {
    const query = "MATCH (s {id: $id}) WHERE s.name = $`full name` OR s.id = $id RETURN 's $x'";
    const texts = scanCypherParameters(query).spans.map((span) => [
      span.name,
      query.slice(span.start, span.end),
    ]);
    expect(texts).toEqual([
      ["id", "$id"],
      ["full name", "$`full name`"],
      ["id", "$id"],
    ]);
  });

  it("counts offsets in UTF-16 units, as the editor does", () => {
    const query = "RETURN '😀' AS e, $名称 AS n";
    const [span] = scanCypherParameters(query).spans;
    expect(query.slice(span.start, span.end)).toBe("$名称");
  });

  it("flags a positional parameter", () => {
    expect(scanCypherParameters("MATCH (s {id: $0}) RETURN s").positional).toBe(true);
  });
});

describe("cypherParameterReference", () => {
  it("quotes only a name that needs it", () => {
    expect(cypherParameterReference("supplier_code")).toBe("$supplier_code");
    expect(cypherParameterReference("供应商")).toBe("$供应商");
    expect(cypherParameterReference("supplier id")).toBe("$`supplier id`");
    expect(cypherParameterReference("a`b")).toBe("$`a``b`");
  });
});

describe("parseCypherLiteral", () => {
  it.each([
    ["'76904023'", { type: "string", value: "76904023" }],
    ['"it\\"s"', { type: "string", value: 'it"s' }],
    ["42", { type: "number", value: 42 }],
    ["-1.5", { type: "number", value: -1.5 }],
    ["TRUE", { type: "boolean", value: true }],
    ["['a', 'b, c']", { type: "array", itemType: "string", value: ["a", "b, c"] }],
    ["[1, 2]", { type: "array", itemType: "number", value: [1, 2] }],
  ])("reads %s", (text, literal) => {
    expect(parseCypherLiteral(text)).toEqual(literal);
  });

  it.each(["s.code", "count(s)", "'a' + 'b'", "[]", "[1, 'a']", "[[1]]", "null"])(
    "refuses %s",
    (text) => {
      expect(parseCypherLiteral(text)).toBeNull();
    },
  );
});

describe("suggestCypherParameterName", () => {
  it("names the parameter after the property it is compared with", () => {
    expect(suggestCypherParameterName("MATCH (s) WHERE s.supplier_code = ", [])).toBe(
      "supplier_code",
    );
    expect(suggestCypherParameterName("MATCH (s:supplier {supplier_code: ", [])).toBe(
      "supplier_code",
    );
    expect(suggestCypherParameterName("MATCH (s) WHERE s.code IN ", [])).toBe("code");
  });

  it("falls back to param and stays distinct", () => {
    expect(suggestCypherParameterName("RETURN ", [])).toBe("param");
    expect(suggestCypherParameterName("WHERE s.code = ", ["code", "code_2"])).toBe("code_3");
  });
});

describe("cypherParameterValues", () => {
  it("reads typed values as literals, plain text as a string, and skips the empty", () => {
    expect(
      cypherParameterValues(["code", "plain", "min", "ids", "unset"], {
        code: "'76904023'",
        plain: "S1",
        min: "5",
        ids: "[1, 2]",
        unset: "  ",
        unused: "'x'",
      }),
    ).toEqual({ code: "76904023", plain: "S1", min: 5, ids: [1, 2] });
  });

  it("writes a value back as the literal it reads", () => {
    for (const value of ["it's", 76904023, true, ["a", "b"]]) {
      const text = cypherLiteralText(value);
      expect(cypherParameterValues(["p"], { p: text })).toEqual({ p: value });
    }
  });
});

describe("blankCypherLiterals", () => {
  it("blanks strings, comments and quoted names, keeping length and lines", () => {
    const query = "MATCH (s) WHERE s.a = 'x\\'y' AND s.`b c` = \"d\" // e\nRETURN s /* f */";
    const blanked = blankCypherLiterals(query);
    expect(blanked).toHaveLength(query.length);
    expect(blanked.split("\n")).toHaveLength(2);
    expect(blanked.replace(/\s+/g, " ").trim()).toBe("MATCH (s) WHERE s.a = AND s. = RETURN s");
  });
});
