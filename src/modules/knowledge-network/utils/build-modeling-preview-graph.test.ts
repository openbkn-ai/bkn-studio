import { describe, expect, it } from "vitest";

import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";

describe("buildModelingPreviewGraph", () => {
  it("maps object types to nodes and relation types to edges", () => {
    const graph = buildModelingPreviewGraph(
      [
        {
          color: "#1677ff",
          conceptGroupIds: [],
          conceptGroupNames: [],
          description: "",
          hasIndex: false,
          id: "ot-a",
          name: "对象 A",
          tags: [],
          updateTime: "",
          updaterName: "",
        },
        {
          color: "#722ed1",
          conceptGroupIds: [],
          conceptGroupNames: [],
          description: "",
          hasIndex: false,
          id: "ot-b",
          name: "对象 B",
          tags: [],
          updateTime: "",
          updaterName: "",
        },
      ],
      [
        {
          color: "#13c2c2",
          description: "",
          id: "rt-1",
          mappingMode: "direct",
          name: "关联",
          sourceObjectTypeId: "ot-a",
          sourceObjectTypeName: "对象 A",
          tags: [],
          targetObjectTypeId: "ot-b",
          targetObjectTypeName: "对象 B",
          updateTime: "",
          updaterName: "",
        },
        {
          color: "#13c2c2",
          description: "",
          id: "rt-orphan",
          mappingMode: "direct",
          name: "无效关系",
          sourceObjectTypeId: "missing",
          sourceObjectTypeName: "缺失",
          tags: [],
          targetObjectTypeId: "ot-b",
          targetObjectTypeName: "对象 B",
          updateTime: "",
          updaterName: "",
        },
      ],
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toEqual([
      {
        id: "rt-1",
        name: "关联",
        sourceId: "ot-a",
        targetId: "ot-b",
      },
    ]);
  });
});
