/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { createContext, useContext } from "react";

import type { ObjectTypeProperty } from "@/modules/knowledge-network/cypher/cypher-query.service";
import { EMPTY_GRAPH_STYLE, type GraphStyle } from "@/modules/knowledge-network/cypher/graph-style";
import {
  GRAPH_NODE_LIMIT,
  type CypherGraphNode,
} from "@/modules/knowledge-network/cypher/graph-values";

/** The page's graph style, shared by every frame's graph and editable from any overview. */
export type GraphStyleContextValue = {
  style: GraphStyle;
  setStyle: (change: (style: GraphStyle) => GraphStyle) => void;
  /** Per object type, the properties a caption can show. */
  properties: Record<string, ObjectTypeProperty[]>;
  /** How many nodes a graph draws before it asks; the user sets it. */
  nodeLimit: number;
  /** Reads all of a node's properties; a result carries only the ones it asked for. */
  loadNodeProperties?: (
    node: CypherGraphNode,
    signal: AbortSignal,
  ) => Promise<Record<string, unknown> | null>;
};

export const GraphStyleContext = createContext<GraphStyleContextValue>({
  style: EMPTY_GRAPH_STYLE,
  setStyle: () => undefined,
  properties: {},
  nodeLimit: GRAPH_NODE_LIMIT,
});

export function useGraphStyle(): GraphStyleContextValue {
  return useContext(GraphStyleContext);
}
