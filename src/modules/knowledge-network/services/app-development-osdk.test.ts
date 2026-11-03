/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  osdkClassName,
  osdkPropertyName,
  osdkAlias,
  osdkRelationAttribute,
  renderOsdkExamples,
  type OsdkExamplesInput,
} from "@/modules/knowledge-network/services/app-development-osdk";
import { cypherCall } from "@/modules/knowledge-network/services/app-development-examples";

const comments = {
  get: "get",
  where: "where",
  combine: "combine",
  page: "page",
  iterate: "iterate",
  count: "count",
  hop: "hop",
  multiHop: "multiHop",
  searchTypes: "searchTypes",
  searchInstances: "searchInstances",
};

const KN = "supply_ontology_hand";
const PRODUCT = "supply_ontology_hand_product";
const BOM = "supply_ontology_hand_bom";
const row = {
  _instance_identity: { material_number: "367-000061" },
  _display: "农业无人飞机",
  material_number: "367-000061",
  material_name: "农业无人飞机",
};

/** The supply-chain network on the dev deployment, whose generated package these were run on. */
function input(overrides: Partial<OsdkExamplesInput> = {}): OsdkExamplesInput {
  return {
    origin: "https://bkn.example.com",
    knId: KN,
    objectTypeId: PRODUCT,
    properties: ["material_name", "material_number"],
    row,
    relation: {
      id: "supply_ontology_hand_prod2bom",
      name: "产品关联产品bom",
      targetId: BOM,
      targetName: "产品BOM",
      targetProperties: ["bom_material_code", "material_name"],
      next: { id: "supply_ontology_hand_bom2mat", name: "BOM关联物料", targetName: "物料" },
    },
    question: "农业无人飞机",
    cypher: cypherCall(
      KN,
      { id: "supply_ontology_hand_prod2bom", sourceId: PRODUCT, targetId: BOM },
      row,
      null,
    ).call,
    comments,
    ...overrides,
  };
}

function code(examples: ReturnType<typeof renderOsdkExamples>, key: string) {
  return examples.find((example) => example.key === key)?.code ?? "";
}

describe("generated names", () => {
  // Names `bkn-osdk generate` wrote for the supply-chain network on the dev deployment.
  it("matches the generator on a real network", () => {
    expect(osdkClassName("supply_ontology_hand_product")).toBe("SupplyOntologyHandProduct");
    expect(osdkRelationAttribute("supply_ontology_hand_prod2bom", new Set())).toBe(
      "supply_ontology_hand_prod2bom",
    );
    expect(osdkPropertyName("material_name")).toBe("material_name");
  });

  it("follows the generator's escapes", () => {
    expect(osdkClassName("monitoring-task")).toBe("MonitoringTask");
    expect(osdkClassName("none")).toBe("None_");
    expect(osdkClassName("1st")).toBeNull();
    expect(osdkPropertyName("unit-price")).toBe("unit_price");
    expect(osdkPropertyName("count")).toBe("count_");
    expect(osdkPropertyName("class")).toBe("class_");
    expect(osdkRelationAttribute("rel_order_user", new Set())).toBe("order_user");
    expect(osdkRelationAttribute("rel_order_user", new Set(["order_user"]))).toBe("order_user_");
  });
});

describe("osdkAlias", () => {
  it("drops the network prefix for a short import name", () => {
    expect(osdkAlias(KN, PRODUCT)).toBe("Product");
    expect(osdkAlias("shop", "shop-order_line")).toBe("OrderLine");
    expect(osdkAlias(KN, "order")).toBeNull();
  });
});

describe("renderOsdkExamples", () => {
  it("offers the four examples in reading order", () => {
    expect(renderOsdkExamples(input()).map((example) => example.key)).toEqual([
      "query",
      "relations",
      "search",
      "cypher",
    ]);
  });

  it("sets the platform and token before anything else", () => {
    for (const { code } of renderOsdkExamples(input())) {
      expect(code.startsWith("import os\n\nimport bkn_osdk\n")).toBe(true);
      expect(code).toContain('    token=os.environ["BKN_TOKEN"],');
    }
  });

  it("queries by key, condition, page and count under a short name", () => {
    const text = code(renderOsdkExamples(input()), "query");
    expect(text).toContain("from bkn.object_types import SupplyOntologyHandProduct as Product");
    expect(text).toContain('item = Product.get("367-000061")');
    expect(text).toContain("print(item.material_name)");
    expect(text).toContain(
      'items = Product.where(Product.material_number == "367-000061").take(10)',
    );
    expect(text).toContain(
      'others = Product.where(~(Product.material_number == "367-000061")).count()',
    );
    expect(text).toContain("    Product.order_by(Product.material_number.desc())");
    expect(text).toContain("    .select(Product.material_number, Product.material_name)");
    expect(text).toContain("for row in Product.iterate(page_size=500):");
    expect(text).toContain("total = Product.count()");
    expect(text.split("\n").every((line) => line.length <= 80)).toBe(true);
  });

  it("follows one hop from the instance and walks two on the platform", () => {
    const text = code(renderOsdkExamples(input()), "relations");
    expect(text).toContain("from bkn.object_types import (");
    expect(text).toContain("    SupplyOntologyHandBom as Bom,");
    expect(text).toContain("related = item.supply_ontology_hand_prod2bom.take(10)");
    expect(text).toContain("reached = Product.supply_ontology_hand_prod2bom.then(");
    expect(text).toContain("    Bom.supply_ontology_hand_bom2mat");
    expect(text).toContain(").of(item, step_limit=10)");
  });

  it("stops at one hop when the target leads nowhere", () => {
    const relation = { ...input().relation!, next: undefined };
    const text = code(renderOsdkExamples(input({ relation })), "relations");
    expect(text).toContain("from bkn.object_types import SupplyOntologyHandProduct as Product");
    expect(text).not.toContain(".then(");
  });

  it("searches with the question and runs the network's Cypher with its id", () => {
    const examples = renderOsdkExamples(input());
    expect(code(examples, "search")).toContain('hits = bkn.search("农业无人飞机", max_concepts=5)');
    const cypher = code(examples, "cypher");
    expect(cypher).toContain('QUERY = """');
    expect(cypher).toContain('parameters = {"id": "367-000061"}');
    expect(cypher).toContain("result = kn.run_cypher(bkn.KN_ID, QUERY, parameters=parameters)");
  });

  it("passes a composite key by name and keeps the full class name without a prefix", () => {
    const examples = renderOsdkExamples(
      input({
        knId: "kn",
        objectTypeId: "bom",
        properties: ["bom_material_code", "seq_no"],
        row: {
          _instance_identity: { bom_material_code: "526-000006", seq_no: 1 },
          bom_material_code: "526-000006",
          seq_no: 1,
        },
        relation: undefined,
        cypher: null,
      }),
    );
    expect(examples.map((example) => example.key)).toEqual(["query", "search"]);
    expect(code(examples, "query")).toContain(
      'item = Bom.get(bom_material_code="526-000006", seq_no=1)',
    );
  });

  it("shows only a count without a sample, and nothing for an id with no class name", () => {
    const text = code(renderOsdkExamples(input({ row: null, relation: undefined })), "query");
    expect(text).not.toContain(".get(");
    expect(text).toContain("total = Product.count()");
    expect(renderOsdkExamples(input({ objectTypeId: "1st" }))).toEqual([]);
  });
});
