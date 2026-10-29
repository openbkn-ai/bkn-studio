/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildInstanceId,
  identityKey,
  pickDisplay,
  renderLabelTemplate,
  stringifyValue,
  templateProperties,
} from "./instance-label";

describe("buildInstanceId", () => {
  it("mirrors GetObjectID for a single primary key", () => {
    expect(buildInstanceId("ot_supplier", ["supplier_id"], { supplier_id: 42 })).toBe(
      "ot_supplier-42",
    );
  });

  it("joins composite keys in primary_keys order and marks missing keys", () => {
    expect(
      buildInstanceId("ot_order", ["order_no", "line_no"], { line_no: 3, order_no: "A1" }),
    ).toBe("ot_order-A1_3");
    expect(buildInstanceId("ot_order", ["order_no", "line_no"], { order_no: "A1" })).toBe(
      "ot_order-A1___NULL__",
    );
  });

  it("returns null without a primary key", () => {
    expect(buildInstanceId("ot_x", [], { id: 1 })).toBeNull();
  });
});

describe("label templates", () => {
  it("fills slots and drops separators left by empty ones", () => {
    const props = { family_name: "Ma", given_name: "Long", code: "" };
    expect(renderLabelTemplate("{family_name}, {given_name}", props)).toBe("Ma, Long");
    expect(renderLabelTemplate("{family_name}, {code}", props)).toBe("Ma");
    expect(renderLabelTemplate("{code}, {given_name}", props)).toBe("Long");
    expect(renderLabelTemplate("{family_name} ({code})", props)).toBe("Ma");
    expect(renderLabelTemplate("{Family_Name}", props)).toBe("Ma");
  });

  it("keeps line breaks, drops emptied lines and fills the type slot", () => {
    const props = { family_name: "Ma", code: "" };
    expect(renderLabelTemplate("{family_name}\n{code}\n{$type}", props, "主教练")).toBe(
      "Ma\n主教练",
    );
    expect(renderLabelTemplate("{$type}: {code}", props, "主教练")).toBeNull();
    // With no property slot there is nothing to be missing: text and the type always fill.
    expect(renderLabelTemplate("123123 {$type}", props, "国家队")).toBe("123123 国家队");
    expect(templateProperties("{$type} {a}")).toEqual(["a"]);
  });

  it("never trims separators that belong to a value", () => {
    expect(renderLabelTemplate("{a}, {b}", { a: "-5", b: "A/" })).toBe("-5, A/");
    expect(renderLabelTemplate("{a} ({b})", { a: "x", b: "" })).toBe("x");
  });

  it("returns null when every slot is empty", () => {
    expect(renderLabelTemplate("{code} / {missing}", { code: "" })).toBeNull();
  });

  it("lists the referenced properties", () => {
    expect(templateProperties("{a}, { b }")).toEqual(["a", "b"]);
  });

  it("drives pickDisplay and falls back to the default chain", () => {
    expect(pickDisplay({ family_name: "Ma", name: "N" }, "nid", "{family_name}!")).toBe("Ma!");
    expect(pickDisplay({ name: "N" }, "nid", "{family_name}")).toBe("N");
    expect(pickDisplay({ family_name: "Ma", name: "N" }, "nid", "family_name")).toBe("Ma");
  });
});

describe("pickDisplay", () => {
  it("walks the chain _display → display_name → name → id → first property → node id", () => {
    expect(pickDisplay({ _display: "A", display_name: "B", name: "C" }, "nid")).toBe("A");
    expect(pickDisplay({ display_name: "B", name: "C" }, "nid")).toBe("B");
    expect(pickDisplay({ name: "C", id: "D" }, "nid")).toBe("C");
    expect(pickDisplay({ id: 7 }, "nid")).toBe("7");
    expect(pickDisplay({ _instance_id: "x", city: "Shanghai" }, "nid")).toBe("Shanghai");
    expect(pickDisplay({ _instance_id: "x" }, "nid")).toBe("nid");
  });

  it("prefers an explicit label property and falls back when it is empty", () => {
    expect(pickDisplay({ _display: "A", city: "Shanghai" }, "nid", "city")).toBe("Shanghai");
    expect(pickDisplay({ _display: "A", city: "" }, "nid", "city")).toBe("A");
  });
});

describe("pickDisplay", () => {
  it("prefers the tidied text over the raw one", () => {
    expect(pickDisplay({ text: "**原文** 带标记", text_clean: "原文带标记" }, "a-1")).toBe(
      "原文带标记",
    );
    expect(pickDisplay({ text: "只有原文" }, "a-1")).toBe("只有原文");
  });

  it("keeps the configured and conventional names ahead of any text", () => {
    expect(pickDisplay({ name: "名称", text_clean: "正文" }, "a-1")).toBe("名称");
    expect(pickDisplay({ title: "标题", text_clean: "正文" }, "a-1")).toBe("标题");
    expect(pickDisplay({ description: "说明", text_clean: "正文" }, "a-1")).toBe("说明");
    expect(pickDisplay({ title: "标题", description: "说明" }, "a-1")).toBe("标题");
    expect(pickDisplay({ topic: "主题", description: "说明", text_clean: "正文" }, "a-1")).toBe(
      "主题",
    );
    expect(pickDisplay({ title: "标题", topic: "主题" }, "a-1")).toBe("标题");
    expect(pickDisplay({ Topic: "主题", Description: "说明" }, "a-1")).toBe("主题");
    expect(pickDisplay({ text_clean: "正文", note: "别的" }, "a-1", "note")).toBe("别的");
  });

  it("matches the property names whatever their case", () => {
    expect(pickDisplay({ Title: "标题" }, "a-1")).toBe("标题");
    expect(pickDisplay({ Description: "说明", Text: "正文" }, "a-1")).toBe("说明");
    expect(pickDisplay({ TEXT: "原文", Text_Clean: "清洗后" }, "a-1")).toBe("清洗后");
    expect(pickDisplay({ Note: "别的" }, "a-1", "note")).toBe("别的");
  });

  it("falls back to the id and then to the node id", () => {
    expect(pickDisplay({ id: "abc" }, "a-1")).toBe("abc");
    expect(pickDisplay({}, "a-1")).toBe("a-1");
  });
});

describe("identityKey", () => {
  it("joins the key values in primary key order and refuses a missing one", () => {
    expect(identityKey(["order_no", "line_no"], { line_no: 3, order_no: "A_1" })).toBe(
      "A_1\u001f3",
    );
    expect(identityKey(["order_no", "line_no"], { order_no: "A1" })).toBeNull();
    expect(identityKey([], { id: 1 })).toBeNull();
  });
});

describe("stringifyValue", () => {
  it("renders objects as JSON and nothing as empty", () => {
    expect(stringifyValue({ a: 1 })).toBe('{"a":1}');
    expect(stringifyValue(null)).toBe("");
    expect(stringifyValue(12)).toBe("12");
  });
});
